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
  allElements: BIMElement[];
  visibleElements: BIMElement[];
  statuses: Record<string, 'PENDIENTE' | 'PEDIDO' | 'COMPRADO' | 'EN BODEGA' | 'INSTALADO' | undefined>;
  selectedElementId?: string;
  selectedElementIds?: string[];
  onElementSelect: (id: string | null) => void;
  isLoading: boolean;
  isIsolateMode?: boolean;
}

export default function BIMViewer({ onModelLoaded, allElements, visibleElements, statuses, selectedElementId, selectedElementIds, onElementSelect, isLoading, isIsolateMode }: BIMViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const componentsRef = useRef<OBC.Components | null>(null);
  const workerUrlRef = useRef<string | null>(null);
  const syncCleanupRef = useRef<null | (() => void)>(null);
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
        highlighter.styles.set("select", { 
          color: new THREE.Color(0x3b82f6),
          opacity: 0.5,
          transparent: true,
          renderedFaces: FRAGS.RenderedFaces.TWO
        });

        highlighter.styles.set("status_PEDIDO", { 
          color: new THREE.Color(0x3b82f6),
          opacity: 0.25,
          transparent: true,
          renderedFaces: FRAGS.RenderedFaces.TWO
        });
        highlighter.styles.set("status_COMPRADO", { 
          color: new THREE.Color(0xf59e0b),
          opacity: 0.25,
          transparent: true,
          renderedFaces: FRAGS.RenderedFaces.TWO
        });
        highlighter.styles.set("status_EN_BODEGA", { 
          color: new THREE.Color(0xa78bfa),
          opacity: 0.25,
          transparent: true,
          renderedFaces: FRAGS.RenderedFaces.TWO
        });
        highlighter.styles.set("status_INSTALADO", { 
          color: new THREE.Color(0x22c55e),
          opacity: 0.25,
          transparent: true,
          renderedFaces: FRAGS.RenderedFaces.TWO
        });
        highlighter.styles.set("status_PENDIENTE", { 
          color: new THREE.Color(0x9ca3af),
          opacity: 0.18,
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

      // Suscribirse a eventos de selección
      if (highlighter.events.select) {
        highlighter.events.select.onHighlight.add(async (modelIdMap) => {
          const modelId = Object.keys(modelIdMap)[0];
          const itemIds = modelIdMap[modelId];
          const itemId = Array.from(itemIds)[0];
          
          getModelById(modelId);
          onElementSelect(itemId.toString());
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

  // Handle visibility, status coloring and selection highlighting
  useEffect(() => {
    if (!componentsRef.current || !isInitialized) return;
    
    const fragments = componentsRef.current.get(OBC.FragmentsManager);
    const highlighter = componentsRef.current.get(OBCF.Highlighter);
    const hider = componentsRef.current.get(OBC.Hider);
    
    const buildModelIdMapFromElements = (elementsToMap: BIMElement[]) => {
      const map: OBC.ModelIdMap = {};
      let hasAny = false;

      for (const el of elementsToMap) {
        const modelId = el.modelId ? String(el.modelId) : '';
        if (!modelId) continue;
        const localId = el.localId !== undefined ? Number(el.localId) : Number(el.id);
        if (!Number.isFinite(localId)) continue;
        if (!map[modelId]) map[modelId] = new Set<number>();
        map[modelId].add(localId);
        hasAny = true;
      }

      return { map, hasAny };
    };

    const update = async () => {
      const list: Map<string, any> | undefined = (fragments as any).list;
      const models = Array.from(list?.values?.() ?? []);
      if (models.length === 0) return;

      for (const model of models) {
        const obj = model?.object ?? model;
        if (obj) obj.visible = true;
      }

      const filterActive = visibleElements.length !== allElements.length;
      const selectionIds = selectedElementIds && selectedElementIds.length > 0 ? selectedElementIds : (selectedElementId ? [selectedElementId] : []);
      const hasSelection = selectionIds.length > 0;
      const isolateSelection = Boolean(isIsolateMode && hasSelection);

      const visibleIdSet = new Set(visibleElements.map((e) => e.id));
      const selectedIdSet = new Set(selectionIds);

      let finalVisible: BIMElement[] = visibleElements;
      if (isolateSelection) {
        finalVisible = allElements.filter((e) => selectedIdSet.has(e.id) && (!filterActive || visibleIdSet.has(e.id)));
      }

      const totalCount = allElements.length;
      const visibleCount = finalVisible.length;
      const hiddenCount = Math.max(0, totalCount - visibleCount);

      const shouldShowAll = !filterActive && !isolateSelection;
      if (shouldShowAll) {
        try {
          await hider.set(true);
        } catch {
        }
      } else if (visibleCount === 0) {
        try {
          await hider.set(false);
        } catch {
        }
      } else {
        const hiddenIsSmaller = hiddenCount > 0 && hiddenCount < visibleCount;

        try {
          await hider.set(true);
        } catch {
        }

        if (!hiddenIsSmaller) {
          const { map, hasAny } = buildModelIdMapFromElements(finalVisible);
          if (hasAny) {
            try {
              await hider.isolate(map);
            } catch {
            }
          }
        } else {
          const visibleSet = new Set(finalVisible.map((x) => x.id));
          const hidden = allElements.filter((e) => !visibleSet.has(e.id));
          const { map, hasAny } = buildModelIdMapFromElements(hidden);
          if (hasAny) {
            try {
              await hider.set(false, map);
            } catch {
            }
          }
        }
      }

      try {
        await highlighter.clear();
      } catch {
      }

      const visibleForColors = finalVisible;
      const byStatus: Record<string, BIMElement[]> = {
        PEDIDO: [],
        COMPRADO: [],
        'EN BODEGA': [],
        INSTALADO: [],
        PENDIENTE: []
      };

      for (const el of visibleForColors) {
        const st = statuses[el.id] ?? 'PENDIENTE';
        if (st === 'PENDIENTE') {
          byStatus.PENDIENTE.push(el);
        } else if (st === 'PEDIDO') {
          byStatus.PEDIDO.push(el);
        } else if (st === 'COMPRADO') {
          byStatus.COMPRADO.push(el);
        } else if (st === 'EN BODEGA') {
          byStatus['EN BODEGA'].push(el);
        } else if (st === 'INSTALADO') {
          byStatus.INSTALADO.push(el);
        } else {
          byStatus.PENDIENTE.push(el);
        }
      }

      const pendingLimit = 50000;
      const statusToStyle: Array<{ key: keyof typeof byStatus; style: string; enabled: boolean }> = [
        { key: 'PEDIDO', style: 'status_PEDIDO', enabled: true },
        { key: 'COMPRADO', style: 'status_COMPRADO', enabled: true },
        { key: 'EN BODEGA', style: 'status_EN_BODEGA', enabled: true },
        { key: 'INSTALADO', style: 'status_INSTALADO', enabled: true },
        { key: 'PENDIENTE', style: 'status_PENDIENTE', enabled: byStatus.PENDIENTE.length <= pendingLimit }
      ];

      for (const { key, style, enabled } of statusToStyle) {
        if (!enabled) continue;
        const els = byStatus[key];
        if (!els || els.length === 0) continue;
        const { map, hasAny } = buildModelIdMapFromElements(els);
        if (!hasAny) continue;
        try {
          await highlighter.highlightByID(style, map, true, false, null, false);
        } catch {
        }
      }

      if (hasSelection) {
        const selectedElements = allElements.filter((e) => selectedIdSet.has(e.id));
        const { map, hasAny } = buildModelIdMapFromElements(selectedElements);
        if (hasAny) {
          try {
            await highlighter.highlightByID("select", map, true, false, null, false);
          } catch {
          }
        }
      }
    };

    void update();
  }, [allElements, isInitialized, isIsolateMode, selectedElementId, selectedElementIds, statuses, visibleElements]);

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
            if (componentsRef.current && visibleElements.length > 0) {
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
