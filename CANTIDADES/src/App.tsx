import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as FRAGS from '@thatopen/fragments';
import BIMViewer from './components/BIMViewer';
import { BIMElement, CategorySummary } from './types';
import { Upload, Box, Folder, File, ChevronDown, ChevronRight, RefreshCw, Eye, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import Sidebar from './components/Sidebar';
import LevelGrid from './components/LevelGrid';
import DataTable from './components/DataTable';

const PRIORITY_PROPS = [
  "AREA INTEGRADO",
  "LONGITUD INTEGRADO",
  "MATERIAL INTEGRADO",
  "NIVEL INTEGRADO",
  "NOMBRE INTEGRADO",
  "VOLUMEN INTEGRADO",
  "DETALLE",
  "CLASIFICACIÓN"
];

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

type RemoteModel = {
  name: string;
  fragUrl: string;
  jsonUrl?: string;
  group: string;
};

type PurchaseStatus = 'PENDIENTE' | 'PEDIDO' | 'COMPRADO' | 'EN BODEGA' | 'INSTALADO';

const GITHUB_REPO = {
  owner: 'alcabama-commits',
  repo: 'bim',
  branch: 'main',
  modelsPath: 'docs/VSR_IFC/models'
};

const rawUrlFor = (path: string) =>
  `https://raw.githubusercontent.com/${GITHUB_REPO.owner}/${GITHUB_REPO.repo}/${GITHUB_REPO.branch}/${path.split('/').map(encodeURIComponent).join('/')}`;

export default function App() {
  const [elements, setElements] = useState<BIMElement[]>([]);
  const [summaries, setSummaries] = useState<CategorySummary[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const componentsRef = useRef<OBC.Components | null>(null);
  const remoteCacheRef = useRef<{
    fragBytesByUrl: Map<string, Uint8Array>;
    jsonTextByUrl: Map<string, string>;
  }>({
    fragBytesByUrl: new Map(),
    jsonTextByUrl: new Map()
  });
  const loadAbortRef = useRef<AbortController | null>(null);

  const [availableModels, setAvailableModels] = useState<RemoteModel[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [isModelsLoading, setIsModelsLoading] = useState(false);
  const [selectedRemoteModelName, setSelectedRemoteModelName] = useState<string | null>(null);
  const [elementStatuses, setElementStatuses] = useState<Record<string, PurchaseStatus>>({});

  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    const stored = Number(localStorage.getItem('cantidades:leftPanelWidth'));
    return Number.isFinite(stored) && stored > 0 ? stored : 300;
  });
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    const stored = Number(localStorage.getItem('cantidades:rightPanelWidth'));
    return Number.isFinite(stored) && stored > 0 ? stored : 320;
  });
  const [tablePanelHeight, setTablePanelHeight] = useState(() => {
    const stored = Number(localStorage.getItem('cantidades:tablePanelHeight'));
    return Number.isFinite(stored) && stored > 0 ? stored : 320;
  });
  const [isTableMaximized, setIsTableMaximized] = useState(false);

  // Filter states
  const [selectedClassifications, setSelectedClassifications] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedDiameter, setSelectedDiameter] = useState<string>('Todos');
  const [isIsolateMode, setIsIsolateMode] = useState(false);

  const statusStorageKey = useMemo(() => {
    const base = selectedRemoteModelName ? selectedRemoteModelName.replace(/\.frag$/i, '') : 'local';
    const safe = base.trim().toLowerCase();
    return `cantidades:statuses:${safe}`;
  }, [selectedRemoteModelName]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(statusStorageKey);
      if (!raw) {
        setElementStatuses({});
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const allowed: PurchaseStatus[] = ['PENDIENTE', 'PEDIDO', 'COMPRADO', 'EN BODEGA', 'INSTALADO'];
      const normalize = (v: unknown): PurchaseStatus | null => {
        const s = String(v ?? '').trim().toUpperCase();
        if (s === 'EN SITIO') return 'INSTALADO';
        if (s === 'EN_BODEGA') return 'EN BODEGA';
        if (allowed.includes(s as PurchaseStatus)) return s as PurchaseStatus;
        return null;
      };
      if (parsed && typeof parsed === 'object') {
        const next: Record<string, PurchaseStatus> = {};
        for (const [k, v] of Object.entries(parsed)) {
          const st = normalize(v);
          if (st) next[k] = st;
        }
        setElementStatuses(next);
      } else {
        setElementStatuses({});
      }
    } catch {
      setElementStatuses({});
    }
  }, [statusStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(statusStorageKey, JSON.stringify(elementStatuses));
    } catch {
    }
  }, [elementStatuses, statusStorageKey]);

  useEffect(() => {
    localStorage.setItem('cantidades:leftPanelWidth', String(leftPanelWidth));
  }, [leftPanelWidth]);

  useEffect(() => {
    localStorage.setItem('cantidades:rightPanelWidth', String(rightPanelWidth));
  }, [rightPanelWidth]);

  useEffect(() => {
    localStorage.setItem('cantidades:tablePanelHeight', String(tablePanelHeight));
  }, [tablePanelHeight]);

  const startHorizontalDrag = useCallback((startEvent: React.PointerEvent, onDeltaX: (dx: number) => void) => {
    startEvent.preventDefault();
    const startX = startEvent.clientX;
    const move = (e: PointerEvent) => onDeltaX(e.clientX - startX);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, []);

  const startVerticalDrag = useCallback((startEvent: React.PointerEvent, onDeltaY: (dy: number) => void) => {
    startEvent.preventDefault();
    const startY = startEvent.clientY;
    const move = (e: PointerEvent) => onDeltaY(e.clientY - startY);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, []);

  const getProp = (el: BIMElement, key: string) => {
    if (!el.properties) return undefined;
    const val = el.properties[key];
    if (val === undefined || val === null) return undefined;
    
    // Si es un objeto con 'value', extraerlo
    if (typeof val === 'object' && val !== null) {
      if ('value' in val) return String(val.value);
      if ('NominalValue' in val) {
        const nv = val.NominalValue;
        return (typeof nv === 'object' && nv !== null && 'value' in nv) ? String(nv.value) : String(nv);
      }
      if ('QuantityValue' in val) {
        const qv = val.QuantityValue;
        return (typeof qv === 'object' && qv !== null && 'value' in qv) ? String(qv.value) : String(qv);
      }
    }
    return String(val);
  };

  const getFirstProp = (el: BIMElement, keys: string[]) => {
    for (const key of keys) {
      const v = getProp(el, key);
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
    }
    return undefined;
  };

  const fetchAvailableModels = useCallback(async () => {
    setIsModelsLoading(true);
    setModelsError(null);
    try {
      const url = `https://api.github.com/repos/${GITHUB_REPO.owner}/${GITHUB_REPO.repo}/contents/${GITHUB_REPO.modelsPath}?ref=${GITHUB_REPO.branch}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/vnd.github+json' }
      });
      if (!res.ok) {
        throw new Error(`No se pudo listar modelos (${res.status})`);
      }
      const data = (await res.json()) as Array<{ type: string; name: string; path: string }>;
      const files = data.filter((item) => item.type === 'file');
      const fragFiles = files.filter((f) => f.name.toLowerCase().endsWith('.frag'));
      const jsonByBase = new Map<string, string>();
      files
        .filter((f) => f.name.toLowerCase().endsWith('.json'))
        .forEach((f) => {
          const base = f.name.slice(0, -'.json'.length);
          jsonByBase.set(base.toLowerCase(), f.path);
        });

      const nextModels: RemoteModel[] = fragFiles
        .map((f) => {
          const base = f.name.slice(0, -'.frag'.length);
          const jsonPath = jsonByBase.get(base.toLowerCase());
          const group = /estructura/i.test(f.name) ? 'ESTRUCTURA' : 'GENERAL';
          return {
            name: f.name,
            fragUrl: rawUrlFor(f.path),
            jsonUrl: jsonPath ? rawUrlFor(jsonPath) : undefined,
            group
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));

      setAvailableModels(nextModels);
    } catch (e) {
      setModelsError(e instanceof Error ? e.message : 'Error cargando modelos');
      setAvailableModels([]);
    } finally {
      setIsModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailableModels();
  }, [fetchAvailableModels]);

  const filteredElements = useMemo(() => {
    return elements.filter(el => {
      const classif = getFirstProp(el, ["CLASIFICACION", "CLASIFICACIÓN"]) || "SIN CLASIFICAR";
      const nombreIntegrado = getFirstProp(el, ["NOMBRE INTEGRADO"]) || el.name;
      const level = getProp(el, "NIVEL INTEGRADO") || "";
      const diameter = getFirstProp(el, ["Tamaño", "TAMAÑO", "TAMANO"]) || "";

      const classificationMatch = selectedClassifications.length === 0 || selectedClassifications.includes(classif);
      const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(nombreIntegrado);
      const levelMatch = selectedLevels.length === 0 || selectedLevels.includes(level);
      const diameterMatch = selectedDiameter === 'Todos' || diameter === selectedDiameter;

      return classificationMatch && categoryMatch && levelMatch && diameterMatch;
    });
  }, [elements, getFirstProp, selectedClassifications, selectedCategories, selectedDiameter, selectedLevels]);

  const sidebarData = useMemo(() => {
    const classificationMap: Record<string, Set<string>> = {};
    
    elements.forEach(el => {
      const classification = getFirstProp(el, ["CLASIFICACION", "CLASIFICACIÓN"]) || "SIN CLASIFICAR";
      const nombreIntegrado = getFirstProp(el, ["NOMBRE INTEGRADO"]) || el.name;

      if (!classificationMap[classification]) classificationMap[classification] = new Set();
      classificationMap[classification].add(nombreIntegrado);
    });

    return Object.entries(classificationMap).map(([classifName, categories]) => ({
      name: classifName,
      categories: Array.from(categories)
        .sort((a, b) => a.localeCompare(b, 'es'))
        .map((nombre) => ({
          name: nombre,
          children: []
        }))
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [elements, getFirstProp]);

  const levels = useMemo(() => {
    const levelSet = new Set<string>();
    elements.forEach(el => {
      const level = getProp(el, "NIVEL INTEGRADO");
      if (level) levelSet.add(level);
    });
    return Array.from(levelSet);
  }, [elements]);

  const diameters = useMemo(() => {
    const diameterSet = new Set<string>();
    elements.forEach(el => {
      const diameter = getFirstProp(el, ["Tamaño", "TAMAÑO", "TAMANO"]);
      if (diameter) diameterSet.add(diameter);
    });
    const asNumber = (v: string) => {
      const n = Number(String(v).replace(',', '.').replace(/[^\d.\-]/g, ''));
      return Number.isFinite(n) ? n : null;
    };
    return Array.from(diameterSet).sort((a, b) => {
      const na = asNumber(a);
      const nb = asNumber(b);
      if (na !== null && nb !== null) return na - nb;
      if (na !== null) return -1;
      if (nb !== null) return 1;
      return a.localeCompare(b, 'es');
    });
  }, [elements, getFirstProp]);

  const toggleClassification = (name: string) => {
    setSelectedClassifications(prev => 
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  };

  const toggleCategory = (name: string) => {
    setSelectedCategories(prev => 
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  };

  const toggleSubCategory = (name: string) => {
    setSelectedSubCategories(prev => 
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  };

  const toggleLevel = (level: string) => {
    setSelectedLevels(prev => 
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  };

  const processModel = useCallback(async (model: any) => {
    console.log("Procesando modelo cargado ID:", model.uuid || model.modelId);
    const extractedElements: BIMElement[] = [];
    const categoryMap: Record<string, { totalVolume: number; count: number }> = {};

    try {
      const ids = await model.getLocalIds();
      console.log(`Modelo con ${ids.length} elementos locales.`);

      // Intentar obtener datos básicos de los elementos
      const itemsData = await model.getItemsData(ids, {
        attributesDefault: true,
      });

      const getValue = (attr: any) => {
        if (attr === undefined || attr === null) return undefined;
        if (typeof attr === 'object') {
          if ('value' in attr) return attr.value;
          if ('NominalValue' in attr) {
            const nv = attr.NominalValue;
            return (nv && typeof nv === 'object' && 'value' in nv) ? nv.value : nv;
          }
          if ('QuantityValue' in attr) {
            const qv = attr.QuantityValue;
            return (qv && typeof qv === 'object' && 'value' in qv) ? qv.value : qv;
          }
        }
        return attr;
      };

      for (let i = 0; i < ids.length; i++) {
        const localId = ids[i];
        const data = itemsData[i] || {};
        
        // Extraer todos los IDs posibles para asegurar vinculación
        const rawId = getValue(data.expressID || data.ExpressID || data.id || localId);
        const expressId = rawId !== undefined && rawId !== null ? rawId.toString() : localId.toString();
        
        const rawGlobalId = getValue(data.GlobalId || data.globalId || data.guid || data.Guid || data.GlobalID);
        const globalId = rawGlobalId?.toString();
        
        const rawCategory = getValue(data.type || data.ifcType || data.Category || data.ObjectType || 'Elemento');
        const category = (rawCategory !== undefined && rawCategory !== null ? rawCategory : 'Elemento').toString();
        const rawName = getValue(data.Name || data.name);
        const name = (rawName !== undefined && rawName !== null ? rawName : `${category} - ${expressId}`).toString();
        const volume = 0;

        extractedElements.push({
          id: expressId, 
          globalId: globalId,
          name,
          category,
          volume: volume,
          unit: 'm³',
          properties: { ...data },
          modelId: model.uuid || model.id || model.modelId,
          localId: localId
        });

        if (!categoryMap[category]) {
          categoryMap[category] = { totalVolume: 0, count: 0 };
        }
        categoryMap[category].count += 1;
        categoryMap[category].totalVolume += volume;
      }

      setElements(extractedElements);
      setSummaries(Object.entries(categoryMap).map(([category, data]) => ({
        category,
        totalVolume: data.totalVolume,
        count: data.count
      })));
      
      console.log(`Preparados ${extractedElements.length} elementos para vinculación.`);
    } catch (err) {
      console.error("Error en processModel:", err);
    }
  }, []);

  const handleModelLoaded = useCallback((components: OBC.Components) => {
    componentsRef.current = components;
  }, []);

  const clearScene = async () => {
    console.log("Limpiando escena...");
    if (!componentsRef.current) return;
    const fragments = componentsRef.current.get(OBC.FragmentsManager);
    
    // En v3, usamos fragments.list y fragments.core.disposeModel()
    const modelIds = Array.from((fragments as any).list?.keys?.() ?? []);
    for (const id of modelIds) {
      await fragments.core.disposeModel(id);
    }
    
    // También limpiar cualquier grupo manual (como el de ejemplo)
    const worlds = componentsRef.current.get(OBC.Worlds);
    const world = worlds.list.values().next().value;
    if (world) {
      const toRemove: THREE.Object3D[] = [];
      world.scene.three.traverse((obj) => {
        if (obj instanceof THREE.Group && obj.name === "SampleGroup") {
          toRemove.push(obj);
        }
      });
      toRemove.forEach(obj => {
        world.scene.three.remove(obj);
        console.log("Removido objeto de ejemplo.");
      });
    }
    setElements([]);
    setSummaries([]);
  };

  const applyJsonText = useCallback(async (text: string) => {
    const rawData = JSON.parse(text);
    let propertiesMap: Record<string, any> = {};

    if (Array.isArray(rawData)) {
      rawData.forEach(item => {
        const id = item.ExpressID || item.expressID || item.id || item.Id || item.GlobalId || item.globalId || item.Guid || item.GUID;
        if (id !== undefined && id !== null) {
          propertiesMap[id.toString()] = item;
        }
      });
    } else {
      propertiesMap = rawData;
    }

    const targetsLowerToOriginal = PRIORITY_PROPS.reduce<Record<string, string>>((acc, p) => {
      acc[p.trim().toLowerCase()] = p;
      return acc;
    }, {});
    const targetKeySet = new Set(Object.keys(targetsLowerToOriginal));

    const unwrap = (attr: any) => {
      if (attr === undefined || attr === null) return undefined;
      if (typeof attr === 'object') {
        if ('value' in attr) return attr.value;
        if ('NominalValue' in attr) {
          const nv = attr.NominalValue;
          return (nv && typeof nv === 'object' && 'value' in nv) ? nv.value : nv;
        }
        if ('QuantityValue' in attr) {
          const qv = attr.QuantityValue;
          return (qv && typeof qv === 'object' && 'value' in qv) ? qv.value : qv;
        }
      }
      return attr;
    };

    const extractIntegrated = (root: any) => {
      const integratedProps: Record<string, any> = {};
      let foundVolume: number | null = null;
      let foundName: string | null = null;

      const stack: any[] = [root];
      const seen = new WeakSet<object>();
      let nodes = 0;
      const maxNodes = 8000;

      while (stack.length > 0 && nodes < maxNodes) {
        const cur = stack.pop();
        if (!cur) continue;
        const t = typeof cur;
        if (t !== 'object') continue;
        if (seen.has(cur as object)) continue;
        seen.add(cur as object);
        nodes++;

        if (Array.isArray(cur)) {
          for (let i = 0; i < cur.length; i++) stack.push(cur[i]);
          continue;
        }

        for (const key in cur) {
          const rawVal = (cur as any)[key];
          const kl = key.trim().toLowerCase();

          if (targetKeySet.has(kl)) {
            const original = targetsLowerToOriginal[kl];
            if (integratedProps[original] === undefined) {
              const v = unwrap(rawVal);
              if (v !== undefined) integratedProps[original] = v;
            }
          }

          if (foundVolume === null && (kl.includes('volumen') || kl.includes('volume'))) {
            const v = unwrap(rawVal);
            const n = typeof v === 'number' ? v : Number(v);
            if (Number.isFinite(n) && n > 0) foundVolume = n;
          }

          if (foundName === null && kl.includes('nombre') && (kl.includes('integrado') || kl === 'nombre')) {
            const v = unwrap(rawVal);
            if (v !== undefined && v !== null) foundName = String(v);
          }

          if (rawVal && typeof rawVal === 'object') stack.push(rawVal);
        }

        if (Object.keys(integratedProps).length >= PRIORITY_PROPS.length && foundVolume !== null && foundName !== null) {
          break;
        }
      }

      const volVal = integratedProps["VOLUMEN INTEGRADO"];
      if (volVal !== undefined) {
        const n = typeof volVal === 'number' ? volVal : Number(volVal);
        if (Number.isFinite(n) && n > 0) foundVolume = n;
      }

      const nameVal = integratedProps["NOMBRE INTEGRADO"];
      if (nameVal !== undefined && nameVal !== null) foundName = String(nameVal);

      return { integratedProps, foundVolume, foundName };
    };

    setElements(prevElements => {
      if (prevElements.length === 0) return prevElements;

      const updatedElements = prevElements.map(el => {
        let props = propertiesMap[el.id];
        if (!props && el.globalId) {
          props = propertiesMap[el.globalId];
        }
        if (!props) return el;
        const { integratedProps, foundVolume, foundName } = extractIntegrated(props);
        const updatedEl = {
          ...el,
          properties: { ...el.properties, ...props, ...integratedProps }
        };

        if (foundVolume !== null) {
          updatedEl.volume = foundVolume;
        }
        if (foundName) {
          updatedEl.name = foundName;
        }

        return updatedEl;
      });

      const newCategoryMap: Record<string, { totalVolume: number; count: number }> = {};
      updatedElements.forEach(el => {
        if (!newCategoryMap[el.category]) {
          newCategoryMap[el.category] = { totalVolume: 0, count: 0 };
        }
        newCategoryMap[el.category].totalVolume += el.volume;
        newCategoryMap[el.category].count += 1;
      });

      setSummaries(Object.entries(newCategoryMap).map(([category, data]) => ({
        category,
        totalVolume: data.totalVolume,
        count: data.count
      })));

      return updatedElements;
    });
  }, []);

  const handleJsonUpload = async (file: File) => {
    setIsLoading(true);
    try {
      await applyJsonText(await file.text());
    } catch (error) {
      console.error("Error procesando JSON:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFragBytes = useCallback(async (fragName: string, bytes: Uint8Array) => {
    if (!componentsRef.current) return null;
    await clearScene();
    const fragments = componentsRef.current.get(OBC.FragmentsManager);

    if (!fragments.initialized) {
      let attempts = 0;
      while (!fragments.initialized && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      if (!fragments.initialized) {
        throw new Error("No se pudo inicializar FragmentsManager. Revisa la carga del worker.");
      }
    }

    const model = await withTimeout<any>(
      fragments.core.load(bytes, { modelId: fragName }),
      60000,
      "Tiempo de espera agotado cargando el archivo .frag"
    );

    if (!model) return null;

    const worlds = componentsRef.current.get(OBC.Worlds);
    const world = worlds.list.values().next().value;
    if (!world) return model;

    const modelObject = model.object ?? model;

    try {
      if (model.uuid !== fragName) model.uuid = fragName;
    } catch {
    }

    try {
      if (typeof model.useCamera === 'function') model.useCamera(world.camera.three);
    } catch {
    }

    try {
      const list = (fragments as any).list;
      if (list?.set && !list.has?.(model.uuid)) list.set(model.uuid, model);
    } catch {
    }

    if (!world.scene.three.children.includes(modelObject)) {
      world.scene.three.add(modelObject);
    }

    try {
      (modelObject as any).traverse?.((child: any) => {
        if (child?.isMesh) {
          world.meshes?.add?.(child);
          if (componentsRef.current?.meshes && Array.isArray((componentsRef.current as any).meshes)) {
            (componentsRef.current as any).meshes.push(child);
          }
        }
      });
    } catch {
    }

    try {
      await fragments.core.update(true);
    } catch {
    }

    setTimeout(() => {
      if (world.camera.hasCameraControls()) {
        const bbox = new THREE.Box3().setFromObject(modelObject);
        const sphere = new THREE.Sphere();
        bbox.getBoundingSphere(sphere);
        world.camera.controls.fitToSphere(sphere, true);
      }
      try {
        fragments.core.update(true);
      } catch {
      }
    }, 300);

    await processModel(model);
    return model;
  }, [processModel]);

  const putLru = <T,>(map: Map<string, T>, key: string, value: T, maxEntries: number) => {
    if (map.has(key)) map.delete(key);
    map.set(key, value);
    while (map.size > maxEntries) {
      const firstKey = map.keys().next().value as string | undefined;
      if (firstKey === undefined) break;
      map.delete(firstKey);
    }
  };

  const idbPromiseRef = useRef<Promise<IDBDatabase> | null>(null);

  const openDiskCache = () => {
    if (!('indexedDB' in window)) return null;
    if (idbPromiseRef.current) return idbPromiseRef.current;

    idbPromiseRef.current = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('cantidades-model-cache-v1', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('frag')) db.createObjectStore('frag', { keyPath: 'url' });
        if (!db.objectStoreNames.contains('json')) db.createObjectStore('json', { keyPath: 'url' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return idbPromiseRef.current;
  };

  const idbGet = async <T,>(storeName: 'frag' | 'json', url: string): Promise<T | null> => {
    try {
      const dbPromise = openDiskCache();
      if (!dbPromise) return null;
      const db = await dbPromise;
      return await new Promise<T | null>((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(url);
        req.onsuccess = () => resolve((req.result as T) ?? null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  };

  const idbPut = async (storeName: 'frag' | 'json', record: any, maxEntries: number) => {
    try {
      const dbPromise = openDiskCache();
      if (!dbPromise) return;
      const db = await dbPromise;
      await new Promise<void>((resolve) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.objectStore(storeName).put(record);
      });

      const all = await new Promise<any[]>((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve((req.result as any[]) ?? []);
        req.onerror = () => resolve([]);
      });
      if (all.length <= maxEntries) return;

      all.sort((a, b) => Number(a?.ts ?? 0) - Number(b?.ts ?? 0));
      const toDelete = all.slice(0, Math.max(0, all.length - maxEntries));
      await new Promise<void>((resolve) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        const store = tx.objectStore(storeName);
        toDelete.forEach((r) => {
          if (r?.url) store.delete(r.url);
        });
      });
    } catch {
    }
  };

  const fetchArrayBufferCached = useCallback(async (url: string, signal?: AbortSignal) => {
    const mem = remoteCacheRef.current.fragBytesByUrl.get(url);
    if (mem) return mem;

    const disk = await idbGet<{ url: string; ts: number; data: ArrayBuffer }>('frag', url);
    if (disk?.data) {
      const bytes = new Uint8Array(disk.data);
      putLru(remoteCacheRef.current.fragBytesByUrl, url, bytes, 2);
      void idbPut('frag', { url, ts: Date.now(), data: disk.data }, 6);
      return bytes;
    }

    if ('caches' in window) {
      try {
        const cache = await caches.open('cantidades-models-v1');
        const match = await cache.match(url);
        if (match) {
          const bytes = new Uint8Array(await match.arrayBuffer());
          putLru(remoteCacheRef.current.fragBytesByUrl, url, bytes, 2);
          const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
          void idbPut('frag', { url, ts: Date.now(), data: buffer }, 6);
          return bytes;
        }
      } catch {
      }
    }

    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`No se pudo descargar ${url} (${res.status})`);
    if ('caches' in window) {
      try {
        const cache = await caches.open('cantidades-models-v1');
        await cache.put(url, res.clone());
      } catch {
      }
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    putLru(remoteCacheRef.current.fragBytesByUrl, url, bytes, 2);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    void idbPut('frag', { url, ts: Date.now(), data: buffer }, 6);
    return bytes;
  }, []);

  const fetchTextCached = useCallback(async (url: string, signal?: AbortSignal) => {
    const mem = remoteCacheRef.current.jsonTextByUrl.get(url);
    if (mem) return mem;

    const disk = await idbGet<{ url: string; ts: number; data: string }>('json', url);
    if (disk?.data) {
      putLru(remoteCacheRef.current.jsonTextByUrl, url, disk.data, 2);
      void idbPut('json', { url, ts: Date.now(), data: disk.data }, 6);
      return disk.data;
    }

    if ('caches' in window) {
      try {
        const cache = await caches.open('cantidades-models-v1');
        const match = await cache.match(url);
        if (match) {
          const text = await match.text();
          putLru(remoteCacheRef.current.jsonTextByUrl, url, text, 2);
          void idbPut('json', { url, ts: Date.now(), data: text }, 6);
          return text;
        }
      } catch {
      }
    }

    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`No se pudo descargar ${url} (${res.status})`);
    if ('caches' in window) {
      try {
        const cache = await caches.open('cantidades-models-v1');
        await cache.put(url, res.clone());
      } catch {
      }
    }
    const text = await res.text();
    putLru(remoteCacheRef.current.jsonTextByUrl, url, text, 2);
    void idbPut('json', { url, ts: Date.now(), data: text }, 6);
    return text;
  }, []);

  const loadRemoteModel = useCallback(async (remote: RemoteModel) => {
    if (!componentsRef.current) return;
    if (loadAbortRef.current) {
      loadAbortRef.current.abort();
    }
    const controller = new AbortController();
    loadAbortRef.current = controller;
    setIsLoading(true);
    setShowWelcome(false);
    setSelectedRemoteModelName(remote.name);
    try {
      const fragPromise = fetchArrayBufferCached(remote.fragUrl, controller.signal);
      const jsonPromise = remote.jsonUrl ? fetchTextCached(remote.jsonUrl, controller.signal) : Promise.resolve<string | null>(null);
      const [fragBytes, jsonText] = await Promise.all([fragPromise, jsonPromise]);

      if (controller.signal.aborted) return;
      await loadFragBytes(remote.name, fragBytes);

      if (controller.signal.aborted) return;
      if (jsonText) {
        await applyJsonText(jsonText);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      console.error('Error cargando modelo remoto:', e);
      alert(e instanceof Error ? e.message : 'Error cargando modelo remoto');
    } finally {
      setIsLoading(false);
    }
  }, [applyJsonText, fetchArrayBufferCached, fetchTextCached, loadFragBytes]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !componentsRef.current) return;

    const fileList = Array.from(files) as File[];
    const fragFile = fileList.find(f => f.name.toLowerCase().endsWith('.frag'));
    const jsonFile = fileList.find(f => f.name.toLowerCase().endsWith('.json'));

    if (!fragFile && !jsonFile) {
      alert("Por favor selecciona al menos un archivo .frag o .json");
      return;
    }

    setIsLoading(true);
    setShowWelcome(false);

    try {
      if (fragFile) {
        await loadFragBytes(fragFile.name, new Uint8Array(await fragFile.arrayBuffer()));
      }

      if (jsonFile) {
        await applyJsonText(await jsonFile.text());
      }
    } catch (error) {
      console.error('Error en la carga combinada:', error);
      alert('Error al procesar los archivos.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSample = async () => {
    if (!componentsRef.current) return;
    setIsLoading(true);
    setShowWelcome(false);
    await clearScene();
    
    const worlds = componentsRef.current.get(OBC.Worlds);
    const world = worlds.list.values().next().value;

    if (world) {
      const group = new THREE.Group();
      group.name = "SampleGroup";
      const mockCategories = ['Slabs', 'Walls', 'Columns', 'Beams'];
      const colors = [0x10b981, 0x3b82f6, 0xf59e0b, 0xef4444];

      for (let i = 0; i < 15; i++) {
        const catIdx = i % mockCategories.length;
        const geometry = new THREE.BoxGeometry(
          Math.random() * 2 + 1, 
          Math.random() * 3 + 1, 
          Math.random() * 2 + 1
        );
        const material = new THREE.MeshStandardMaterial({ 
          color: colors[catIdx],
          transparent: true,
          opacity: 0.9
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set((Math.random() - 0.5) * 10, Math.random() * 5, (Math.random() - 0.5) * 10);
        group.add(mesh);
      }

      world.scene.three.add(group);
      if (world.camera.hasCameraControls()) {
        world.camera.controls.fitToSphere(group, true);
      }
    }

    // Generar datos de ejemplo para el tablero
    const mockElements: BIMElement[] = [];
    const catMap: Record<string, { totalVolume: number; count: number }> = {};
    const mockLevels = ['1. NE 0.00 - CIMENTACIÓN', '2. NE +2.70 - PISO 2', '3. NE +5.12 - PISO 3', '4. NE +7.54 - PISO 4'];
    const mockMaterials = ['Concreto 3000 psi', 'Concreto 4000 psi', 'Acero A36'];
    const mockClassifications = ['OBRA GRUESA', 'TERMINACIONES', 'INSTALACIONES'];
    
    ['CIMENTACIÓN', 'COLUMNAS', 'VIGAS', 'LOSAS'].forEach((cat, cIdx) => {
      const classification = mockClassifications[cIdx % mockClassifications.length];
      const count = Math.floor(Math.random() * 5 + 3);
      let totalVol = 0;
      for (let i = 0; i < count; i++) {
        const vol = Math.random() * 5 + 2;
        totalVol += vol;
        const level = mockLevels[Math.floor(Math.random() * mockLevels.length)];
        const material = mockMaterials[Math.floor(Math.random() * mockMaterials.length)];
        const name = `${cat} Type ${i + 1}`;
        
        mockElements.push({ 
          id: crypto.randomUUID(), 
          name: name, 
          category: cat, 
          volume: vol, 
          unit: 'm³',
          properties: {
            "NOMBRE INTEGRADO": name,
            "NIVEL INTEGRADO": level,
            "MATERIAL INTEGRADO": material,
            "AREA INTEGRADO": (vol * 2.5).toFixed(2),
            "LONGITUD INTEGRADO": (vol * 1.5).toFixed(2),
            "VOLUMEN INTEGRADO": vol.toFixed(2),
            "DETALLE": `Detalle ${cat}-${i}`,
            "CLASIFICACIÓN": classification
          }
        });
      }
      catMap[cat] = { totalVolume: totalVol, count };
    });

    setElements(mockElements);
    setSummaries(Object.entries(catMap).map(([category, data]) => ({
      category,
      totalVolume: data.totalVolume,
      count: data.count
    })));
    
    setIsLoading(false);
  };

  const resetFilters = () => {
    setSelectedClassifications([]);
    setSelectedCategories([]);
    setSelectedSubCategories([]);
    setSelectedLevels([]);
    setSelectedDiameter('Todos');
  };

  const handleChangeStatus = useCallback((id: string, status: PurchaseStatus) => {
    setElementStatuses((prev) => {
      if (prev[id] === status) return prev;
      return { ...prev, [id]: status };
    });
  }, []);

  const handleChangeStatusMany = useCallback((ids: string[], status: PurchaseStatus) => {
    setElementStatuses((prev) => {
      let next: Record<string, PurchaseStatus> | null = null;
      for (const id of ids) {
        if (prev[id] !== status) {
          if (!next) next = { ...prev };
          next[id] = status;
        }
      }
      return next ?? prev;
    });
  }, []);

  const [expandedModelGroups, setExpandedModelGroups] = useState<Record<string, boolean>>({
    ESTRUCTURA: true,
    GENERAL: true
  });

  return (
    <div className="flex flex-col h-screen w-screen bg-white overflow-hidden font-sans">
      {/* Header */}
      <header className="h-20 flex items-center justify-between px-8 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-4">
          <div className="h-12 flex items-center">
             <span className="text-2xl font-black text-[#f27d26] tracking-tighter">ARTIS</span>
             <span className="text-xs font-bold text-slate-400 ml-1 uppercase tracking-widest mt-2">URBANO</span>
          </div>
        </div>
        
        <div className="flex-1 max-w-3xl mx-8">
          <div className="bg-[#003d4d] text-white py-1.5 px-6 rounded-sm text-center font-bold uppercase tracking-widest text-sm shadow-inner">
            {selectedRemoteModelName ? selectedRemoteModelName.replace(/\.frag$/i, '') : 'CANTIDADES'}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="h-10 flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
              <div className="w-4 h-4 bg-emerald-500 rounded-full" />
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">TRÉVOLY</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {!isTableMaximized && (
          <>
            <div
              className="bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden"
              style={{ width: leftPanelWidth }}
            >
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Modelos IFC</h3>
                <button
                  type="button"
                  onClick={fetchAvailableModels}
                  className="p-1 hover:bg-slate-200 rounded transition-colors"
                  title="Actualizar lista"
                >
                  {isModelsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {modelsError && (
                  <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg">
                    {modelsError}
                  </div>
                )}

                {!modelsError && availableModels.length === 0 && !isModelsLoading && (
                  <div className="p-3 text-xs text-slate-500">
                    No se encontraron modelos en {GITHUB_REPO.modelsPath}.
                  </div>
                )}

                {(['ESTRUCTURA', 'GENERAL'] as const).map((group) => {
                  const items = availableModels.filter((m) => m.group === group);
                  if (items.length === 0) return null;
                  const expanded = expandedModelGroups[group];
                  return (
                    <div key={group} className="mb-3">
                      <button
                        type="button"
                        onClick={() => setExpandedModelGroups((prev) => ({ ...prev, [group]: !prev[group] }))}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 text-left"
                      >
                        <Folder className="w-4 h-4 text-slate-500" />
                        <span className="flex-1 text-[10px] font-black text-slate-600 uppercase tracking-widest">{group}</span>
                        {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      </button>

                      {expanded && (
                        <div className="mt-1 space-y-1">
                          {items.map((m) => {
                            const isSelected = selectedRemoteModelName === m.name;
                            const isRowLoading = isLoading && isSelected;
                            return (
                              <button
                                key={m.name}
                                type="button"
                                onClick={() => loadRemoteModel(m)}
                                className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg border text-left transition-colors ${
                                  isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-transparent hover:bg-slate-50'
                                }`}
                                title={m.name}
                              >
                                <File className="w-4 h-4 text-slate-500" />
                                <span className="flex-1 text-[11px] text-slate-700 truncate">
                                  {m.name.replace(/\.frag$/i, '')}
                                </span>
                                {isRowLoading ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                ) : isSelected ? (
                                  <Eye className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <div className="w-4 h-4" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="w-1.5 bg-slate-100 hover:bg-blue-200 active:bg-blue-300 cursor-col-resize"
              onPointerDown={(e) => {
                const start = leftPanelWidth;
                startHorizontalDrag(e, (dx) => {
                  const next = Math.min(520, Math.max(220, start + dx));
                  setLeftPanelWidth(next);
                });
              }}
            />

            <div className="flex-1 flex flex-col overflow-hidden relative">
              <div className="flex-1 relative bg-slate-50">
                {showWelcome && !isLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <div className="bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-slate-200 max-w-md text-center pointer-events-auto">
                      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Box className="w-8 h-8 text-blue-600" />
                      </div>
                      <h2 className="text-2xl font-light text-slate-900 mb-2">Extractor de Cantidades</h2>
                      <p className="text-slate-500 text-sm mb-8">
                        Selecciona un modelo del menú izquierdo o carga archivos <b>.frag</b> + <b>.json</b>.
                      </p>
                      <div className="flex flex-col gap-3">
                        <button
                          onClick={loadSample}
                          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                        >
                          Cargar Modelo de Ejemplo
                        </button>
                        <label className="w-full py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-slate-50 transition-all cursor-pointer">
                          Subir Archivos
                          <input type="file" accept=".frag,.json" multiple className="hidden" onChange={handleFileUpload} />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <BIMViewer
                  onModelLoaded={handleModelLoaded}
                  elements={filteredElements}
                  isLoading={isLoading}
                  selectedElementId={selectedElementId || undefined}
                  selectedElementIds={selectedElementIds}
                  onElementSelect={setSelectedElementId}
                  isIsolateMode={isIsolateMode}
                />

                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  <button
                    onClick={() => setIsIsolateMode(!isIsolateMode)}
                    className={`p-2 rounded-lg shadow border transition-all flex items-center gap-2 ${isIsolateMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-white/90 backdrop-blur-md text-slate-700 border-slate-200 hover:bg-white'}`}
                    title={isIsolateMode ? "Desactivar Aislamiento" : "Activar Aislamiento"}
                  >
                    <div className={`w-2 h-2 rounded-full ${isIsolateMode ? 'bg-white animate-pulse' : 'bg-slate-300'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Aislar Selección</span>
                  </button>
                  <button
                    onClick={loadSample}
                    className="p-2 bg-white/90 backdrop-blur-md text-slate-700 rounded-lg shadow border border-slate-200 hover:bg-white transition-all"
                    title="Cargar Ejemplo"
                  >
                    <Box className="w-5 h-5 text-blue-600" />
                  </button>
                  <label className="p-2 bg-blue-600 text-white rounded-lg shadow shadow-blue-600/20 hover:bg-blue-700 transition-all cursor-pointer" title="Subir Archivos">
                    <Upload className="w-5 h-5" />
                    <input type="file" accept=".frag,.json" multiple className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>

              <LevelGrid
                levels={levels}
                selectedLevels={selectedLevels}
                onToggleLevel={toggleLevel}
              />

              <div
                className="h-2 bg-slate-100 hover:bg-blue-200 active:bg-blue-300 cursor-row-resize"
                onPointerDown={(e) => {
                  const start = tablePanelHeight;
                  startVerticalDrag(e, (dy) => {
                    const next = Math.min(600, Math.max(220, start - dy));
                    setTablePanelHeight(next);
                  });
                }}
              />

              <div className="flex flex-col border-t border-slate-200" style={{ height: tablePanelHeight }}>
                <div className="h-10 px-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tabla de cantidades</div>
                  <button
                    type="button"
                    onClick={() => setIsTableMaximized(true)}
                    className="p-1 hover:bg-slate-200 rounded transition-colors"
                    title="Maximizar"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
                <DataTable
                  elements={filteredElements}
                  onSelectElement={setSelectedElementId}
                  selectedElementId={selectedElementId || undefined}
                  selectedElementIds={selectedElementIds}
                  onSetSelectedElementIds={setSelectedElementIds}
                  statuses={elementStatuses}
                  onChangeStatus={handleChangeStatus}
                  onChangeStatusMany={handleChangeStatusMany}
                />
              </div>
            </div>

            <div
              className="w-1.5 bg-slate-100 hover:bg-blue-200 active:bg-blue-300 cursor-col-resize"
              onPointerDown={(e) => {
                const start = rightPanelWidth;
                startHorizontalDrag(e, (dx) => {
                  const next = Math.min(520, Math.max(260, start - dx));
                  setRightPanelWidth(next);
                });
              }}
            />

            <div style={{ width: rightPanelWidth }} className="h-full overflow-hidden">
              <Sidebar
                categories={sidebarData}
                selectedClassifications={selectedClassifications}
                selectedCategories={selectedCategories}
                selectedSubCategories={selectedSubCategories}
                onToggleClassification={toggleClassification}
                onToggleCategory={toggleCategory}
                onToggleSubCategory={toggleSubCategory}
                diameters={diameters}
                selectedDiameter={selectedDiameter}
                onDiameterChange={setSelectedDiameter}
                onResetFilters={resetFilters}
              />
            </div>
          </>
        )}

        {isTableMaximized && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-12 px-6 border-b border-slate-200 bg-white flex items-center justify-between">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tabla de cantidades</div>
              <button
                type="button"
                onClick={() => setIsTableMaximized(false)}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-2"
                title="Minimizar"
              >
                <Minimize2 className="w-4 h-4 text-slate-600" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Volver</span>
              </button>
            </div>
            <DataTable
              elements={filteredElements}
              onSelectElement={setSelectedElementId}
              selectedElementId={selectedElementId || undefined}
              selectedElementIds={selectedElementIds}
              onSetSelectedElementIds={setSelectedElementIds}
              statuses={elementStatuses}
              onChangeStatus={handleChangeStatus}
              onChangeStatusMany={handleChangeStatusMany}
            />
          </div>
        )}
      </div>
    </div>
  );
}
