import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBCF from '@thatopen/components-front';
import * as FRAGS from '@thatopen/fragments';
import { BIMElement } from '../types';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

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
  statusColorsEnabled?: boolean;
  gridVisible?: boolean;
  selectedElementId?: string;
  selectedElementIds?: string[];
  onElementSelect: (id: string | null) => void;
  isLoading: boolean;
  isIsolateMode?: boolean;
}

export default function BIMViewer({ onModelLoaded, allElements, visibleElements, statuses, statusColorsEnabled = true, gridVisible = true, selectedElementId, selectedElementIds, onElementSelect, isLoading, isIsolateMode }: BIMViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const componentsRef = useRef<OBC.Components | null>(null);
  const workerUrlRef = useRef<string | null>(null);
  const syncCleanupRef = useRef<null | (() => void)>(null);
  const hiddenMapRef = useRef<OBC.ModelIdMap>({});
  const allHiddenRef = useRef(false);
  const updateSeqRef = useRef(0);
  const gridRef = useRef<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [statusVisibility, setStatusVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('cantidades:statusVisibility');
      if (!raw) {
        return { PENDIENTE: true, PEDIDO: true, COMPRADO: true, 'EN BODEGA': true, INSTALADO: true };
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const pick = (k: string) => (typeof parsed[k] === 'boolean' ? (parsed[k] as boolean) : true);
      return {
        PENDIENTE: pick('PENDIENTE'),
        PEDIDO: pick('PEDIDO'),
        COMPRADO: pick('COMPRADO'),
        'EN BODEGA': pick('EN BODEGA'),
        INSTALADO: pick('INSTALADO')
      };
    } catch {
      return { PENDIENTE: true, PEDIDO: true, COMPRADO: true, 'EN BODEGA': true, INSTALADO: true };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('cantidades:statusVisibility', JSON.stringify(statusVisibility));
    } catch {
    }
  }, [statusVisibility]);

  const statusButtons = useMemo(() => {
    return [
      { key: 'PENDIENTE', label: 'Pendiente', color: '#9CA3AF' },
      { key: 'PEDIDO', label: 'Pedido', color: '#3B82F6' },
      { key: 'COMPRADO', label: 'Comprado', color: '#FFA400' },
      { key: 'EN BODEGA', label: 'En bodega', color: '#A78BFA' },
      { key: 'INSTALADO', label: 'Instalado', color: '#22C55E' }
    ] as const;
  }, []);

  const applyGridVisibility = (grid: any, visible: boolean) => {
    if (!grid) return;
    if (typeof grid === 'object' && grid !== null) {
      if ('visible' in grid) (grid as any).visible = visible;
      if ((grid as any).three && 'visible' in (grid as any).three) (grid as any).three.visible = visible;
      if ((grid as any).mesh && 'visible' in (grid as any).mesh) (grid as any).mesh.visible = visible;
      if ((grid as any).grid && 'visible' in (grid as any).grid) (grid as any).grid.visible = visible;
    }
  };

  useEffect(() => {
    applyGridVisibility(gridRef.current, gridVisible);
  }, [gridVisible]);

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
    world.scene.three.background = new THREE.Color(0xffffff);
    
    if (world.renderer) {
      world.renderer.three.setClearColor(0xffffff);
    }
    
    world.camera.three.position.set(20, 20, 20);
    if (world.camera.hasCameraControls()) {
      world.camera.controls.setLookAt(20, 20, 20, 0, 0, 0, true);
    }
    
    const grids = components.get(OBC.Grids);
    gridRef.current = grids.create(world);
    applyGridVisibility(gridRef.current, gridVisible);

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
          color: new THREE.Color(0xffa400),
          opacity: 1,
          transparent: false,
          renderedFaces: FRAGS.RenderedFaces.TWO
        });

        highlighter.styles.set("status_PEDIDO", { 
          color: new THREE.Color(0x3b82f6),
          opacity: 1,
          transparent: false,
          renderedFaces: FRAGS.RenderedFaces.TWO
        });
        highlighter.styles.set("status_COMPRADO", { 
          color: new THREE.Color(0xffa400),
          opacity: 1,
          transparent: false,
          renderedFaces: FRAGS.RenderedFaces.TWO
        });
        highlighter.styles.set("status_EN_BODEGA", { 
          color: new THREE.Color(0xa78bfa),
          opacity: 1,
          transparent: false,
          renderedFaces: FRAGS.RenderedFaces.TWO
        });
        highlighter.styles.set("status_INSTALADO", { 
          color: new THREE.Color(0x22c55e),
          opacity: 1,
          transparent: false,
          renderedFaces: FRAGS.RenderedFaces.TWO
        });
        highlighter.styles.set("status_PENDIENTE", { 
          color: new THREE.Color(0x9ca3af),
          opacity: 1,
          transparent: false,
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
          const resolved = allElements.find((e) => String(e.modelId) === String(modelId) && Number(e.localId) === Number(itemId));
          onElementSelect(resolved ? resolved.id : itemId.toString());
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

    const update = async (seq: number) => {
      if (seq !== updateSeqRef.current) return;
      const list: Map<string, any> | undefined = (fragments as any).list;
      const models = Array.from(list?.values?.() ?? []);
      if (models.length === 0) return;

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

      finalVisible = finalVisible.filter((e) => {
        const st = statuses[e.id] ?? 'PENDIENTE';
        return statusVisibility[st] !== false;
      });

      const totalCount = allElements.length;
      const visibleCount = finalVisible.length;
      const hiddenCount = Math.max(0, totalCount - visibleCount);

      const shouldShowAll = !filterActive && !isolateSelection;
      if (shouldShowAll) {
        if (seq !== updateSeqRef.current) return;
        if (allHiddenRef.current) {
          try {
            await hider.set(true);
          } catch {
          }
          allHiddenRef.current = false;
          hiddenMapRef.current = {};
        } else if (!OBC.ModelIdMapUtils.isEmpty(hiddenMapRef.current)) {
          try {
            await hider.set(true, hiddenMapRef.current);
          } catch {
          }
          hiddenMapRef.current = {};
        }
      } else if (visibleCount === 0) {
        if (seq !== updateSeqRef.current) return;
        try {
          await hider.set(false);
        } catch {
        }
        allHiddenRef.current = true;
        hiddenMapRef.current = {};
      } else {
        const visibleSet = new Set(finalVisible.map((x) => x.id));
        const hiddenElements = allElements.filter((e) => !visibleSet.has(e.id));
        const { map: visibleMap, hasAny: hasAnyVisible } = buildModelIdMapFromElements(finalVisible);
        const { map: nextHiddenMap } = buildModelIdMapFromElements(hiddenElements);

        if (seq !== updateSeqRef.current) return;

        if (allHiddenRef.current) {
          if (hasAnyVisible) {
            try {
              await hider.set(true, visibleMap);
            } catch {
            }
          }
          allHiddenRef.current = false;
          hiddenMapRef.current = nextHiddenMap;
        } else {
          const prevHidden = hiddenMapRef.current;
          const toShow = OBC.ModelIdMapUtils.clone(prevHidden);
          OBC.ModelIdMapUtils.remove(toShow, nextHiddenMap);

          const toHide = OBC.ModelIdMapUtils.clone(nextHiddenMap);
          OBC.ModelIdMapUtils.remove(toHide, prevHidden);

          if (seq !== updateSeqRef.current) return;
          if (!OBC.ModelIdMapUtils.isEmpty(toShow)) {
            try {
              await hider.set(true, toShow);
            } catch {
            }
          }
          if (seq !== updateSeqRef.current) return;
          if (!OBC.ModelIdMapUtils.isEmpty(toHide)) {
            try {
              await hider.set(false, toHide);
            } catch {
            }
          }
          hiddenMapRef.current = nextHiddenMap;
        }
      }

      try {
        await highlighter.clear('select');
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

      for (const { style } of statusToStyle) {
        try {
          await highlighter.clear(style);
        } catch {
        }
      }

      if (statusColorsEnabled) {
        for (const { key, style, enabled } of statusToStyle) {
          if (!enabled) continue;
          const els = byStatus[key];
          if (!els || els.length === 0) continue;
          const { map, hasAny } = buildModelIdMapFromElements(els);
          if (!hasAny) continue;
          if (seq !== updateSeqRef.current) return;
          try {
            await highlighter.highlightByID(style, map, true, false, null, false);
          } catch {
          }
        }
      }

      if (hasSelection) {
        const selectedElements = allElements.filter((e) => selectedIdSet.has(e.id));
        const { map, hasAny } = buildModelIdMapFromElements(selectedElements);
        if (hasAny) {
          if (seq !== updateSeqRef.current) return;
          try {
            await highlighter.highlightByID("select", map, true, false, null, false);
          } catch {
          }
        }
      }
    };

    const seq = ++updateSeqRef.current;
    void update(seq);
  }, [allElements, isInitialized, isIsolateMode, selectedElementId, selectedElementIds, statusColorsEnabled, statusVisibility, statuses, visibleElements]);

  return (
    <div className="relative w-full h-full bg-white">
      <div ref={containerRef} className="w-full h-full" />
      
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-50">
          <Loader2 className="w-12 h-12 text-[#024959] animate-spin mb-4" />
          <p className="text-slate-600 font-medium">Cargando modelo BIM...</p>
          <p className="text-slate-400 text-xs mt-2">Procesando fragmentos y geometrías</p>
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
          className="bg-[#024959] text-white px-4 py-2 rounded-full shadow-lg border border-[#003E52] text-[10px] font-bold uppercase tracking-widest hover:bg-[#003E52] transition-all"
        >
          Enfocar Filtrados
        </button>
      </div>

      <div className="absolute bottom-6 left-6 flex gap-2">
        {statusButtons.map((s) => {
          const enabled = statusVisibility[s.key] !== false;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setStatusVisibility((prev) => ({ ...prev, [s.key]: !(prev[s.key] !== false) }))}
              className={`px-3 py-2 rounded-full shadow-lg border text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
                enabled ? 'bg-white/90 backdrop-blur-md border-white text-slate-700' : 'bg-white/70 backdrop-blur-md border-white text-slate-400'
              }`}
              title={enabled ? `Ocultar ${s.label}` : `Mostrar ${s.label}`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span>{s.label}</span>
              {enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
