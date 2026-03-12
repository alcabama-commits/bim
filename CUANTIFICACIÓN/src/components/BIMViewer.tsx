import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBCF from '@thatopen/components-front';
import * as FRAGS from '@thatopen/fragments';
import { BIMElement } from '../types';
import { Box, Loader2 } from 'lucide-react';

interface BIMViewerProps {
  onModelLoaded: (components: OBC.Components) => void;
  elements: BIMElement[];
  selectedElementId?: string;
  selectedElementIds?: string[];
  onElementSelect: (id: string | null) => void;
  isLoading: boolean;
}

export default function BIMViewer({ onModelLoaded, elements, selectedElementId, selectedElementIds, onElementSelect, isLoading }: BIMViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const componentsRef = useRef<OBC.Components | null>(null);
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
    world.camera.three.position.set(20, 20, 20);
    
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
      if (fragments.initialized) return;
      
      console.log("Iniciando descarga de worker para Fragments...");
      try {
        const githubUrl = "https://thatopen.github.io/engine_fragment/resources/worker.mjs";
        const response = await fetch(githubUrl);
        if (!response.ok) throw new Error(`Error al descargar worker: ${response.statusText}`);
        
        const blob = await response.blob();
        const workerUrl = URL.createObjectURL(blob);
        console.log("Worker descargado y convertido a Blob URL:", workerUrl);
        
        fragments.init(workerUrl);
        console.log("FragmentsManager inicializado con éxito.");
        setIsInitialized(true);
        
        // Configurar Highlighter - Aseguramos que el mundo esté listo
        highlighter.setup({ world });
        highlighter.enabled = true;
        highlighter.styles.set("select", { 
          color: new THREE.Color(0x3b82f6),
          opacity: 0.5,
          transparent: true,
          renderedFaces: FRAGS.RenderedFaces.TWO
        });
        console.log("Highlighter configurado.");
        
        // Configurar eventos después de la inicialización
        setupFragmentEvents();
      } catch (error) {
        console.error("Fallo crítico al inicializar FragmentsManager:", error);
        // Fallback desesperado
        try {
          fragments.init("https://thatopen.github.io/engine_fragment/resources/worker.mjs");
          highlighter.setup({ world });
          setupFragmentEvents();
        } catch (e) {
          console.error("Fallback de FragmentsManager también falló:", e);
        }
      }
    };

    const setupFragmentEvents = () => {
      console.log("Configurando eventos de fragmentos...");
      
      // Suscribirse a eventos de selección
      if (highlighter.events.select) {
        highlighter.events.select.onHighlight.add(async (modelIdMap) => {
          const modelId = Object.keys(modelIdMap)[0];
          const itemIds = modelIdMap[modelId];
          const itemId = Array.from(itemIds)[0];
          
          const model = fragments.list.get(modelId);
          if (model) {
            // Intentar obtener el ExpressID del elemento seleccionado
            const itemsData = await model.getItemsData([itemId], { attributesDefault: true });
            const data = itemsData[0] || {};
            const getValue = (attr: any) => (attr && typeof attr === 'object' && 'value' in attr) ? attr.value : attr;
            const expressId = getValue(data.expressID || data.ExpressID || data.id || itemId).toString();
            
            console.log("Elemento seleccionado en visor (evento):", expressId);
            onElementSelect(expressId);
          }
        });

        highlighter.events.select.onClear.add(() => {
          onElementSelect(null);
        });
      }

      // Selección al hacer click
      containerRef.current?.addEventListener("click", () => {
        if (!fragments.initialized) return;
        highlighter.highlight("select");
      });

      // Keyboard shortcuts
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!fragments.initialized) return;
        
        switch(e.key.toLowerCase()) {
          case 'c':
            highlighter.clear();
            onElementSelect(null);
            break;
          case 'f':
            if (world.camera.hasCameraControls()) {
              const models = Array.from(fragments.list.values());
              if (models.length > 0) {
                const group = new THREE.Group();
                models.forEach(m => group.add(m.object.clone()));
                world.camera.controls.fitToSphere(group, true);
              }
            }
            break;
          case 'z':
            if (world.camera.hasCameraControls()) {
              highlighter.highlight("select", true, true);
            }
            break;
          case 'g':
            const grids = components.get(OBC.Grids);
            grids.enabled = !grids.enabled;
            break;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      (components as any)._shortcutsCleanup = () => window.removeEventListener('keydown', handleKeyDown);
      
      // Update fragments on camera controls change
      if (world.camera.hasCameraControls()) {
        world.camera.controls.addEventListener("update", () => {
          if (fragments.enabled && fragments.initialized) {
            fragments.core.update();
            if (Math.random() < 0.005) console.log("Fragmentos actualizados (Culling/LOD)");
          }
        });
      }

      // Remove z fighting
      fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
        if (!("isLodMaterial" in material && (material as any).isLodMaterial)) {
          material.polygonOffset = true;
          material.polygonOffsetUnits = 1;
          material.polygonOffsetFactor = Math.random();
        }
      });

      // Listener 1: FragmentsManager list (v3 standard)
      fragments.list.onItemSet.add(({ value: model }) => {
        console.log("Modelo detectado en fragments.list:", model.modelId);
        model.useCamera(world.camera.three);
        if (!world.scene.three.children.includes(model.object)) {
          world.scene.three.add(model.object);
          console.log("Modelo añadido a la escena desde fragments.list");
        }
        fragments.core.update(true);
      });

      // Listener 2: FragmentsModels list (Tutorial pattern)
      fragments.core.models.list.onItemSet.add(({ value: model }) => {
        console.log("Modelo detectado en core.models.list:", model.modelId);
        model.useCamera(world.camera.three);
        if (!world.scene.three.children.includes(model.object)) {
          world.scene.three.add(model.object);
          console.log("Modelo añadido a la escena desde core.models.list");
        }
        fragments.core.update(true);
      });

      // Listener 3: Core event
      fragments.core.onModelLoaded.add((model) => {
        console.log("Modelo detectado en core.onModelLoaded:", model.modelId);
        model.useCamera(world.camera.three);
        if (!world.scene.three.children.includes(model.object)) {
          world.scene.three.add(model.object);
          console.log("Modelo añadido a la escena desde core.onModelLoaded");
        }
        fragments.core.update(true);
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

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if ((components as any)._shortcutsCleanup) (components as any)._shortcutsCleanup();
      components.dispose();
    };
  }, []);

  // Handle visibility based on filtered elements
  useEffect(() => {
    if (!componentsRef.current || !isInitialized) return;
    
    const fragments = componentsRef.current.get(OBC.FragmentsManager);
    
    const updateVisibility = async () => {
      if (elements.length === 0) {
        // If no elements are filtered (or all filtered out), we might want to show nothing or everything
        // Usually, if no filters are active, elements.length is total.
        // If filters are active but match nothing, elements.length is 0.
        // Let's hide everything if elements is empty but we know we have models.
        if (fragments.list.size > 0) {
          for (const [, model] of fragments.list) {
            model.setVisibility(false);
          }
        }
        return;
      }

      // Group visible IDs by model
      const modelIdToLocalIds: Record<string, number[]> = {};
      elements.forEach(el => {
        if (el.modelId && el.localId !== undefined) {
          if (!modelIdToLocalIds[el.modelId]) {
            modelIdToLocalIds[el.modelId] = [];
          }
          modelIdToLocalIds[el.modelId].push(el.localId);
        }
      });

      for (const [modelId, model] of fragments.list) {
        const visibleLocalIds = modelIdToLocalIds[modelId] || [];
        
        if (visibleLocalIds.length === 0) {
          model.setVisibility(false);
        } else {
          // Hide everything first
          model.setVisibility(false);
          // Show only filtered
          const fragmentIdMap = model.getFragmentIdMap(visibleLocalIds);
          model.setVisibility(true, fragmentIdMap);
        }
      }
      
      // Force update
      fragments.core.update(true);
    };

    updateVisibility();
  }, [elements, isInitialized]);

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
        const model = fragments.list.get(modelId);
        if (model) {
          const localIds = Array.from(modelIdToLocalIds[modelId]);
          console.log(`Obteniendo FragmentIdMap para modelo ${modelId} con ${localIds.length} IDs locales.`);
          const fragmentIdMap = model.getFragmentIdMap(localIds);
          
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
        for (const [modelId, model] of fragments.list) {
          const ids = await model.getLocalIds();
          const itemsData = await model.getItemsData(ids, { attributesDefault: true });
          
          const getValue = (attr: any) => (attr && typeof attr === 'object' && 'value' in attr) ? attr.value : attr;
          
          const localIdsToHighlight: number[] = [];
          
          targetIds.forEach(targetId => {
            const index = itemsData.findIndex(data => {
              const expressId = getValue(data.expressID || data.ExpressID || data.id).toString();
              return expressId === targetId;
            });

            if (index !== -1) {
              localIdsToHighlight.push(ids[index]);
            }
          });

          if (localIdsToHighlight.length > 0) {
            const fragmentIdMap = model.getFragmentIdMap(localIdsToHighlight);
            for (const fragId in fragmentIdMap) {
              if (!finalFragmentIdMap[fragId]) {
                finalFragmentIdMap[fragId] = new Set();
              }
              fragmentIdMap[fragId].forEach(id => finalFragmentIdMap[fragId].add(id));
              foundAny = true;
            }
          }
        }
      }

      if (foundAny) {
        console.log("Aplicando resaltado a FragmentIdMap:", finalFragmentIdMap);
        try {
          // highlightByID es el método más directo para pasar un FragmentIdMap
          highlighter.highlightByID("select", finalFragmentIdMap, true, true);
          console.log("Resaltado aplicado con éxito.");
        } catch (err) {
          console.error("Error al aplicar resaltado con .highlightByID:", err);
          // Fallback a highlight si falla
          try {
            highlighter.highlight("select", true, true, finalFragmentIdMap);
            console.log("Resaltado aplicado con .highlight (fallback)");
          } catch (err2) {
            console.error("Fallo total al resaltar:", err2);
          }
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
              const world = Array.from(worlds.list.values())[0];
              
              if (world && world.camera.hasCameraControls()) {
                const modelIdToLocalIds: Record<string, number[]> = {};
                elements.forEach(el => {
                  if (el.modelId && el.localId !== undefined) {
                    if (!modelIdToLocalIds[el.modelId]) modelIdToLocalIds[el.modelId] = [];
                    modelIdToLocalIds[el.modelId].push(el.localId);
                  }
                });

                const finalFragmentIdMap: Record<string, Set<number>> = {};
                for (const [modelId, model] of fragments.list) {
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
              const frags = componentsRef.current.get(OBC.FragmentsManager);
              frags.core.update(true);
              console.log("Actualización manual de fragmentos ejecutada.");
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
