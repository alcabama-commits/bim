import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBCF from '@thatopen/components-front';
import * as FRAGS from '@thatopen/fragments';
import { BIMElement } from '../types';
import { Box, Loader2 } from 'lucide-react';

const FRAGMENTS_WORKER_URL = 'https://thatopen.github.io/engine_fragment/resources/worker.mjs';

async function getFragmentsWorkerUrl() {
  const res = await fetch(FRAGMENTS_WORKER_URL);
  if (!res.ok) throw new Error(`No se pudo descargar el worker de fragments (${res.status})`);
  const blob = await res.blob();
  const file = new File([blob], 'worker.mjs', { type: 'text/javascript' });
  return URL.createObjectURL(file);
}

interface BIMViewerProps {
  onModelLoaded: (components: OBC.Components) => void;
  elements: BIMElement[];
  selectedElementId?: string;
  selectedElementIds?: string[];
  onElementSelect: (id: string | null) => void;
  onSelectionChange?: (ids: string[]) => void;
  isLoading: boolean;
  isIsolateMode?: boolean;
}

export default function BIMViewer({ onModelLoaded, elements, selectedElementId, selectedElementIds, onElementSelect, onSelectionChange, isLoading, isIsolateMode }: BIMViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const componentsRef = useRef<OBC.Components | null>(null);
  const workerUrlRef = useRef<string | null>(null);
  const syncCleanupRef = useRef<null | (() => void)>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const elementIdIndexRef = useRef<Map<string, string>>(new Map());

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

        if (world.camera.hasCameraControls()) {
          const sync = () => {
            try {
              fragments.core.update(true);
            } catch {
            }
          };
          world.camera.controls.addEventListener('rest', sync);
          syncCleanupRef.current = () => world.camera.controls.removeEventListener('rest', sync);
        }
        
        // Configurar Highlighter
        highlighter.setup({ world });
        highlighter.enabled = true;
        highlighter.multiple = 'ctrlKey';
        highlighter.autoToggle.add('select');
        highlighter.styles.set('select', {
          color: new THREE.Color(0xd3045c),
          opacity: 1,
          transparent: false,
          depthTest: true,
          depthWrite: true,
          renderedFaces: FRAGS.RenderedFaces.ONE
        });
        
        // Configurar eventos
        setupFragmentEvents();
      } catch (error) {
        console.error("Error al inicializar FragmentsManager:", error);
      }
    };

    const setupFragmentEvents = () => {
      const list: Map<string, any> | undefined = (fragments as any).list;

      const getAllModels = () => Array.from(list?.values?.() ?? []);

      const getModelById = (id: string) => {
        if (!id) return undefined;
        const direct = list?.get?.(id);
        if (direct) return direct;

        for (const m of getAllModels()) {
          const keys = [m?.uuid, m?.id, m?.modelId].filter(Boolean).map(String);
          if (keys.includes(String(id))) return m;
        }
        return undefined;
      };

      const getWorld = () => {
        const worlds = components.get(OBC.Worlds);
        return Array.from(worlds.list.values())[0] as any;
      };

      const fitToVisible = () => {
        const w = getWorld();
        if (!w?.camera?.hasCameraControls?.()) return;
        const box = new THREE.Box3();
        let hasMeshes = false;
        w.scene.three.traverse((obj: any) => {
          if (obj?.isMesh && obj.visible) {
            box.expandByObject(obj);
            hasMeshes = true;
          }
        });
        if (hasMeshes && !box.isEmpty()) {
          w.camera.controls.fitToBox(box, true);
        }
      };

      // Índice para mapear (modelId:localId) -> elementId
      const buildElementIndex = () => {
        const index = new Map<string, string>();
        for (const el of elements) {
          const modelId = el.modelId ? String(el.modelId) : '';
          const localId = el.localId !== undefined ? Number(el.localId) : Number(el.id);
          if (modelId && Number.isFinite(localId)) {
            index.set(`${modelId}:${localId}`, el.id);
          }
        }
        elementIdIndexRef.current = index;
      };
      buildElementIndex();

      const getSelectionIds = (modelIdMap: OBC.ModelIdMap) => {
        const resolved: string[] = [];
        const index = elementIdIndexRef.current;
        for (const [modelId, itemIds] of Object.entries(modelIdMap)) {
          for (const itemId of Array.from(itemIds)) {
            const key = `${String(modelId)}:${Number(itemId)}`;
            const elId = index.get(key);
            if (elId) resolved.push(elId);
          }
        }
        return resolved;
      };

      // Suscribirse a eventos de selección (múltiple con Ctrl)
      if (highlighter.events.select) {
        highlighter.events.select.onHighlight.add((modelIdMap) => {
          const ids = getSelectionIds(modelIdMap);
          if (onSelectionChange) onSelectionChange(ids);
          onElementSelect(ids[0] ?? null);
        });

        highlighter.events.select.onClear.add(() => {
          onElementSelect(null);
          if (onSelectionChange) onSelectionChange([]);
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
            fitToVisible();
            break;
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      (components as any)._shortcutsCleanup = () => window.removeEventListener('keydown', handleKeyDown);
      
      void getAllModels();
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
      if (syncCleanupRef.current) syncCleanupRef.current();
      if (workerUrlRef.current) URL.revokeObjectURL(workerUrlRef.current);
      components.dispose();
    };
  }, []);

  // Handle visibility based on filtered elements and isolation mode
  useEffect(() => {
    if (!componentsRef.current || !isInitialized) return;
    
    const fragments = componentsRef.current.get(OBC.FragmentsManager);
    
    const updateVisibility = async () => {
      const list: Map<string, any> | undefined = (fragments as any).list;
      const models = Array.from(list?.values?.() ?? []);
      if (models.length === 0) return;

      for (const model of models) {
        const obj = model?.object ?? model;
        if (obj) obj.visible = true;
      }

      const hasSelection = selectedElementId || (selectedElementIds && selectedElementIds.length > 0);
      if (!isIsolateMode || !hasSelection) return;

      const selectionSet = new Set(selectedElementIds || (selectedElementId ? [selectedElementId] : []));
      const visibleElements = elements.filter(el => selectionSet.has(el.id));
      const visibleModelIds = new Set(visibleElements.map(el => String(el.modelId)).filter(Boolean));
      if (visibleModelIds.size === 0) return;

      for (const model of models) {
        const key = String(model?.uuid || model?.id || model?.modelId || '');
        const obj = model?.object ?? model;
        if (obj) obj.visible = visibleModelIds.has(key);
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
        const list: Map<string, any> | undefined = (fragments as any).list;
        const model =
          list?.get?.(modelId) ??
          Array.from(list?.values?.() ?? []).find((m: any) => {
            const keys = [m?.uuid, m?.id, m?.modelId].filter(Boolean).map(String);
            return keys.includes(String(modelId));
          });
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
        const list: Map<string, any> | undefined = (fragments as any).list;
        void Array.from(list?.values?.() ?? []);
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
              const worlds = componentsRef.current.get(OBC.Worlds);
              const world = Array.from(worlds.list.values())[0] as any;
              
              if (world && world.camera && "hasCameraControls" in world.camera && world.camera.hasCameraControls()) {
                const box = new THREE.Box3();
                let hasMeshes = false;
                world.scene.three.traverse((obj: any) => {
                  if (obj?.isMesh && obj.visible) {
                    box.expandByObject(obj);
                    hasMeshes = true;
                  }
                });
                if (hasMeshes && !box.isEmpty()) {
                  world.camera.controls.fitToBox(box, true);
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
