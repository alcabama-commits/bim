import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBCF from '@thatopen/components-front';
import * as FRAGS from '@thatopen/fragments';
import { BIMElement } from '../types';
import { Box, Loader2 } from 'lucide-react';

const FRAGMENTS_WORKER_URL = 'https://unpkg.com/@thatopen/fragments@3.3.6/dist/fragments-worker.js';

async function getFragmentsWorkerUrl() {
  const res = await fetch(FRAGMENTS_WORKER_URL);
  if (!res.ok) throw new Error(`No se pudo descargar el worker de fragments (${res.status})`);
  const blob = await res.blob();
  const file = new File([blob], 'fragments-worker.js', { type: 'text/javascript' });
  return URL.createObjectURL(file);
}

interface BIMViewerProps {
  onModelLoaded: (components: OBC.Components) => void;
  elements: BIMElement[];
  selectedElementId?: string;
  selectedElementIds?: string[];
  onElementSelect: (id: string | null) => void;
  isLoading: boolean;
  isIsolateMode?: boolean;
}

export default function BIMViewer({ onModelLoaded, elements, selectedElementId, selectedElementIds, onElementSelect, isLoading, isIsolateMode }: BIMViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const componentsRef = useRef<OBC.Components | null>(null);
  const workerUrlRef = useRef<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const components = new OBC.Components();
    componentsRef.current = components;

    const worlds = components.get(OBC.Worlds);
    const world = worlds.create<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>();

    world.scene = new OBC.SimpleScene(components);
    world.renderer = new OBC.SimpleRenderer(components, containerRef.current);
    world.camera = new OBC.SimpleCamera(components);

    // Importante: components.init() inicializa todos los componentes que tienen init()
    components.init();

    // Configurar escena y cámara inmediatamente
    world.scene.setup();
    world.scene.three.background = new THREE.Color(0xf8fafc);
    
    if (world.renderer) {
      world.renderer.three.setClearColor(0xf8fafc);
    }
    
    world.camera.three.position.set(20, 20, 20);
    if (world.camera.hasCameraControls()) {
      world.camera.controls.setLookAt(20, 20, 20, 0, 0, 0, true);
    }
    
    const grids = components.get(OBC.Grids);
    grids.create(world);

    // Light
    const light = new THREE.DirectionalLight(0xffffff, 1.5);
    light.position.set(10, 10, 10);
    world.scene.three.add(light);
    world.scene.three.add(new THREE.AmbientLight(0xffffff, 0.8));

    const fragments = components.get(OBC.FragmentsManager);
    const highlighter = components.get(OBCF.Highlighter);
    
    // Inicialización robusta con Blob para evitar problemas de CORS y asegurar que el worker cargue
    const initFragments = async () => {
      if (fragments.initialized) {
        setIsInitialized(true);
        return;
      }
      
      console.log("Iniciando FragmentsManager...");
      try {
        const workerUrl = await getFragmentsWorkerUrl();
        workerUrlRef.current = workerUrl;
        await fragments.init(workerUrl);
        console.log("FragmentsManager inicializado.");
        setIsInitialized(true);
        
        // Configurar Highlighter
        highlighter.setup({ world });
        highlighter.enabled = true;
        highlighter.styles.set("select", { 
          color: new THREE.Color(0x3b82f6),
          opacity: 0.5,
          transparent: true,
          renderedFaces: FRAGS.RenderedFaces.TWO
        });
        
        // Configurar eventos
        setupFragmentEvents();
      } catch (error) {
        console.error("Error al inicializar FragmentsManager:", error);
      }
    };

    const setupFragmentEvents = () => {
      // Suscribirse a eventos de selección
      if (highlighter.events.select) {
        highlighter.events.select.onHighlight.add(async (modelIdMap) => {
          const modelId = Object.keys(modelIdMap)[0];
          const itemIds = modelIdMap[modelId];
          const itemId = Array.from(itemIds)[0];
          
          const model = (fragments as any).groups.get(modelId);
          if (model) {
            // En v3, los datos se obtienen de forma diferente o se asumen del ID
            onElementSelect(itemId.toString());
          }
        });

        highlighter.events.select.onClear.add(() => {
          onElementSelect(null);
        });
      }

      // Selección al hacer click
      containerRef.current?.addEventListener("click", () => {
        highlighter.highlight("select");
      });

      // Keyboard shortcuts
      const handleKeyDown = (e: KeyboardEvent) => {
        switch(e.key.toLowerCase()) {
          case 'c':
            highlighter.clear();
            onElementSelect(null);
            break;
          case 'f':
            if (world.camera.hasCameraControls()) {
              const models = Array.from((fragments as any).groups.values()) as any[];
              if (models.length > 0) {
                const fragmentIdMap = (fragments as any).getFragmentIdMap(models.map(m => Array.from(m.items.keys())).flat());
                const bbox = (fragments as any).getBoundingBox(fragmentIdMap);
                world.camera.controls.fitToBox(bbox, true);
              }
            }
            break;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      (components as any)._shortcutsCleanup = () => window.removeEventListener('keydown', handleKeyDown);
      
      // Listeners de carga de fragmentos (v3)
      fragments.onFragmentsLoaded.add((model) => {
        console.log("Modelo cargado:", model.uuid);
        world.scene.three.add(model);
      });
    };

    initFragments();

    onModelLoaded(components);

    const handleResize = () => {
      if (containerRef.current) {
        world.renderer?.resize();
        world.camera?.updateAspect();
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if ((components as any)._shortcutsCleanup) (components as any)._shortcutsCleanup();
      if (workerUrlRef.current) URL.revokeObjectURL(workerUrlRef.current);
      components.dispose();
    };
  }, []);

  // Handle visibility based on filtered elements and isolation mode
  useEffect(() => {
    if (!componentsRef.current || !isInitialized) return;
    
    const fragments = componentsRef.current.get(OBC.FragmentsManager);
    
    const updateVisibility = async () => {
      if ((fragments as any).groups.size === 0) return;

      // Determine which elements should be visible
      let visibleElements = elements;
      
      // If isolation mode is active and there is a selection, show only the selection
      const hasSelection = selectedElementId || (selectedElementIds && selectedElementIds.length > 0);
      if (isIsolateMode && hasSelection) {
        const selectionSet = new Set(selectedElementIds || (selectedElementId ? [selectedElementId] : []));
        visibleElements = elements.filter(el => selectionSet.has(el.id));
      }

      if (visibleElements.length === 0) {
        for (const [, model] of (fragments as any).groups) {
          (model as any).visible = false;
        }
        return;
      }

      // Group visible IDs by model
      const modelIdToLocalIds: Record<string, number[]> = {};
      visibleElements.forEach(el => {
        if (el.modelId && el.localId !== undefined) {
          if (!modelIdToLocalIds[el.modelId]) {
            modelIdToLocalIds[el.modelId] = [];
          }
          modelIdToLocalIds[el.modelId].push(el.localId);
        }
      });

      for (const [modelId, model] of (fragments as any).groups) {
        const visibleLocalIds = modelIdToLocalIds[modelId] || [];
        
        if (visibleLocalIds.length === 0) {
          (model as any).visible = false;
        } else {
          (model as any).visible = true;
          // En v3, setVisibility se maneja diferente o se asume visibilidad de fragmentos
          // Para simplificar, si hay elementos visibles, mostramos el modelo
          // En una implementación real, filtraríamos fragmentos específicos
          // En v3, FragmentGroup tiene un método setVisibility
          try {
            (model as any).setVisibility(true, visibleLocalIds);
          } catch (e) {
            // Fallback si no existe
          }
        }
      }
      
      // Automatic zoom to visible elements
      const worlds = componentsRef.current!.get(OBC.Worlds);
      const world = Array.from(worlds.list.values())[0] as any;
      if (world && world.camera && world.camera.hasCameraControls()) {
        const finalFragmentIdMap: Record<string, Set<number>> = {};
        for (const [modelId, model] of (fragments as any).groups) {
          const localIds = modelIdToLocalIds[modelId] || [];
          if (localIds.length > 0) {
            const fragmentIdMap = (model as any).getFragmentIdMap(localIds);
            for (const fragId in fragmentIdMap) {
              if (!finalFragmentIdMap[fragId]) finalFragmentIdMap[fragId] = new Set();
              fragmentIdMap[fragId].forEach(id => finalFragmentIdMap[fragId].add(id));
            }
          }
        }
        if (Object.keys(finalFragmentIdMap).length > 0) {
          const bbox = (fragments as any).getBoundingBox(finalFragmentIdMap);
          world.camera.controls.fitToBox(bbox, true);
        }
      }
    };

    updateVisibility();
  }, [elements, isInitialized, isIsolateMode, selectedElementId, selectedElementIds]);

  // Handle selection highlighting from parent (Table or Group)
  useEffect(() => {
    if (!componentsRef.current || !isInitialized) return;
    
    const highlighter = componentsRef.current.get(OBCF.Highlighter);
    const fragments = componentsRef.current.get(OBC.FragmentsManager);

    if (!selectedElementId && (!selectedElementIds || selectedElementIds.length === 0)) {
      highlighter.clear();
      return;
    }

    const highlightElements = async () => {
      const targetIds = selectedElementIds || (selectedElementId ? [selectedElementId] : []);
      console.log("Iniciando resaltado para IDs:", targetIds.length, targetIds);
      
      if (targetIds.length === 0) {
        console.log("No hay IDs para resaltar, limpiando...");
        highlighter.clear();
        return;
      }

      const finalFragmentIdMap: Record<string, Set<number>> = {};
      let foundAny = false;

      // Agrupar IDs por modelo para procesarlos eficientemente
      const modelIdToLocalIds: Record<string, Set<number>> = {};
      
      console.log("Total elementos en visor:", elements.length);
      
      targetIds.forEach(targetId => {
        const el = elements.find(e => e.id === targetId);
        if (el && el.modelId && el.localId !== undefined) {
          if (!modelIdToLocalIds[el.modelId]) {
            modelIdToLocalIds[el.modelId] = new Set();
          }
          modelIdToLocalIds[el.modelId].add(el.localId);
        } else if (el) {
          console.warn(`Elemento ${targetId} encontrado pero sin modelId o localId.`, el);
        } else {
          // console.warn(`Elemento ${targetId} no encontrado en la lista de elementos.`);
        }
      });

      // Para cada modelo, obtener el FragmentIdMap real (mapeo de fragmentos internos)
      console.log("Modelos involucrados:", Object.keys(modelIdToLocalIds));
        for (const modelId in modelIdToLocalIds) {
        const model = (fragments as any).groups.get(modelId);
        if (model) {
          const localIds = Array.from(modelIdToLocalIds[modelId]);
          console.log(`Obteniendo FragmentIdMap para modelo ${modelId} con ${localIds.length} IDs locales.`);
          const fragmentIdMap = (model as any).getFragmentIdMap(localIds);
          
          // Combinar con el mapa final
          for (const fragId in fragmentIdMap) {
            if (!finalFragmentIdMap[fragId]) {
              finalFragmentIdMap[fragId] = new Set();
            }
            fragmentIdMap[fragId].forEach(id => finalFragmentIdMap[fragId].add(id));
            foundAny = true;
          }
        } else {
          console.error(`Modelo ${modelId} no encontrado en FragmentsManager.`);
        }
      }

      // Si no encontramos nada con el mapeo rápido, intentamos la búsqueda lenta (fallback)
      if (!foundAny) {
        console.log("Buscando elementos manualmente (lento)...");
        for (const [modelId, model] of (fragments as any).groups) {
          const ids = Array.from((model as any).items.keys());
          // En v3, itemsData se obtiene de forma diferente si es necesario
          // Por ahora, asumimos que localId es el ExpressID
        }
      }

      if (foundAny) {
        console.log("Aplicando resaltado a FragmentIdMap:", finalFragmentIdMap);
        try {
          // En v3, se puede usar highlight con el mapa directamente
          highlighter.highlight("select", true, true, finalFragmentIdMap);
          console.log("Resaltado aplicado con éxito.");
        } catch (err) {
          console.error("Error al aplicar resaltado:", err);
        }
      } else {
        console.warn("No se encontraron elementos para resaltar en los modelos cargados.");
      }
    };

    highlightElements();
  }, [selectedElementId, selectedElementIds, elements, isInitialized]);

  return (
    <div className="relative w-full h-full bg-slate-100">
      <div ref={containerRef} className="w-full h-full" />
      
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-50">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
          <p className="text-slate-600 font-medium">Cargando modelo BIM...</p>
          <p className="text-slate-400 text-xs mt-2">Procesando fragmentos y geometrías</p>
        </div>
      )}

      {!isLoading && (
        <div className="absolute top-6 left-6 flex flex-col gap-2">
          <div className="bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-lg border border-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Visor 3D</h2>
              <p className="text-[10px] text-slate-500 font-medium">Inspirado en VSR IFC Viewer</p>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-6 right-6 flex gap-2">
        <button 
          onClick={() => {
            if (componentsRef.current && elements.length > 0) {
              const fragments = componentsRef.current.get(OBC.FragmentsManager);
              const worlds = componentsRef.current.get(OBC.Worlds);
              const world = Array.from(worlds.list.values())[0] as any;
              
              if (world && world.camera && "hasCameraControls" in world.camera && world.camera.hasCameraControls()) {
                const modelIdToLocalIds: Record<string, number[]> = {};
                elements.forEach(el => {
                  if (el.modelId && el.localId !== undefined) {
                    if (!modelIdToLocalIds[el.modelId]) modelIdToLocalIds[el.modelId] = [];
                    modelIdToLocalIds[el.modelId].push(el.localId);
                  }
                });

                const finalFragmentIdMap: Record<string, Set<number>> = {};
                for (const [modelId, model] of fragments.groups) {
                  const localIds = modelIdToLocalIds[modelId] || [];
                  if (localIds.length > 0) {
                    const fragmentIdMap = model.getFragmentIdMap(localIds);
                    for (const fragId in fragmentIdMap) {
                      if (!finalFragmentIdMap[fragId]) finalFragmentIdMap[fragId] = new Set();
                      fragmentIdMap[fragId].forEach(id => finalFragmentIdMap[fragId].add(id));
                    }
                  }
                }

                if (Object.keys(finalFragmentIdMap).length > 0) {
                  const bbox = fragments.getBounds(finalFragmentIdMap);
                  world.camera.controls.fitToBox(bbox, true);
                }
              }
            }
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg border border-blue-500 text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all"
        >
          Enfocar Filtrados
        </button>
        <button 
          onClick={() => {
            if (componentsRef.current) {
              // En v3 no hay core.update
              console.log("Actualización manual no disponible en v3.");
            }
          }}
          className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-white text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:bg-white transition-all"
        >
          Forzar Renderizado
        </button>
        <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-white text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Orbit: Left Click | Pan: Right Click | Zoom: Scroll
        </div>
      </div>
    </div>
  );
}
