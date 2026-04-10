import React, { useEffect, useMemo, useRef, useState, useCallback, useTransition } from 'react';
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as FRAGS from '@thatopen/fragments';
import BIMViewer from './components/BIMViewer';
import { BIMElement, CategorySummary } from './types';
import { Folder, File, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RefreshCw, Eye, EyeOff, Loader2, Maximize2, Minimize2, Palette, Grid3X3, SlidersHorizontal, Move } from 'lucide-react';
import Sidebar from './components/Sidebar';
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

type JsonpOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

const jsonpRequest = <T,>(url: URL, signalOrOptions?: AbortSignal | JsonpOptions): Promise<T> => {
  const options: JsonpOptions = signalOrOptions && typeof signalOrOptions === 'object' && 'signal' in signalOrOptions
    ? (signalOrOptions as JsonpOptions)
    : { signal: signalOrOptions as AbortSignal | undefined };
  const signal = options.signal;
  const timeoutMs = typeof options.timeoutMs === 'number' && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 30000;
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const cbName = `__jsonp_${Math.random().toString(36).slice(2)}`;
    url.searchParams.set('callback', cbName);

    const script = document.createElement('script');
    script.async = true;
    script.src = url.toString();

    let settled = false;
    let abortHandler: (() => void) | null = null;
    let timeoutId: number | null = null;

    const cleanup = () => {
      try {
        delete (window as any)[cbName];
      } catch {
        (window as any)[cbName] = undefined;
      }
      if (script.parentNode) script.parentNode.removeChild(script);
      script.onerror = null;
      if (signal && abortHandler) signal.removeEventListener('abort', abortHandler);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };

    (window as any)[cbName] = (data: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(data as T);
    };

    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Error cargando JSONP: ${script.src}`));
    };

    abortHandler = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal) signal.addEventListener('abort', abortHandler);

    timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Tiempo de espera agotado (JSONP). Revisa que el Web App responda como JavaScript con callback=... URL: ${script.src}`));
    }, timeoutMs);

    document.head.appendChild(script);
  });
};

type RemoteModel = {
  name: string;
  fragUrl: string;
  jsonUrl?: string;
  group: string;
  source?: 'github' | 'drive';
  fragId?: string;
  jsonId?: string;
};

type ConstructionStatus =
  | 'NINGUNO'
  | 'EN PROGRESO'
  | 'PARA INSPECCION'
  | 'APROBADO'
  | 'CERRADO'
  | 'RECHAZADO';

const GITHUB_REPO = {
  owner: 'alcabama-commits',
  repo: 'bim',
  branch: 'main',
  modelsPath: 'docs/VSR_IFC/models'
};

const DRIVE_MODELS_FOLDER_ID = '1fn1umYzIYsxymmwbmap6YbjTB33XJrG8';
const DRIVE_SCRIPT_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwz1XYlqzxUCLLsTeXsxW7uNzRiqRhT82OC_Y1dSt4iOvaWNFpAPWAZc74UE28iiwI/exec';
const STATUS_SHEET_ID = '1GSaNTuafarE8l7VFlJNLJcu0GIXaNUS-VDwJ9UB9038';

const rawUrlFor = (path: string) =>
  `https://raw.githubusercontent.com/${GITHUB_REPO.owner}/${GITHUB_REPO.repo}/${GITHUB_REPO.branch}/${path.split('/').map(encodeURIComponent).join('/')}`;

const normalizeClassification = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const isSinClasificar = (v: string | undefined | null) => {
  if (!v) return true;
  const n = normalizeClassification(String(v));
  return n === 'SIN CLASIFICAR' || n === 'SINCLASIFICAR' || n === 'SIN CLASIFICACION' || n === 'SINCLASIFICACION';
};

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
  const [elementStatuses, setElementStatuses] = useState<Record<string, ConstructionStatus>>({});
  const [elementHistory, setElementHistory] = useState<Record<string, Array<{ status: ConstructionStatus; at: string }>>>({});
  const [timelineIndexDraft, setTimelineIndexDraft] = useState<number | null>(null);
  const [timelineIndex, setTimelineIndex] = useState<number | null>(null);

  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    const stored = Number(localStorage.getItem('cantidades:leftPanelWidth'));
    return Number.isFinite(stored) && stored > 0 ? stored : 300;
  });
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    const stored = Number(localStorage.getItem('cantidades:rightPanelWidth'));
    return Number.isFinite(stored) && stored > 0 ? stored : 320;
  });
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(() => localStorage.getItem('cantidades:leftPanelCollapsed') === 'true');
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(() => localStorage.getItem('cantidades:rightPanelCollapsed') === 'true');
  const [tablePanelHeight, setTablePanelHeight] = useState(() => {
    const stored = Number(localStorage.getItem('cantidades:tablePanelHeight'));
    return Number.isFinite(stored) && stored > 0 ? stored : 320;
  });
  const [isTableVisible, setIsTableVisible] = useState(() => {
    const raw = localStorage.getItem('cantidades:isTableVisible');
    if (raw === null) return true;
    return raw === 'true';
  });
  const [isTableMaximized, setIsTableMaximized] = useState(false);
  const [isViewerMaximized, setIsViewerMaximized] = useState(false);
  const [isUpdatingApp, setIsUpdatingApp] = useState(false);
  const [isRefreshingProgress, setIsRefreshingProgress] = useState(false);
  const [isTableDocked, setIsTableDocked] = useState(() => localStorage.getItem('cantidades:isTableDocked') === 'true');
  const [timelineDayWidth, setTimelineDayWidth] = useState(() => {
    const v = Number(localStorage.getItem('cantidades:timelineDayWidth'));
    return Number.isFinite(v) && v >= 24 && v <= 64 ? v : 44;
  });
  const [timelineLevelsLevelColWidth, setTimelineLevelsLevelColWidth] = useState(() => {
    const v = Number(localStorage.getItem('cantidades:timelineLevelsLevelColWidth'));
    return Number.isFinite(v) && v >= 180 && v <= 600 ? v : 360;
  });
  const [timelineLevelsDayColWidth, setTimelineLevelsDayColWidth] = useState(() => {
    const v = Number(localStorage.getItem('cantidades:timelineLevelsDayColWidth'));
    return Number.isFinite(v) && v >= 90 && v <= 260 ? v : 160;
  });
  const [isMobileLayout, setIsMobileLayout] = useState(() => {
    try {
      return window.matchMedia('(max-width: 768px)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia('(max-width: 768px)');
    } catch {
      mq = null;
    }
    if (!mq) return;

    const onChange = () => setIsMobileLayout(mq?.matches ?? false);
    onChange();
    try {
      mq.addEventListener('change', onChange);
      return () => mq?.removeEventListener('change', onChange);
    } catch {
      mq.addListener(onChange);
      return () => mq?.removeListener(onChange);
    }
  }, []);

  useEffect(() => {
    if (!isMobileLayout) return;
    setLeftPanelCollapsed(true);
    setRightPanelCollapsed(true);
    setIsTableDocked(true);
  }, [isMobileLayout]);

  const updateApp = useCallback(async () => {
    if (isUpdatingApp) return;
    setIsUpdatingApp(true);
    try {
      if (!('serviceWorker' in navigator)) {
        window.location.reload();
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        window.location.reload();
        return;
      }

      const reload = () => window.location.reload();
      let reloaded = false;
      const onControllerChange = () => {
        if (reloaded) return;
        reloaded = true;
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        try {
          await reg.update();
        } catch {
        }
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      setTimeout(() => {
        if (reloaded) return;
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
        reload();
      }, 1500);
    } finally {
      setIsUpdatingApp(false);
    }
  }, [isUpdatingApp]);

  // Filter states
  const [selectedClassifications, setSelectedClassifications] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedDiameter, setSelectedDiameter] = useState<string>('Todos');
  const [selectedMaterial, setSelectedMaterial] = useState<string>('Todos');
  const [selectedPileNumbers, setSelectedPileNumbers] = useState<string[]>([]);
  const [appliedClassifications, setAppliedClassifications] = useState<string[]>([]);
  const [appliedCategories, setAppliedCategories] = useState<string[]>([]);
  const [appliedSubCategories, setAppliedSubCategories] = useState<string[]>([]);
  const [appliedLevels, setAppliedLevels] = useState<string[]>([]);
  const [appliedDiameter, setAppliedDiameter] = useState<string>('Todos');
  const [appliedMaterial, setAppliedMaterial] = useState<string>('Todos');
  const [appliedPileNumbers, setAppliedPileNumbers] = useState<string[]>([]);
  const [, startTransition] = useTransition();
  const [showPileNumberLabels, setShowPileNumberLabels] = useState(() => {
    const raw = localStorage.getItem('cantidades:showPileNumberLabels');
    if (raw === null) return false;
    return raw === 'true';
  });
  const [showTimelineLevelsDetail, setShowTimelineLevelsDetail] = useState(() => {
    const raw = localStorage.getItem('cantidades:showTimelineLevelsDetail');
    if (raw === null) return false;
    return raw === 'true';
  });
  const [isTimelineSummaryMaximized, setIsTimelineSummaryMaximized] = useState(false);
  const [isIsolateMode, setIsIsolateMode] = useState(false);
  const [statusColorsEnabled, setStatusColorsEnabled] = useState(() => {
    const raw = localStorage.getItem('cantidades:statusColorsEnabled');
    if (raw === null) return true;
    return raw === 'true';
  });
  const [statusVisibility, setStatusVisibility] = useState<Record<ConstructionStatus, boolean>>(() => {
    try {
      const raw = localStorage.getItem('cantidades:statusVisibility');
      if (!raw) {
        return { 'NINGUNO': true, 'EN PROGRESO': true, 'PARA INSPECCION': true, 'APROBADO': true, 'CERRADO': true, 'RECHAZADO': true };
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const pick = (k: string) => (typeof parsed[k] === 'boolean' ? (parsed[k] as boolean) : true);
      const hasNewKeys = ['NINGUNO', 'EN PROGRESO', 'PARA INSPECCION', 'APROBADO', 'CERRADO', 'RECHAZADO'].some((k) => k in parsed);
      if (!hasNewKeys) {
        return {
          'NINGUNO': pick('PENDIENTE'),
          'EN PROGRESO': pick('PEDIDO'),
          'PARA INSPECCION': pick('COMPRADO'),
          'APROBADO': true,
          'CERRADO': pick('INSTALADO'),
          'RECHAZADO': true
        };
      }
      return {
        'NINGUNO': pick('NINGUNO'),
        'EN PROGRESO': pick('EN PROGRESO'),
        'PARA INSPECCION': pick('PARA INSPECCION'),
        'APROBADO': pick('APROBADO'),
        'CERRADO': pick('CERRADO'),
        'RECHAZADO': pick('RECHAZADO')
      };
    } catch {
      return { 'NINGUNO': true, 'EN PROGRESO': true, 'PARA INSPECCION': true, 'APROBADO': true, 'CERRADO': true, 'RECHAZADO': true };
    }
  });
  const [gridVisible, setGridVisible] = useState(() => {
    const raw = localStorage.getItem('cantidades:gridVisible');
    if (raw === null) return true;
    return raw === 'true';
  });
  const [timelineBarOpen, setTimelineBarOpen] = useState(() => {
    const raw = localStorage.getItem('cantidades:timelineBarOpen');
    if (raw === null) return true;
    return raw === 'true';
  });

  useEffect(() => {
    try {
      localStorage.setItem('cantidades:statusVisibility', JSON.stringify(statusVisibility));
    } catch {
    }
  }, [statusVisibility]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      startTransition(() => {
        setAppliedClassifications(selectedClassifications);
        setAppliedCategories(selectedCategories);
        setAppliedSubCategories(selectedSubCategories);
        setAppliedLevels(selectedLevels);
        setAppliedDiameter(selectedDiameter);
        setAppliedMaterial(selectedMaterial);
        setAppliedPileNumbers(selectedPileNumbers);
      });
    }, 350);
    return () => window.clearTimeout(t);
  }, [selectedCategories, selectedClassifications, selectedDiameter, selectedLevels, selectedMaterial, selectedPileNumbers, selectedSubCategories, startTransition]);

  const isStructureModel = useMemo(() => {
    const name = selectedRemoteModelName ? selectedRemoteModelName.replace(/\.frag$/i, '') : '';
    return /estructura/i.test(name);
  }, [selectedRemoteModelName]);

  const statusStorageKey = useMemo(() => {
    const base = selectedRemoteModelName ? selectedRemoteModelName.replace(/\.frag$/i, '') : 'local';
    const safe = base.trim().toLowerCase();
    return `cantidades:statuses:${safe}`;
  }, [selectedRemoteModelName]);
  const historyStorageKey = useMemo(() => {
    const base = selectedRemoteModelName ? selectedRemoteModelName.replace(/\.frag$/i, '') : 'local';
    const safe = base.trim().toLowerCase();
    return `cantidades:history:${safe}`;
  }, [selectedRemoteModelName]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(statusStorageKey);
      if (!raw) {
        setElementStatuses({});
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const allowed: ConstructionStatus[] = ['NINGUNO', 'EN PROGRESO', 'PARA INSPECCION', 'APROBADO', 'CERRADO', 'RECHAZADO'];
      const normalize = (v: unknown): ConstructionStatus | null => {
        const s = String(v ?? '').trim().toUpperCase();
        if (s === 'PARA INSPECCIÓN') return 'PARA INSPECCION';
        if (allowed.includes(s as ConstructionStatus)) return s as ConstructionStatus;
        return null;
      };
      if (parsed && typeof parsed === 'object') {
        const next: Record<string, ConstructionStatus> = {};
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
    try {
      const raw = localStorage.getItem(historyStorageKey);
      if (!raw) {
        setElementHistory({});
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, Array<{ status: ConstructionStatus; at: string }>>;
      if (parsed && typeof parsed === 'object') setElementHistory(parsed);
      else setElementHistory({});
    } catch {
      setElementHistory({});
    }
  }, [historyStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(elementHistory));
    } catch {
    }
  }, [elementHistory, historyStorageKey]);

  const getModelKey = useCallback((modelName: string | null) => {
    const base = (modelName ?? '').replace(/\.frag$/i, '').trim();
    return base || 'local';
  }, []);

  const normalizeConstructionStatus = useCallback((v: unknown): ConstructionStatus | null => {
    const allowed: ConstructionStatus[] = ['NINGUNO', 'EN PROGRESO', 'PARA INSPECCION', 'APROBADO', 'CERRADO', 'RECHAZADO'];
    const s = String(v ?? '').trim().toUpperCase();
    if (s === 'PARA INSPECCIÓN') return 'PARA INSPECCION';
    if (allowed.includes(s as ConstructionStatus)) return s as ConstructionStatus;
    return null;
  }, []);

  const fetchRemoteStatuses = useCallback(async (modelName: string, signal?: AbortSignal) => {
    if (!DRIVE_SCRIPT_WEBAPP_URL) return;
    const url = new URL(DRIVE_SCRIPT_WEBAPP_URL);
    url.searchParams.set('action', 'status_get');
    url.searchParams.set('sheetId', STATUS_SHEET_ID);
    url.searchParams.set('model', getModelKey(modelName));
    const data = await jsonpRequest<{
      ok?: boolean;
      error?: string;
      statuses?: Record<string, unknown>;
      history?: Record<string, Array<{ status: unknown; at: unknown }>>;
      rows?: Array<{ id?: unknown; elementId?: unknown; status?: unknown; updatedAt?: unknown; at?: unknown }>;
    }>(url, { signal, timeoutMs: 30000 });

    if (!data || typeof data !== 'object') return;
    if (typeof (data as any).error === 'string' && String((data as any).error).trim()) {
      throw new Error(String((data as any).error));
    }

    const rawRows = (data as any).rows;
    if (Array.isArray(rawRows) && rawRows.length > 0) {
      const nextStatuses: Record<string, ConstructionStatus> = {};
      const nextHistory: Record<string, Array<{ status: ConstructionStatus; at: string }>> = {};
      for (const r of rawRows) {
        const id = String(r?.elementId ?? r?.id ?? '').trim();
        if (!id) continue;
        const st = normalizeConstructionStatus(r?.status);
        if (!st) continue;
        nextStatuses[id] = st;
        const at = String(r?.updatedAt ?? r?.at ?? '').trim();
        if (at) nextHistory[id] = [{ status: st, at }];
      }
      setElementStatuses(nextStatuses);
      setElementHistory(nextHistory);
      return;
    }

    const rawStatuses = (data as any).statuses;
    if (rawStatuses && typeof rawStatuses === 'object') {
      const nextStatuses: Record<string, ConstructionStatus> = {};
      for (const [id, stRaw] of Object.entries(rawStatuses as Record<string, unknown>)) {
        const st = normalizeConstructionStatus(stRaw);
        if (st) nextStatuses[id] = st;
      }
      setElementStatuses(nextStatuses);
      if (Object.keys(nextStatuses).length > 0) {
        const today = new Date().toISOString();
        const nextHistory: Record<string, Array<{ status: ConstructionStatus; at: string }>> = {};
        for (const [id, st] of Object.entries(nextStatuses)) {
          nextHistory[id] = [{ status: st as ConstructionStatus, at: today }];
        }
        setElementHistory(nextHistory);
      }
    }

    const rawHistory = (data as any).history;
    if (rawHistory && typeof rawHistory === 'object') {
      const nextHistory: Record<string, Array<{ status: ConstructionStatus; at: string }>> = {};
      for (const [id, entries] of Object.entries(rawHistory as Record<string, unknown>)) {
        if (!Array.isArray(entries)) continue;
        const arr: Array<{ status: ConstructionStatus; at: string }> = [];
        for (const e of entries as Array<any>) {
          const st = normalizeConstructionStatus(e?.status);
          const at = String(e?.at ?? '').trim();
          if (!st || !at) continue;
          arr.push({ status: st, at });
        }
        if (arr.length > 0) nextHistory[id] = arr;
      }
      setElementHistory(nextHistory);
    }
  }, [getModelKey, normalizeConstructionStatus]);

  const pendingRemoteStatusRef = useRef<Record<string, ConstructionStatus>>({});
  const remoteFlushTimerRef = useRef<number | null>(null);

  const flushRemoteStatuses = useCallback(async () => {
    if (!DRIVE_SCRIPT_WEBAPP_URL) return;
    const modelName = selectedRemoteModelName;
    if (!modelName) return;
    const modelKey = getModelKey(modelName);

    const pending = pendingRemoteStatusRef.current;
    const entries = Object.entries(pending);
    if (entries.length === 0) return;
    pendingRemoteStatusRef.current = {};

    try {
      const payload = {
        action: 'status_set',
        sheetId: STATUS_SHEET_ID,
        model: modelKey,
        updates: entries.map(([id, status]) => ({ id, status, at: new Date().toISOString() }))
      };

      await fetch(DRIVE_SCRIPT_WEBAPP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
    } catch {
      for (const [id, status] of entries) {
        pendingRemoteStatusRef.current[id] = status;
      }
    }
  }, [getModelKey, selectedRemoteModelName]);

  const scheduleRemoteSave = useCallback((id: string, status: ConstructionStatus) => {
    pendingRemoteStatusRef.current[id] = status;
    if (remoteFlushTimerRef.current !== null) return;
    remoteFlushTimerRef.current = window.setTimeout(() => {
      remoteFlushTimerRef.current = null;
      void flushRemoteStatuses();
    }, 800);
  }, [flushRemoteStatuses]);

  const refreshProgressFromSheet = useCallback(async () => {
    const modelName = selectedRemoteModelName;
    if (!modelName) return;
    if (isRefreshingProgress) return;
    setIsRefreshingProgress(true);
    try {
      await withTimeout(flushRemoteStatuses(), 15000, 'No se pudo sincronizar cambios pendientes');
      await withTimeout(fetchRemoteStatuses(modelName), 30000, 'No se pudo cargar avance desde Google Sheets');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo cargar avance desde Google Sheets');
    } finally {
      setIsRefreshingProgress(false);
    }
  }, [fetchRemoteStatuses, flushRemoteStatuses, isRefreshingProgress, selectedRemoteModelName]);

  const timelinePoints = useMemo(() => {
    const set = new Set<string>();
    const arrays = Object.values(elementHistory) as Array<Array<{ status: ConstructionStatus; at: string }>>;
    for (const arr of arrays) {
      for (const it of arr ?? []) {
        const d = new Date(it.at);
        if (isNaN(d.getTime())) continue;
        const key = d.toISOString().slice(0, 10);
        set.add(key);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [elementHistory]);

  const timelineDays = useMemo(() => {
    if (timelinePoints.length === 0) return [];
    const minKey = timelinePoints[0]!;
    const maxKey = timelinePoints[timelinePoints.length - 1]!;
    const minT = Date.parse(minKey + 'T00:00:00Z');
    const maxTHistory = Date.parse(maxKey + 'T00:00:00Z');
    const todayKey = new Date().toISOString().slice(0, 10);
    const maxTToday = Date.parse(todayKey + 'T00:00:00Z');
    const maxT = Math.max(maxTHistory, maxTToday);
    if (!Number.isFinite(minT) || !Number.isFinite(maxT) || maxT < minT) return [];
    const days: string[] = [];
    for (let t = minT; t <= maxT; t += 86400000) {
      const key = new Date(t).toISOString().slice(0, 10);
      days.push(key);
    }
    return days;
  }, [timelinePoints]);

  useEffect(() => {
    if (timelineDays.length === 0) {
      setTimelineIndexDraft(null);
      setTimelineIndex(null);
      return;
    }
    if (timelineIndexDraft !== null) {
      const clamped = Math.max(0, Math.min(timelineDays.length - 1, timelineIndexDraft));
      if (clamped !== timelineIndexDraft) setTimelineIndexDraft(clamped);
    }
    if (timelineIndex !== null) {
      const clamped = Math.max(0, Math.min(timelineDays.length - 1, timelineIndex));
      if (clamped !== timelineIndex) setTimelineIndex(clamped);
    }
  }, [timelineDays, timelineIndex, timelineIndexDraft]);

  useEffect(() => {
    if (timelineIndexDraft === null) {
      if (timelineIndex !== null) setTimelineIndex(null);
      return;
    }
    const raf = window.requestAnimationFrame(() => {
      setTimelineIndex(timelineIndexDraft);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [timelineIndexDraft, timelineIndex]);

  const timelineDate = useMemo(() => {
    if (timelineIndex === null) return null;
    return timelineDays[timelineIndex] ?? null;
  }, [timelineDays, timelineIndex]);

  const timelineMarkers = useMemo(() => {
    const getISOWeek = (date: Date) => {
      const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    };

    const months: Array<{ index: number; label: string }> = [];
    const weeks: Array<{ index: number; label: string }> = [];
    const days: Array<{ index: number; label: string }> = [];

    for (let i = 0; i < timelineDays.length; i += 1) {
      const key = timelineDays[i]!;
      const d = new Date(key + 'T00:00:00Z');
      if (isNaN(d.getTime())) continue;
      const day = d.getUTCDate();
      const dow = d.getUTCDay();
      if (i === 0 || day === 1) {
        const m = d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
        months.push({ index: i, label: m });
      }
      if (i === 0 || dow === 1) {
        weeks.push({ index: i, label: `W${String(getISOWeek(d)).padStart(2, '0')}` });
      }
      if (i === 0 || day === 1 || day % 5 === 0) {
        days.push({ index: i, label: String(day) });
      }
    }

    return { months, weeks, days };
  }, [timelineDays]);

  const viewerStatuses = useMemo(() => {
    if (!timelineDate) return elementStatuses;
    const target = new Date(timelineDate + 'T23:59:59.999Z').getTime();
    const next: Record<string, ConstructionStatus> = {};
    for (const el of elements) {
      const hist = elementHistory[el.id];
      if (!hist || hist.length === 0) continue;
      let chosen: ConstructionStatus | null = null;
      for (const entry of hist) {
        const t = new Date(entry.at).getTime();
        if (!isNaN(t) && t <= target) chosen = entry.status;
      }
      if (chosen) next[el.id] = chosen;
    }
    return next;
  }, [elementHistory, elementStatuses, elements, timelineDate]);

  useEffect(() => {
    localStorage.setItem('cantidades:leftPanelWidth', String(leftPanelWidth));
  }, [leftPanelWidth]);

  useEffect(() => {
    localStorage.setItem('cantidades:rightPanelWidth', String(rightPanelWidth));
  }, [rightPanelWidth]);

  useEffect(() => {
    localStorage.setItem('cantidades:leftPanelCollapsed', String(leftPanelCollapsed));
  }, [leftPanelCollapsed]);

  useEffect(() => {
    localStorage.setItem('cantidades:rightPanelCollapsed', String(rightPanelCollapsed));
  }, [rightPanelCollapsed]);

  useEffect(() => {
    localStorage.setItem('cantidades:tablePanelHeight', String(tablePanelHeight));
  }, [tablePanelHeight]);

  useEffect(() => {
    localStorage.setItem('cantidades:isTableVisible', String(isTableVisible));
  }, [isTableVisible]);

  useEffect(() => {
    localStorage.setItem('cantidades:isTableDocked', String(isTableDocked));
  }, [isTableDocked]);

  useEffect(() => {
    localStorage.setItem('cantidades:timelineDayWidth', String(timelineDayWidth));
  }, [timelineDayWidth]);

  useEffect(() => {
    localStorage.setItem('cantidades:timelineLevelsLevelColWidth', String(timelineLevelsLevelColWidth));
  }, [timelineLevelsLevelColWidth]);

  useEffect(() => {
    localStorage.setItem('cantidades:timelineLevelsDayColWidth', String(timelineLevelsDayColWidth));
  }, [timelineLevelsDayColWidth]);
  useEffect(() => {
    localStorage.setItem('cantidades:statusColorsEnabled', String(statusColorsEnabled));
  }, [statusColorsEnabled]);

  useEffect(() => {
    localStorage.setItem('cantidades:gridVisible', String(gridVisible));
  }, [gridVisible]);

  useEffect(() => {
    localStorage.setItem('cantidades:timelineBarOpen', String(timelineBarOpen));
  }, [timelineBarOpen]);

  useEffect(() => {
    localStorage.setItem('cantidades:showPileNumberLabels', String(showPileNumberLabels));
  }, [showPileNumberLabels]);

  useEffect(() => {
    localStorage.setItem('cantidades:showTimelineLevelsDetail', String(showTimelineLevelsDetail));
  }, [showTimelineLevelsDetail]);

  const startHorizontalDrag = useCallback((startEvent: React.PointerEvent, onDeltaX: (dx: number) => void) => {
    startEvent.preventDefault();
    const startX = startEvent.clientX;
    const move = (e: PointerEvent) => onDeltaX(e.clientX - startX);
    const up = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
  }, []);

  const getISOWeek = useCallback((date: Date) => {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }, []);

  const startVerticalDrag = useCallback((startEvent: React.PointerEvent, onDeltaY: (dy: number) => void) => {
    startEvent.preventDefault();
    const startY = startEvent.clientY;
    const move = (e: PointerEvent) => onDeltaY(e.clientY - startY);
    const up = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
  }, []);

  const getProp = useCallback((el: BIMElement, key: string) => {
    if (!el.properties) return undefined;

    const unwrap = (val: any) => {
      if (val === undefined || val === null) return undefined;
      if (typeof val === 'object') {
        if ('value' in val) return val.value;
        if ('NominalValue' in val) {
          const nv = val.NominalValue;
          return (typeof nv === 'object' && nv !== null && 'value' in nv) ? nv.value : nv;
        }
        if ('QuantityValue' in val) {
          const qv = val.QuantityValue;
          return (typeof qv === 'object' && qv !== null && 'value' in qv) ? qv.value : qv;
        }
      }
      return val;
    };

    const normalizeKey = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[_\-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

    const target = normalizeKey(key);

    const direct = (el.properties as any)[key];
    if (direct !== undefined && direct !== null) {
      const v = unwrap(direct);
      return v === undefined || v === null ? undefined : String(v);
    }

    const stack: any[] = [el.properties];
    const seen = new WeakSet<object>();
    let nodes = 0;
    const maxNodes = 12000;
    while (stack.length > 0 && nodes < maxNodes) {
      const cur = stack.pop();
      if (!cur || typeof cur !== 'object') continue;
      if (seen.has(cur as object)) continue;
      seen.add(cur as object);
      nodes++;

      if (Array.isArray(cur)) {
        for (let i = 0; i < cur.length; i++) stack.push(cur[i]);
        continue;
      }

      for (const k in cur) {
        const rawVal = (cur as any)[k];
        if (normalizeKey(String(k)) === target) {
          const v = unwrap(rawVal);
          return v === undefined || v === null ? undefined : String(v);
        }
        if (rawVal && typeof rawVal === 'object') stack.push(rawVal);
      }
    }

    return undefined;
  }, []);

  const getFirstProp = useCallback((el: BIMElement, keys: string[]) => {
    for (const key of keys) {
      const v = getProp(el, key);
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
    }
    return undefined;
  }, [getProp]);

  const fetchAvailableModels = useCallback(async () => {
    setIsModelsLoading(true);
    setModelsError(null);
    try {
      if (DRIVE_SCRIPT_WEBAPP_URL) {
        const url = new URL(DRIVE_SCRIPT_WEBAPP_URL);
        url.searchParams.set('action', 'list');
        url.searchParams.set('folderId', DRIVE_MODELS_FOLDER_ID);
        const data = await jsonpRequest<{
          models?: Array<{ name: string; fragId: string; jsonId?: string | null }>;
          error?: string;
        }>(url);

        if (data && typeof data === 'object' && typeof (data as any).error === 'string' && (data as any).error.trim()) {
          throw new Error(String((data as any).error));
        }

        const models = Array.isArray(data.models) ? data.models : [];
        const next = models
          .filter((m) => m && typeof m === 'object' && typeof m.name === 'string' && typeof m.fragId === 'string')
          .map((m) => {
            const group = /estructura/i.test(m.name) ? 'ESTRUCTURA' : 'DRIVE';
            return {
              name: m.name,
              fragUrl: '',
              jsonUrl: undefined,
              group,
              source: 'drive' as const,
              fragId: m.fragId,
              jsonId: m.jsonId ? String(m.jsonId) : undefined
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, 'es'));

        setAvailableModels(next);
        if (next.length === 0) {
          setModelsError('Drive no devolvió modelos. Verifica que existan .frag en la carpeta y que el Web App esté desplegado con acceso "Anyone".');
        }
        return;
      }

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
      if (DRIVE_SCRIPT_WEBAPP_URL) {
        setModelsError(`No se pudo cargar modelos desde Drive: ${e instanceof Error ? e.message : 'Error desconocido'}`);
        setAvailableModels([]);
        return;
      }
      setModelsError(e instanceof Error ? e.message : 'Error cargando modelos');
      setAvailableModels([]);
    } finally {
      setIsModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailableModels();
  }, [fetchAvailableModels]);

  const deriveFilterClassification = useCallback((el: BIMElement) => {
    const ifcRaw =
      (el.category && String(el.category)) ||
      getFirstProp(el, ["IFC TYPE", "IFC_TYPE", "ifcType", "IfcType", "type"]) ||
      "";
    const ifc = normalizeClassification(String(ifcRaw));

    if (ifc.includes("IFCSTAIR")) return "ESCALERAS";
    if (ifc.includes("IFCSTAIRFLIGHT")) return "ESCALERAS";
    if (ifc.includes("IFCCOLUMN")) return "COLUMNAS";
    if (ifc.includes("IFCBEAM")) return "VIGAS";
    if (ifc.includes("IFCWALL")) return "MUROS";
    if (ifc.includes("IFCSLAB")) return "PISOS/PLACAS";

    const hint = normalizeClassification(
      String(getFirstProp(el, ["DETALLE"]) || getFirstProp(el, ["NOMBRE INTEGRADO"]) || el.name || "")
    );
    if (hint.includes("ESCAL")) return "ESCALERAS";
    if (hint.includes("STAIR")) return "ESCALERAS";
    if (hint.includes("COLUM")) return "COLUMNAS";
    if (hint.includes("VIGA") || hint.includes("BEAM")) return "VIGAS";
    if (hint.includes("MURO") || hint.includes("WALL")) return "MUROS";
    if (hint.includes("LOSA") || hint.includes("SLAB") || hint.includes("PISO")) return "PISOS/PLACAS";

    const raw = getFirstProp(el, ["CLASIFICACION", "CLASIFICACIÓN"]);
    return raw && String(raw).trim() ? String(raw).trim() : "SIN CLASIFICAR";
  }, [getFirstProp]);

  const baseElements = useMemo(() => {
    return elements.filter((el) => {
      const classifRaw = deriveFilterClassification(el);
      return !isSinClasificar(classifRaw);
    });
  }, [deriveFilterClassification, elements]);

  useEffect(() => {
    setSelectedClassifications((prev) => prev.filter((c) => !isSinClasificar(c)));
  }, [baseElements]);

  const deriveFilterCategory = useCallback((el: BIMElement) => {
    const ifcRaw =
      (el.category && String(el.category)) ||
      getFirstProp(el, ["IFC TYPE", "IFC_TYPE", "ifcType", "IfcType", "type"]) ||
      "";
    const ifc = normalizeClassification(String(ifcRaw));

    if (ifc.includes("IFCSTAIR")) return "ESCALERAS";
    if (ifc.includes("IFCSTAIRFLIGHT")) return "ESCALERAS";
    if (ifc.includes("IFCCOLUMN")) return "COLUMNAS";
    if (ifc.includes("IFCBEAM")) return "VIGAS";
    if (ifc.includes("IFCWALL")) return "MUROS";
    if (ifc.includes("IFCSLAB")) return "PISOS/PLACAS";

    const hint = normalizeClassification(
      String(getFirstProp(el, ["DETALLE"]) || getFirstProp(el, ["NOMBRE INTEGRADO"]) || el.name || "")
    );
    if (hint.includes("ESCAL")) return "ESCALERAS";
    if (hint.includes("STAIR")) return "ESCALERAS";

    const nombreIntegrado = getFirstProp(el, ["NOMBRE INTEGRADO"]) || el.name;
    return String(nombreIntegrado).trim();
  }, [getFirstProp]);

  const filteredElements = useMemo(() => {
    return baseElements.filter(el => {
      const classif = deriveFilterClassification(el);
      const categoryLabel = deriveFilterCategory(el);
      const level = getProp(el, "NIVEL INTEGRADO") || "";
      const diameter = getFirstProp(el, ["Tamaño", "TAMAÑO", "TAMANO"]) || "";
      const material = getFirstProp(el, ["MATERIAL INTEGRADO", "MATERIAL"]) || "";
      const pileNumber = getFirstProp(el, ["NÚMERO DE PILOTE", "NUMERO DE PILOTE", "NUMERO PILOTE", "PILOTE NUMBER", "PILOTE"]) || "";

      const classificationMatch = appliedClassifications.length === 0 || appliedClassifications.includes(classif);
      const categoryMatch = appliedCategories.length === 0 || appliedCategories.includes(categoryLabel);
      const levelMatch = appliedLevels.length === 0 || appliedLevels.includes(level);
      const diameterMatch = appliedDiameter === 'Todos' || diameter === appliedDiameter;
      const materialMatch = appliedMaterial === 'Todos' || material === appliedMaterial;

      if (isStructureModel) {
        return classificationMatch && categoryMatch && levelMatch && materialMatch;
      }
      return classificationMatch && categoryMatch && levelMatch && diameterMatch;
    });
  }, [appliedCategories, appliedClassifications, appliedDiameter, appliedLevels, appliedMaterial, baseElements, deriveFilterCategory, deriveFilterClassification, getFirstProp, getProp, isStructureModel]);

  const statusFilteredElements = useMemo(() => {
    return filteredElements.filter((el) => {
      const st = viewerStatuses[el.id] ?? 'NINGUNO';
      return statusVisibility[st] !== false;
    });
  }, [filteredElements, statusVisibility, viewerStatuses]);

  const byPileIndex = useMemo(() => {
    if (!isStructureModel) return new Map<string, string[]>();
    const map = new Map<string, string[]>();
    for (const el of filteredElements) {
      const pile = getFirstProp(el, ["NÚMERO DE PILOTE", "NUMERO DE PILOTE", "NUMERO PILOTE", "PILOTE NUMBER", "PILOTE"]);
      if (!pile) continue;
      const key = String(pile);
      let arr = map.get(key);
      if (!arr) {
        arr = [];
        map.set(key, arr);
      }
      arr.push(el.id);
    }
    return map;
  }, [filteredElements, getFirstProp, isStructureModel]);

  const pileSelectionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isStructureModel) return;
    if (pileSelectionTimerRef.current !== null) {
      window.clearTimeout(pileSelectionTimerRef.current);
      pileSelectionTimerRef.current = null;
    }

    const only = selectedPileNumbers;
    if (only.length === 0) {
      setSelectedElementIds([]);
      setSelectedElementId(null);
      return;
    }

    pileSelectionTimerRef.current = window.setTimeout(() => {
      const next = new Set<string>();
      for (const p of only) {
        const ids = byPileIndex.get(p);
        if (!ids) continue;
        for (const id of ids) next.add(id);
      }
      const arr = Array.from(next);
      setSelectedElementIds(arr);
      setSelectedElementId(arr[0] ?? null);
      setIsIsolateMode(false);
    }, 120);

    return () => {
      if (pileSelectionTimerRef.current !== null) {
        window.clearTimeout(pileSelectionTimerRef.current);
        pileSelectionTimerRef.current = null;
      }
    };
  }, [byPileIndex, isStructureModel, selectedPileNumbers]);

  const pileNumberLabels = useMemo(() => {
    if (!isStructureModel) return [] as Array<{ id: string; label: string; modelId: string; localId: number }>;
    if (!showPileNumberLabels) return [];
    const only = selectedPileNumbers.length > 0 ? new Set(selectedPileNumbers) : null;
    const byPile = new Map<string, { id: string; label: string; modelId: string; localId: number }>();
    for (const el of filteredElements) {
      const pile = getFirstProp(el, ["NÚMERO DE PILOTE", "NUMERO DE PILOTE", "NUMERO PILOTE", "PILOTE NUMBER", "PILOTE"]);
      if (!pile) continue;
      if (only && !only.has(pile)) continue;
      if (byPile.has(pile)) continue;
      const modelId = el.modelId ? String(el.modelId) : '';
      const localId = el.localId !== undefined ? Number(el.localId) : Number(el.id);
      if (!modelId || !Number.isFinite(localId)) continue;
      byPile.set(pile, { id: `pile:${pile}`, label: pile, modelId, localId });
      if (!only && byPile.size >= 300) break;
    }
    return Array.from(byPile.values());
  }, [filteredElements, getFirstProp, isStructureModel, selectedPileNumbers, showPileNumberLabels]);

  const elementsWithVolume = useMemo(() => {
    const toNumber = (v: unknown) => {
      if (v === undefined || v === null) return null;
      const s = String(v).trim();
      if (!s) return null;
      const normalized = s.replace(',', '.').replace(/[^\d.\-]/g, '');
      const n = Number(normalized);
      return Number.isFinite(n) ? n : null;
    };

    return baseElements.filter((el) => {
      const vRaw = getFirstProp(el, ["VOLUMEN INTEGRADO", "VOLUMEN", "VOLUME"]);
      const v = toNumber(vRaw);
      const fallback = Number.isFinite(el.volume) ? el.volume : 0;
      return (v ?? fallback) > 0;
    });
  }, [baseElements, getFirstProp]);

  const sidebarData = useMemo(() => {
    const classificationMap: Record<string, Set<string>> = {};
    
    elementsWithVolume.forEach(el => {
      const classification = deriveFilterClassification(el);
      const categoryLabel = deriveFilterCategory(el);

      if (!classificationMap[classification]) classificationMap[classification] = new Set();
      classificationMap[classification].add(categoryLabel);
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
  }, [deriveFilterCategory, deriveFilterClassification, elementsWithVolume]);

  const levels = useMemo(() => {
    const levelSet = new Set<string>();
    baseElements.forEach(el => {
      const level = getProp(el, "NIVEL INTEGRADO");
      if (level) levelSet.add(level);
    });
    return Array.from(levelSet);
  }, [baseElements, getProp]);

  const diameters = useMemo(() => {
    const diameterSet = new Set<string>();
    baseElements.forEach(el => {
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
  }, [baseElements, getFirstProp]);

  const materials = useMemo(() => {
    const set = new Set<string>();
    baseElements.forEach((el) => {
      const v = getFirstProp(el, ["MATERIAL INTEGRADO", "MATERIAL"]);
      if (v) set.add(String(v));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [baseElements, getFirstProp]);

  const pileNumbers = useMemo(() => {
    const set = new Set<string>();
    baseElements.forEach((el) => {
      const v = getFirstProp(el, ["NÚMERO DE PILOTE", "NUMERO DE PILOTE", "NUMERO PILOTE", "PILOTE NUMBER", "PILOTE"]);
      if (v) set.add(String(v));
    });
    const asNum = (s: string) => {
      const n = Number(String(s).replace(/[^\d.\-]/g, ''));
      return Number.isFinite(n) ? n : null;
    };
    return Array.from(set).sort((a, b) => {
      const na = asNum(a);
      const nb = asNum(b);
      if (na !== null && nb !== null) return na - nb;
      if (na !== null) return -1;
      if (nb !== null) return 1;
      return a.localeCompare(b, 'es');
    });
  }, [baseElements, getFirstProp]);

  const effectiveTimelineDate = useMemo(() => {
    if (timelineDate) return new Date(timelineDate + 'T00:00:00Z');
    return new Date();
  }, [timelineDate]);

  const monthOptions = useMemo(() => {
    if (timelineDays.length === 0) return [] as Array<{ key: string; label: string; startIndex: number; endIndex: number }>;
    const options: Array<{ key: string; label: string; startIndex: number; endIndex: number }> = [];
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const fmtLabel = (d: Date) => d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
    for (let i = 0; i < timelineDays.length; i += 1) {
      const key = timelineDays[i]!;
      const d = new Date(key + 'T00:00:00Z');
      if (isNaN(d.getTime())) continue;
      const monthKey = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
      const last = options.length > 0 ? options[options.length - 1] : null;
      if (last && last.key === monthKey) {
        last.endIndex = i;
      } else {
        options.push({ key: monthKey, label: fmtLabel(d), startIndex: i, endIndex: i });
      }
    }
    return options;
  }, [timelineDays]);

  const selectedMonthKey = useMemo(() => {
    const y = effectiveTimelineDate.getUTCFullYear();
    const m = String(effectiveTimelineDate.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, [effectiveTimelineDate]);

  const weekKeyOf = useCallback((d: Date) => {
    const y = d.getUTCFullYear();
    const w = getISOWeek(d);
    return `${y}-W${String(w).padStart(2, '0')}`;
  }, [getISOWeek]);

  const weekOptions = useMemo(() => {
    const month = monthOptions.find((m) => m.key === selectedMonthKey) ?? monthOptions[monthOptions.length - 1];
    if (!month) return [] as Array<{ key: string; label: string; startIndex: number; endIndex: number }>;
    const options: Array<{ key: string; label: string; startIndex: number; endIndex: number }> = [];
    for (let i = month.startIndex; i <= month.endIndex; i += 1) {
      const key = timelineDays[i]!;
      const d = new Date(key + 'T00:00:00Z');
      if (isNaN(d.getTime())) continue;
      const wk = weekKeyOf(d);
      const last = options.length > 0 ? options[options.length - 1] : null;
      if (last && last.key === wk) {
        last.endIndex = i;
      } else {
        options.push({ key: wk, label: `W${String(getISOWeek(d)).padStart(2, '0')}`, startIndex: i, endIndex: i });
      }
    }
    return options;
  }, [getISOWeek, monthOptions, selectedMonthKey, timelineDays, weekKeyOf]);

  const selectedWeekKey = useMemo(() => weekKeyOf(effectiveTimelineDate), [effectiveTimelineDate, weekKeyOf]);

  const weekDayIndices = useMemo(() => {
    if (timelineDays.length === 0) return [] as number[];
    const selectedWeek = weekOptions.find((w) => w.key === selectedWeekKey) ?? weekOptions[weekOptions.length - 1];
    if (!selectedWeek) return [] as number[];
    const indices: number[] = [];
    for (let i = selectedWeek.startIndex; i < timelineDays.length && indices.length < 7; i += 1) {
      const d = new Date(timelineDays[i]! + 'T00:00:00Z');
      if (isNaN(d.getTime())) continue;
      if (weekKeyOf(d) !== selectedWeek.key) break;
      indices.push(i);
    }
    return indices;
  }, [selectedWeekKey, timelineDays, weekKeyOf, weekOptions]);

  const weekDayKeys = useMemo(() => weekDayIndices.map((i) => timelineDays[i]!).filter(Boolean), [timelineDays, weekDayIndices]);

  const elementLevelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const el of filteredElements) {
      const level = getProp(el, 'NIVEL INTEGRADO');
      if (level) map.set(el.id, String(level));
    }
    return map;
  }, [filteredElements, getProp]);

  const sortedLevels = useMemo(() => {
    const set = new Set<string>();
    for (const el of filteredElements) {
      const level = getProp(el, 'NIVEL INTEGRADO');
      if (level) set.add(String(level));
    }
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), 'es'));
  }, [filteredElements, getProp]);

  const weekLevelCells = useMemo(() => {
    const days = weekDayKeys;
    if (days.length === 0 || sortedLevels.length === 0) {
      return {
        days,
        levels: sortedLevels,
        cellStatus: new Map<string, ConstructionStatus>(),
        cellTitle: new Map<string, string>(),
        cellCounts: new Map<string, Record<ConstructionStatus, number>>(),
        dayTotals: new Map<string, Record<ConstructionStatus, number>>(),
        cellChanges: new Map<string, Record<ConstructionStatus, number>>(),
        dayChanges: new Map<string, Record<ConstructionStatus, number>>()
      };
    }

    const dayTargets = days.map((k) => Date.parse(k + 'T23:59:59.999Z'));
    const levelIndex = new Map<string, number>();
    sortedLevels.forEach((l, idx) => levelIndex.set(String(l), idx));

    const counts: Array<Array<Record<ConstructionStatus, number>>> = sortedLevels.map(() =>
      days.map(() => ({
        'NINGUNO': 0,
        'EN PROGRESO': 0,
        'PARA INSPECCION': 0,
        'APROBADO': 0,
        'CERRADO': 0,
        'RECHAZADO': 0
      })),
    );

    const statusAt = (id: string, target: number): ConstructionStatus => {
      const hist = elementHistory[id];
      if (!hist || hist.length === 0) return elementStatuses[id] ?? 'NINGUNO';
      let chosen: ConstructionStatus | null = null;
      for (const entry of hist) {
        const t = new Date(entry.at).getTime();
        if (!isNaN(t) && t <= target) chosen = entry.status;
      }
      return chosen ?? 'NINGUNO';
    };

    for (const el of filteredElements) {
      const lvl = elementLevelById.get(el.id);
      if (!lvl) continue;
      const li = levelIndex.get(lvl);
      if (li === undefined) continue;
      for (let di = 0; di < dayTargets.length; di += 1) {
        const st = statusAt(el.id, dayTargets[di]!);
        counts[li]![di]![st] += 1;
      }
    }

    const pickCell = (c: Record<ConstructionStatus, number>): ConstructionStatus => {
      const candidates: ConstructionStatus[] = ['CERRADO', 'APROBADO', 'PARA INSPECCION', 'EN PROGRESO', 'RECHAZADO'];
      let best: ConstructionStatus = 'NINGUNO';
      let bestN = 0;
      for (const k of candidates) {
        const n = c[k] ?? 0;
        if (n > bestN) {
          best = k;
          bestN = n;
        }
      }
      if (bestN > 0) return best;
      return 'NINGUNO';
    };

    const cellStatus = new Map<string, ConstructionStatus>();
    const cellTitle = new Map<string, string>();
    const cellCounts = new Map<string, Record<ConstructionStatus, number>>();
    const dayTotals = new Map<string, Record<ConstructionStatus, number>>();
    const cellChanges = new Map<string, Record<ConstructionStatus, number>>();
    const dayChanges = new Map<string, Record<ConstructionStatus, number>>();
    for (let li = 0; li < sortedLevels.length; li += 1) {
      for (let di = 0; di < days.length; di += 1) {
        const c = counts[li]![di]!;
        const st = pickCell(c);
        const levelLabel = String(sortedLevels[li]!);
        const dayLabel = days[di]!;
        const title = `${levelLabel} • ${dayLabel}\nNINGUNO: ${c['NINGUNO']}\nEN PROGRESO: ${c['EN PROGRESO']}\nPARA INSPECCION: ${c['PARA INSPECCION']}\nAPROBADO: ${c['APROBADO']}\nCERRADO: ${c['CERRADO']}\nRECHAZADO: ${c['RECHAZADO']}`;
        const key = `${levelLabel}@@${dayLabel}`;
        cellStatus.set(key, st);
        cellTitle.set(key, title);
        cellCounts.set(key, { ...c });

        const total = dayTotals.get(dayLabel) ?? {
          'NINGUNO': 0,
          'EN PROGRESO': 0,
          'PARA INSPECCION': 0,
          'APROBADO': 0,
          'CERRADO': 0,
          'RECHAZADO': 0
        };
        total['NINGUNO'] += c['NINGUNO'] ?? 0;
        total['EN PROGRESO'] += c['EN PROGRESO'] ?? 0;
        total['PARA INSPECCION'] += c['PARA INSPECCION'] ?? 0;
        total['APROBADO'] += c['APROBADO'] ?? 0;
        total['CERRADO'] += c['CERRADO'] ?? 0;
        total['RECHAZADO'] += c['RECHAZADO'] ?? 0;
        dayTotals.set(dayLabel, total);
      }
    }

    const daySet = new Set(days);
    for (const el of filteredElements) {
      const lvl = elementLevelById.get(el.id);
      if (!lvl) continue;
      const hist = elementHistory[el.id];
      if (!Array.isArray(hist)) continue;
      for (const h of hist) {
        const dkey = String(h?.at ?? '').slice(0, 10);
        const st = h?.status as ConstructionStatus | undefined;
        if (!st || !daySet.has(dkey)) continue;
        const k = `${String(lvl)}@@${dkey}`;
        const cell = cellChanges.get(k) ?? {
          'NINGUNO': 0,
          'EN PROGRESO': 0,
          'PARA INSPECCION': 0,
          'APROBADO': 0,
          'CERRADO': 0,
          'RECHAZADO': 0
        };
        cell[st] += 1;
        cellChanges.set(k, cell);

        const tot = dayChanges.get(dkey) ?? {
          'NINGUNO': 0,
          'EN PROGRESO': 0,
          'PARA INSPECCION': 0,
          'APROBADO': 0,
          'CERRADO': 0,
          'RECHAZADO': 0
        };
        tot[st] += 1;
        dayChanges.set(dkey, tot);
      }
    }

    return { days, levels: sortedLevels, cellStatus, cellTitle, cellCounts, dayTotals, cellChanges, dayChanges };
  }, [elementHistory, elementLevelById, elementStatuses, filteredElements, sortedLevels, weekDayKeys]);

  const weekSegments = useMemo(() => {
    if (timelineDays.length === 0) return [] as Array<{ key: string; label: string; startIndex: number; endIndex: number }>;
    const segments: Array<{ key: string; label: string; startIndex: number; endIndex: number }> = [];
    for (let i = 0; i < timelineDays.length; i += 1) {
      const key = timelineDays[i]!;
      const d = new Date(key + 'T00:00:00Z');
      if (isNaN(d.getTime())) continue;
      const wk = weekKeyOf(d);
      const label = `W${String(getISOWeek(d)).padStart(2, '0')}`;
      const last = segments.length > 0 ? segments[segments.length - 1] : null;
      if (last && last.key === wk) {
        last.endIndex = i;
      } else {
        segments.push({ key: wk, label, startIndex: i, endIndex: i });
      }
    }
    return segments;
  }, [getISOWeek, timelineDays, weekKeyOf]);

  const selectedTimelineIndex = useMemo(() => {
    if (timelineDays.length === 0) return 0;
    if (timelineIndexDraft !== null) return Math.max(0, Math.min(timelineDays.length - 1, timelineIndexDraft));
    return Math.max(0, timelineDays.length - 1);
  }, [timelineDays.length, timelineIndexDraft]);

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
      const rawModelKey = selectedRemoteModelName
        ? selectedRemoteModelName.replace(/\.frag$/i, '')
        : String(model?.modelId || model?.id || model?.uuid || 'local');
      const metaKey = `meta:${rawModelKey.trim().toLowerCase()}`;

      const cached = await idbGet<{ key: string; ts: number; elements: BIMElement[]; summaries: CategorySummary[] }>('meta', metaKey);
      if (cached?.elements && Array.isArray(cached.elements) && cached.elements.length > 0) {
        setElements(cached.elements);
        if (cached.summaries && Array.isArray(cached.summaries)) setSummaries(cached.summaries);
        return;
      }

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

      const pileEntries: Array<{ props: Record<string, any>; localId: number; expressId: string }> = [];
      const getPileNumberFromData = (data: any) => {
        const normalizeKey = (s: string) =>
          s
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[_\-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();

        const targets = new Set(
          ["NÚMERO DE PILOTE", "NUMERO DE PILOTE", "NUMERO PILOTE", "PILOTE NUMBER", "PILOTE"].map((k) => normalizeKey(k)),
        );

        const stack: any[] = [data];
        const seen = new WeakSet<object>();
        let nodes = 0;
        const maxNodes = 12000;
        while (stack.length > 0 && nodes < maxNodes) {
          const cur = stack.pop();
          if (!cur || typeof cur !== 'object') continue;
          if (seen.has(cur as object)) continue;
          seen.add(cur as object);
          nodes++;
          if (Array.isArray(cur)) {
            for (let i = 0; i < cur.length; i++) stack.push(cur[i]);
            continue;
          }
          for (const k in cur) {
            const rawVal = (cur as any)[k];
            if (targets.has(normalizeKey(String(k)))) {
              const raw = getValue(rawVal);
              const s = raw !== undefined && raw !== null ? String(raw).trim() : '';
              if (s) return s;
            }
            if (rawVal && typeof rawVal === 'object') stack.push(rawVal);
          }
        }

        return null;
      };

      const tryGetCenterFromBox = (box: any): { x: number; y: number; z: number } | null => {
        try {
          const b = new THREE.Box3();
          if (box instanceof THREE.Box3) {
            b.copy(box);
          } else if (Array.isArray(box) && box.length >= 6) {
            b.min.set(Number(box[0]), Number(box[1]), Number(box[2]));
            b.max.set(Number(box[3]), Number(box[4]), Number(box[5]));
          } else if (box && typeof box === 'object' && box.min && box.max) {
            b.min.set(Number(box.min.x), Number(box.min.y), Number(box.min.z));
            b.max.set(Number(box.max.x), Number(box.max.y), Number(box.max.z));
          } else {
            return null;
          }
          if (!Number.isFinite(b.min.x) || !Number.isFinite(b.max.x)) return null;
          const c = new THREE.Vector3();
          b.getCenter(c);
          if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || !Number.isFinite(c.z)) return null;
          return { x: c.x, y: c.y, z: c.z };
        } catch {
          return null;
        }
      };

      const tryGetItemCenter = async (ids: Array<number | string>): Promise<{ x: number; y: number; z: number } | null> => {
        const candidates = [
          (model as any)?.getItemBoundingBox,
          (model as any)?.getItemBox,
          (model as any)?.getBoundingBox,
          (model as any)?.getAABB
        ].filter((fn) => typeof fn === 'function') as Array<(id: number) => any>;

        for (const id of ids) {
          const n = typeof id === 'number' ? id : Number(String(id));
          if (!Number.isFinite(n)) continue;
          for (const fn of candidates) {
            try {
              const res = await Promise.resolve(fn.call(model, n));
              const center = tryGetCenterFromBox(res);
              if (center) return center;
            } catch {
            }
          }
        }
        return null;
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

        const props = { ...data };
        if (isStructureModel) {
          const pile = getPileNumberFromData(data);
          if (pile) {
            props["NÚMERO DE PILOTE"] = pile;
            pileEntries.push({ props, localId, expressId: String(expressId) });
          }
        }

        extractedElements.push({
          id: expressId, 
          globalId: globalId,
          name,
          category,
          volume: volume,
          unit: 'm³',
          properties: props,
        modelId: model.modelId || model.id || model.uuid,
          localId: localId
        });

        if (!categoryMap[category]) {
          categoryMap[category] = { totalVolume: 0, count: 0 };
        }
        categoryMap[category].count += 1;
        categoryMap[category].totalVolume += volume;
      }

      setElements(extractedElements);
      const summariesList = Object.entries(categoryMap).map(([category, data]) => ({
        category,
        totalVolume: data.totalVolume,
        count: data.count
      }));
      setSummaries(summariesList);
      void idbPut('meta', { key: metaKey, ts: Date.now(), elements: extractedElements, summaries: summariesList }, 4);
      
      console.log(`Preparados ${extractedElements.length} elementos para vinculación.`);

      if (isStructureModel && pileEntries.length > 0) {
        const max = Math.min(500, pileEntries.length);
        for (let i = 0; i < max; i++) {
          const it = pileEntries[i]!;
          const center = await tryGetItemCenter([it.localId, it.expressId]);
          if (center) {
            it.props.__pileCenter = center;
          }
        }
      }
    } catch (err) {
      console.error("Error en processModel:", err);
    }
  }, [isStructureModel, selectedRemoteModelName]);

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
      const req = indexedDB.open('cantidades-model-cache-v1', 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('frag')) db.createObjectStore('frag', { keyPath: 'url' });
        if (!db.objectStoreNames.contains('json')) db.createObjectStore('json', { keyPath: 'url' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return idbPromiseRef.current;
  };

  type CacheStoreName = 'frag' | 'json' | 'meta';

  const idbGet = async <T,>(storeName: CacheStoreName, key: string): Promise<T | null> => {
    try {
      const dbPromise = openDiskCache();
      if (!dbPromise) return null;
      const db = await dbPromise;
      return await new Promise<T | null>((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as T) ?? null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  };

  const idbPut = async (storeName: CacheStoreName, record: any, maxEntries: number) => {
    try {
      const dbPromise = openDiskCache();
      if (!dbPromise) return;
      const db = await dbPromise;
      const pk = storeName === 'meta' ? 'key' : 'url';
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
          const key = r?.[pk];
          if (key) store.delete(key);
        });
      });
    } catch {
    }
  };

  const base64ToBytes = (b64: string) => {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };

  const fetchDriveFragBytesCached = useCallback(async (fileId: string, signal?: AbortSignal) => {
    if (!DRIVE_SCRIPT_WEBAPP_URL) {
      throw new Error('Falta configurar DRIVE_SCRIPT_WEBAPP_URL');
    }

    const key = `drive-frag:${DRIVE_SCRIPT_WEBAPP_URL}|${fileId}`;
    const mem = remoteCacheRef.current.fragBytesByUrl.get(key);
    if (mem) return mem;

    const disk = await idbGet<{ url: string; ts: number; data: ArrayBuffer }>('frag', key);
    if (disk?.data) {
      const bytes = new Uint8Array(disk.data);
      putLru(remoteCacheRef.current.fragBytesByUrl, key, bytes, 6);
      void idbPut('frag', { url: key, ts: Date.now(), data: disk.data }, 12);
      return bytes;
    }

    const parts: Uint8Array[] = [];
    let limit = 2 * 1024 * 1024;
    let offset = 0;
    let total: number | null = null;

    for (;;) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const url = new URL(DRIVE_SCRIPT_WEBAPP_URL);
      url.searchParams.set('action', 'chunk');
      url.searchParams.set('id', fileId);
      url.searchParams.set('offset', String(offset));
      url.searchParams.set('limit', String(limit));
      let data: { data?: string; total?: number; nextOffset?: number; done?: boolean } | null = null;
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        try {
          data = await jsonpRequest<{ data?: string; total?: number; nextOffset?: number; done?: boolean }>(url, { signal, timeoutMs: 45000 });
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          const msg = String((e as any)?.message ?? '');
          const isTimeout = msg.includes('Tiempo de espera agotado (JSONP)');
          if (isTimeout && limit > 256 * 1024) {
            limit = Math.max(256 * 1024, Math.floor(limit / 2));
            url.searchParams.set('limit', String(limit));
          }
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }
      if (!data) throw (lastErr instanceof Error ? lastErr : new Error('No se pudo descargar chunk (JSONP).'));
      const chunk = data.data ? base64ToBytes(String(data.data)) : new Uint8Array(0);
      parts.push(chunk);
      if (typeof data.total === 'number' && Number.isFinite(data.total)) total = data.total;
      offset = typeof data.nextOffset === 'number' && Number.isFinite(data.nextOffset) ? data.nextOffset : offset + chunk.byteLength;
      if (data.done) break;
      if (chunk.byteLength === 0) break;
      if (total !== null && offset >= total) break;
    }

    const totalLen = parts.reduce((sum, p) => sum + p.byteLength, 0);
    const bytes = new Uint8Array(totalLen);
    let p = 0;
    for (const part of parts) {
      bytes.set(part, p);
      p += part.byteLength;
    }
    putLru(remoteCacheRef.current.fragBytesByUrl, key, bytes, 6);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    void idbPut('frag', { url: key, ts: Date.now(), data: buffer }, 12);
    return bytes;
  }, []);

  const fetchDriveTextCached = useCallback(async (fileId: string, signal?: AbortSignal) => {
    if (!DRIVE_SCRIPT_WEBAPP_URL) {
      throw new Error('Falta configurar DRIVE_SCRIPT_WEBAPP_URL');
    }

    const key = `drive-json:${DRIVE_SCRIPT_WEBAPP_URL}|${fileId}`;
    const mem = remoteCacheRef.current.jsonTextByUrl.get(key);
    if (mem) return mem;

    const disk = await idbGet<{ url: string; ts: number; data: string }>('json', key);
    if (disk?.data) {
      putLru(remoteCacheRef.current.jsonTextByUrl, key, disk.data, 6);
      void idbPut('json', { url: key, ts: Date.now(), data: disk.data }, 12);
      return disk.data;
    }

    const url = new URL(DRIVE_SCRIPT_WEBAPP_URL);
    url.searchParams.set('action', 'text');
    url.searchParams.set('id', fileId);
    const data = await jsonpRequest<{ text?: string }>(url, { signal, timeoutMs: 30000 });
    const text = data?.text ? String(data.text) : '';
    putLru(remoteCacheRef.current.jsonTextByUrl, key, text, 6);
    void idbPut('json', { url: key, ts: Date.now(), data: text }, 12);
    return text;
  }, []);

  const fetchArrayBufferCached = useCallback(async (url: string, signal?: AbortSignal) => {
    const mem = remoteCacheRef.current.fragBytesByUrl.get(url);
    if (mem) return mem;

    const disk = await idbGet<{ url: string; ts: number; data: ArrayBuffer }>('frag', url);
    if (disk?.data) {
      const bytes = new Uint8Array(disk.data);
      putLru(remoteCacheRef.current.fragBytesByUrl, url, bytes, 6);
      void idbPut('frag', { url, ts: Date.now(), data: disk.data }, 12);
      return bytes;
    }

    if ('caches' in window) {
      try {
        const cache = await caches.open('cantidades-models-v1');
        const match = await cache.match(url);
        if (match) {
          const bytes = new Uint8Array(await match.arrayBuffer());
          putLru(remoteCacheRef.current.fragBytesByUrl, url, bytes, 6);
          const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
          void idbPut('frag', { url, ts: Date.now(), data: buffer }, 12);
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
    putLru(remoteCacheRef.current.fragBytesByUrl, url, bytes, 6);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    void idbPut('frag', { url, ts: Date.now(), data: buffer }, 12);
    return bytes;
  }, []);

  const fetchTextCached = useCallback(async (url: string, signal?: AbortSignal) => {
    const mem = remoteCacheRef.current.jsonTextByUrl.get(url);
    if (mem) return mem;

    const disk = await idbGet<{ url: string; ts: number; data: string }>('json', url);
    if (disk?.data) {
      putLru(remoteCacheRef.current.jsonTextByUrl, url, disk.data, 6);
      void idbPut('json', { url, ts: Date.now(), data: disk.data }, 12);
      return disk.data;
    }

    if ('caches' in window) {
      try {
        const cache = await caches.open('cantidades-models-v1');
        const match = await cache.match(url);
        if (match) {
          const text = await match.text();
          putLru(remoteCacheRef.current.jsonTextByUrl, url, text, 6);
          void idbPut('json', { url, ts: Date.now(), data: text }, 12);
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
    putLru(remoteCacheRef.current.jsonTextByUrl, url, text, 6);
    void idbPut('json', { url, ts: Date.now(), data: text }, 12);
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
      const isDrive = remote.source === 'drive' && typeof remote.fragId === 'string' && remote.fragId.trim() !== '';
      const fragPromise = isDrive
        ? fetchDriveFragBytesCached(remote.fragId!, controller.signal)
        : fetchArrayBufferCached(remote.fragUrl, controller.signal);
      const jsonPromise = isDrive
        ? (remote.jsonId ? fetchDriveTextCached(remote.jsonId, controller.signal) : Promise.resolve<string | null>(null))
        : (remote.jsonUrl ? fetchTextCached(remote.jsonUrl, controller.signal) : Promise.resolve<string | null>(null));
      const [fragBytes, jsonText] = await Promise.all([fragPromise, jsonPromise]);

      if (controller.signal.aborted) return;
      await loadFragBytes(remote.name, fragBytes);

      if (controller.signal.aborted) return;
      if (jsonText) {
        await applyJsonText(jsonText);
      }

      if (controller.signal.aborted) return;
      try {
        await fetchRemoteStatuses(remote.name, controller.signal);
      } catch {
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      console.error('Error cargando modelo remoto:', e);
      alert(e instanceof Error ? e.message : 'Error cargando modelo remoto');
    } finally {
      setIsLoading(false);
    }
  }, [applyJsonText, fetchArrayBufferCached, fetchDriveFragBytesCached, fetchDriveTextCached, fetchTextCached, loadFragBytes]);

  const resetFilters = () => {
    setSelectedClassifications([]);
    setSelectedCategories([]);
    setSelectedSubCategories([]);
    setSelectedLevels([]);
    setSelectedDiameter('Todos');
    setSelectedMaterial('Todos');
    setSelectedPileNumbers([]);
    setAppliedClassifications([]);
    setAppliedCategories([]);
    setAppliedSubCategories([]);
    setAppliedLevels([]);
    setAppliedDiameter('Todos');
    setAppliedMaterial('Todos');
    setAppliedPileNumbers([]);
  };

  const togglePileNumberSelection = useCallback((pile: string) => {
    setSelectedPileNumbers((prev) => (prev.includes(pile) ? prev.filter((p) => p !== pile) : [...prev, pile]));
  }, []);

  const clearPileSelection = useCallback(() => {
    setSelectedPileNumbers([]);
    setSelectedElementIds([]);
    setSelectedElementId(null);
  }, []);

  const handleChangeStatus = useCallback((id: string, status: ConstructionStatus) => {
    setElementStatuses((prev) => {
      if (prev[id] === status) return prev;
      return { ...prev, [id]: status };
    });
    setElementHistory((prev) => {
      const now = new Date().toISOString();
      const entries = prev[id] ? [...prev[id]] : [];
      if (entries.length === 0 || entries[entries.length - 1].status !== status) {
        entries.push({ status, at: now });
      }
      return { ...prev, [id]: entries };
    });
    scheduleRemoteSave(id, status);
  }, [scheduleRemoteSave]);

  const handleChangeStatusMany = useCallback((ids: string[], status: ConstructionStatus) => {
    setElementStatuses((prev) => {
      let next: Record<string, ConstructionStatus> | null = null;
      for (const id of ids) {
        if (prev[id] !== status) {
          if (!next) next = { ...prev };
          next[id] = status;
        }
      }
      return next ?? prev;
    });
    setElementHistory((prev) => {
      const now = new Date().toISOString();
      const next = { ...prev };
      for (const id of ids) {
        const arr = next[id] ? [...next[id]!] : [];
        if (arr.length === 0 || arr[arr.length - 1].status !== status) {
          arr.push({ status, at: now });
        }
        next[id] = arr;
      }
      return next;
    });
    for (const id of ids) {
      scheduleRemoteSave(id, status);
    }
  }, [scheduleRemoteSave]);

  const changeStatusForSelectedPiles = useCallback((status: ConstructionStatus) => {
    if (!isStructureModel) return;
    if (selectedPileNumbers.length === 0) return;
    const ids = new Set<string>();
    for (const p of selectedPileNumbers) {
      const hit = byPileIndex.get(p);
      if (!hit) continue;
      for (const id of hit) ids.add(id);
    }
    const arr = Array.from(ids);
    if (arr.length === 0) return;
    handleChangeStatusMany(arr, status);
  }, [byPileIndex, handleChangeStatusMany, isStructureModel, selectedPileNumbers]);

  const [expandedModelGroups, setExpandedModelGroups] = useState<Record<string, boolean>>({
    ESTRUCTURA: true,
    GENERAL: true,
    DRIVE: true
  });
  const [artisLogoOk, setArtisLogoOk] = useState(true);
  const [trevolyLogoOk, setTrevolyLogoOk] = useState(true);
  const focusFilteredRef = useRef<null | (() => void)>(null);
  const registerFocusFiltered = useCallback((fn: (() => void) | null) => {
    focusFilteredRef.current = fn;
  }, []);
  const onFocusFiltered = useCallback(() => {
    focusFilteredRef.current?.();
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-white overflow-hidden font-sans">
      {/* Header */}
      <header className="min-h-16 flex flex-col sm:flex-row sm:items-center sm:justify-between px-3 sm:px-8 py-2 sm:py-0 gap-2 border-b border-slate-200 bg-white">
        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-4">
          <div className="flex items-center">
            {artisLogoOk ? (
              <img
                src="https://i.postimg.cc/RVp8pZwc/artis_urbano.png"
                alt="Artis Urbano"
                className="h-7 sm:h-10 w-auto object-contain"
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setArtisLogoOk(false)}
              />
            ) : (
              <div className="text-[11px] font-black tracking-widest text-slate-700">ARTIS</div>
            )}
          </div>
          {trevolyLogoOk ? (
            <img
              src="https://i.postimg.cc/Hsrt7fXx/LOGO-TREVOLY.jpg"
              alt="TREVOLY"
              className="h-7 sm:hidden w-auto object-contain"
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setTrevolyLogoOk(false)}
            />
          ) : (
            <div className="text-[11px] font-black tracking-widest text-slate-700 sm:hidden">TREVOLY</div>
          )}
        </div>
        
        <div className="w-full sm:flex-1 sm:max-w-3xl sm:mx-8">
          <div className="bg-[#003E52] text-white py-1.5 px-4 sm:px-6 rounded-sm text-center font-bold uppercase tracking-widest text-xs sm:text-sm shadow-inner truncate">
            {selectedRemoteModelName ? selectedRemoteModelName.replace(/\.frag$/i, '') : 'CANTIDADES'}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-4">
          {trevolyLogoOk ? (
            <img
              src="https://i.postimg.cc/Hsrt7fXx/LOGO-TREVOLY.jpg"
              alt="TREVOLY"
              className="h-10 w-auto object-contain"
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setTrevolyLogoOk(false)}
            />
          ) : (
            <div className="text-xs font-black tracking-widest text-slate-700">TREVOLY</div>
          )}
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white w-full">
        <div className="w-full px-3 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setTimelineBarOpen((v) => !v)}
              className="flex items-center gap-2 px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
              title={timelineBarOpen ? 'Ocultar barra de tiempo' : 'Mostrar barra de tiempo'}
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${timelineBarOpen ? 'rotate-180' : ''}`} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Tiempo</span>
            </button>

            <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest truncate">
              {timelineDate
                ? new Date(timelineDate + 'T00:00:00Z').toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
                : 'Hoy'}
            </div>

            <button
              type="button"
              onClick={() => {
                setTimelineIndexDraft(null);
                setTimelineIndex(null);
              }}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest border ${timelineDate === null ? 'bg-[#003E52] text-white border-[#003E52]' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
              title="Ver estado actual"
            >
              Hoy
            </button>
          </div>

          {timelineBarOpen && (
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Tiempo</div>
                <div className="mt-2 overflow-x-auto">
                  {(() => {
                    const dayW = Math.max(24, Math.min(64, timelineDayWidth));
                    const totalW = Math.max(1, timelineDays.length) * dayW;
                    const days = timelineDays;
                    const dowLabels = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'] as const;

                    const isSelected = (idx: number) => idx === selectedTimelineIndex;

                    return (
                      <div className="min-w-full">
                        <div className="relative" style={{ width: totalW }}>
                          <div className="h-6 relative">
                            {monthOptions.map((m) => (
                              <div
                                key={m.key}
                                className="absolute top-0 h-6 flex items-center justify-center text-[10px] font-black text-slate-600 uppercase tracking-widest"
                                style={{
                                  left: m.startIndex * dayW,
                                  width: (m.endIndex - m.startIndex + 1) * dayW
                                }}
                              >
                                {m.label}
                              </div>
                            ))}
                          </div>

                          <div className="h-5 relative border-t border-slate-100">
                            {weekSegments.map((w) => (
                              <div
                                key={w.key}
                                className="absolute top-0 h-5 flex items-center justify-center text-[9px] font-bold text-slate-400 uppercase tracking-widest"
                                style={{
                                  left: w.startIndex * dayW,
                                  width: (w.endIndex - w.startIndex + 1) * dayW
                                }}
                              >
                                {w.label}
                              </div>
                            ))}
                          </div>

                          <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.max(1, days.length)}, ${dayW}px)` }}>
                            {days.map((k, idx) => {
                              const d = new Date(k + 'T00:00:00Z');
                              const dow = isNaN(d.getTime()) ? '' : dowLabels[d.getUTCDay()] ?? '';
                              const dayNum = isNaN(d.getTime()) ? '' : String(d.getUTCDate());
                              const selected = isSelected(idx);
                              return (
                                <button
                                  key={k}
                                  type="button"
                                  onClick={() => setTimelineIndexDraft(idx)}
                                  className={`h-12 border-t border-slate-100 border-r border-slate-100 flex flex-col items-center justify-center gap-0.5 ${
                                    selected ? 'bg-[#003E52] text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                                  }`}
                                  title={k}
                                >
                                  <div className={`text-[9px] font-bold uppercase tracking-widest ${selected ? 'text-white/80' : 'text-slate-400'}`}>{dow}</div>
                                  <div className="text-[11px] font-black">{dayNum}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tamaño</div>
                  <input
                    type="range"
                    min={24}
                    max={64}
                    value={timelineDayWidth}
                    onChange={(e) => setTimelineDayWidth(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className={isTimelineSummaryMaximized ? "fixed inset-0 z-50 bg-white border border-slate-200 px-4 py-4 flex flex-col" : "rounded-lg border border-slate-200 bg-white px-3 py-2"}>
                {isTimelineSummaryMaximized && (
                  <div className="h-12 border-b border-slate-200 bg-white flex items-center justify-between px-2">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Resumen por niveles</div>
                    <button
                      type="button"
                      onClick={() => setIsTimelineSummaryMaximized(false)}
                      className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-2"
                      title="Volver"
                    >
                      <Minimize2 className="w-4 h-4 text-slate-600" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Volver</span>
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Resumen por niveles</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTimelineLevelsDetail((v) => !v)}
                      className={`px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-widest ${
                        showTimelineLevelsDetail ? 'bg-[#003E52] text-white border-[#003E52]' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                      title={showTimelineLevelsDetail ? 'Ocultar detalle por niveles' : 'Ver detalle por niveles'}
                    >
                      {showTimelineLevelsDetail ? 'Ocultar detalle' : 'Ver detalle'}
                    </button>
                    {!isTimelineSummaryMaximized && (
                      <button
                        type="button"
                        onClick={() => setIsTimelineSummaryMaximized(true)}
                        className="px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                        title="Maximizar"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div
                  className={`mt-2 overflow-auto rounded-lg border border-slate-100 ${isTimelineSummaryMaximized ? 'flex-1' : 'max-h-56'}`}
                  style={isTimelineSummaryMaximized ? { maxHeight: 'calc(100vh - 160px)' } : undefined}
                >
                  {(() => {
                    const statusSwatchClass = (st: ConstructionStatus) => {
                      switch (st) {
                        case 'NINGUNO': return 'bg-slate-200';
                        case 'EN PROGRESO': return 'bg-amber-300';
                        case 'PARA INSPECCION': return 'bg-blue-300';
                        case 'APROBADO': return 'bg-emerald-300';
                        case 'CERRADO': return 'bg-green-400';
                        case 'RECHAZADO': return 'bg-red-400';
                      }
                    };

                    const activeDayKey = timelineDate ?? weekLevelCells.days[weekLevelCells.days.length - 1] ?? null;
                    const activeTotals = activeDayKey ? weekLevelCells.dayTotals.get(activeDayKey) : null;
                    const sumTotals = (t: Record<ConstructionStatus, number>) =>
                      (t['NINGUNO'] ?? 0) +
                      (t['EN PROGRESO'] ?? 0) +
                      (t['PARA INSPECCION'] ?? 0) +
                      (t['APROBADO'] ?? 0) +
                      (t['CERRADO'] ?? 0) +
                      (t['RECHAZADO'] ?? 0);

                    const pickFromTotals = (t: Record<ConstructionStatus, number>): ConstructionStatus => {
                      const candidates: ConstructionStatus[] = ['CERRADO', 'APROBADO', 'PARA INSPECCION', 'EN PROGRESO', 'RECHAZADO'];
                      let best: ConstructionStatus = 'NINGUNO';
                      let bestN = 0;
                      for (const k of candidates) {
                        const n = t[k] ?? 0;
                        if (n > bestN) {
                          best = k;
                          bestN = n;
                        }
                      }
                      if (bestN > 0) return best;
                      return 'NINGUNO';
                    };

                    return (
                      <div className="min-w-full">
                        {activeDayKey && activeTotals && (
                          <div className="px-3 py-2 border-b border-slate-100 bg-white sticky top-0 z-20">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Resumen {activeDayKey} • {sumTotals(activeTotals)} elementos
                              </div>
                              {(['EN PROGRESO', 'PARA INSPECCION', 'APROBADO', 'CERRADO', 'RECHAZADO', 'NINGUNO'] as ConstructionStatus[])
                                .filter((s) => (activeTotals[s] ?? 0) > 0)
                                .map((s) => (
                                  <div key={s} className="flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-slate-50">
                                    <div className={`w-2.5 h-2.5 rounded ${statusSwatchClass(s)} border border-slate-200`} />
                                    <div className="text-[10px] font-bold text-slate-700">{s}</div>
                                    <div className="text-[10px] font-black text-slate-900">{activeTotals[s]}</div>
                                  </div>
                                ))}
                              {(() => {
                                const changes = activeDayKey ? weekLevelCells.dayChanges.get(activeDayKey) : null;
                                if (!changes) return null;
                                const totalChanges = sumTotals(changes);
                                return (
                                  <div className="flex items-center gap-1 ml-4">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cambios</div>
                                    {totalChanges === 0 ? (
                                      <div className="text-[10px] font-bold text-slate-400">0</div>
                                    ) : (
                                      (['EN PROGRESO', 'PARA INSPECCION', 'APROBADO', 'CERRADO', 'RECHAZADO'] as ConstructionStatus[])
                                        .filter((s) => (changes[s] ?? 0) > 0)
                                        .map((s) => (
                                          <div key={`chg-${s}`} className="flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white">
                                            <div className={`w-2.5 h-2.5 rounded ${statusSwatchClass(s)} border border-slate-200`} />
                                            <div className="text-[10px] font-bold text-slate-700">{changes[s]}</div>
                                          </div>
                                        ))
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        )}

                        {showTimelineLevelsDetail && (
                          <>
                          <div className="px-3 py-2 border-b border-slate-100 bg-white sticky top-0 z-10">
                            <div className="flex flex-wrap items-center gap-4">
                              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Columnas</div>
                              <div className="flex items-center gap-2">
                                <div className="text-[10px] font-bold text-slate-600 whitespace-nowrap">Nivel</div>
                                <input
                                  type="range"
                                  min={180}
                                  max={600}
                                  value={timelineLevelsLevelColWidth}
                                  onChange={(e) => setTimelineLevelsLevelColWidth(Number(e.target.value))}
                                />
                                <div className="text-[10px] font-bold text-slate-400 w-10 text-right tabular-nums">{timelineLevelsLevelColWidth}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-[10px] font-bold text-slate-600 whitespace-nowrap">Día</div>
                                <input
                                  type="range"
                                  min={90}
                                  max={260}
                                  value={timelineLevelsDayColWidth}
                                  onChange={(e) => setTimelineLevelsDayColWidth(Number(e.target.value))}
                                />
                                <div className="text-[10px] font-bold text-slate-400 w-10 text-right tabular-nums">{timelineLevelsDayColWidth}</div>
                              </div>
                            </div>
                          </div>

                          <table
                            className="border-collapse text-left table-fixed"
                            style={{ width: timelineLevelsLevelColWidth + (weekLevelCells.days.length * timelineLevelsDayColWidth) }}
                          >
                            <colgroup>
                              <col style={{ width: timelineLevelsLevelColWidth }} />
                              {weekLevelCells.days.map((d) => (
                                <col key={`col-${d}`} style={{ width: timelineLevelsDayColWidth }} />
                              ))}
                            </colgroup>
                        <thead className="sticky top-0 bg-white z-10">
                          <tr className="border-b border-slate-100">
                            <th className="sticky left-0 bg-white z-20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 border-r border-slate-100">
                              Nivel
                            </th>
                            {weekDayIndices.map((idx) => {
                              const key = timelineDays[idx]!;
                              const d = new Date(key + 'T00:00:00Z');
                              const label = isNaN(d.getTime()) ? key : d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', timeZone: 'UTC' }).toUpperCase();
                              const active = activeDayKey === key;
                              return (
                                <th key={key} className="px-3 py-2 text-[10px] font-bold text-slate-600 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => setTimelineIndexDraft(idx)}
                                    className={`px-2 py-1 rounded-md border ${active ? 'bg-[#003E52] text-white border-[#003E52]' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                    title={key}
                                  >
                                    {label}
                                  </button>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr>
                            <td className="sticky left-0 bg-white z-10 px-3 py-2 text-[10px] font-black text-slate-700 whitespace-nowrap border-r border-slate-100">
                              Total
                            </td>
                            {weekLevelCells.days.map((dayKey) => {
                              const t = weekLevelCells.dayTotals.get(dayKey);
                              const ch = weekLevelCells.dayChanges.get(dayKey);
                              if (!t) {
                                return (
                                  <td key={`tot@@${dayKey}`} className="px-3 py-2">
                                    <div className="w-4 h-4 rounded bg-slate-200 border border-slate-300" title={`Total • ${dayKey}`} />
                                  </td>
                                );
                              }
                              const title = `Total • ${dayKey}\nNINGUNO: ${t['NINGUNO']}\nEN PROGRESO: ${t['EN PROGRESO']}\nPARA INSPECCION: ${t['PARA INSPECCION']}\nAPROBADO: ${t['APROBADO']}\nCERRADO: ${t['CERRADO']}\nRECHAZADO: ${t['RECHAZADO']}`;
                              return (
                                <td key={`tot@@${dayKey}`} className="px-3 py-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="w-4 h-4 rounded bg-slate-300 border border-slate-400" title={title} />
                                    <div className="text-[10px] font-black text-slate-700">{sumTotals(t)}</div>
                                    {(t['RECHAZADO'] ?? 0) > 0 && (
                                      <div className="px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-[10px] font-black text-red-700">
                                        {t['RECHAZADO']}
                                      </div>
                                    )}
                                    {ch && sumTotals(ch) > 0 && (
                                      <div className="flex items-center gap-1 ml-2">
                                        {(['EN PROGRESO', 'PARA INSPECCION', 'APROBADO', 'CERRADO', 'RECHAZADO'] as ConstructionStatus[])
                                          .filter((s) => (ch[s] ?? 0) > 0)
                                          .map((s) => (
                                            <div key={`totchg-${dayKey}-${s}`} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-slate-200 bg-white">
                                              <div className={`w-2 h-2 rounded ${statusSwatchClass(s)} border border-slate-200`} />
                                              <div className="text-[10px] font-black text-slate-700">{ch[s]}</div>
                                            </div>
                                          ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                          {weekLevelCells.levels.map((lvl) => (
                            <tr key={String(lvl)}>
                              <td className="sticky left-0 bg-white z-10 px-3 py-2 text-[10px] font-bold text-slate-700 whitespace-nowrap border-r border-slate-100">
                                {String(lvl)}
                              </td>
                              {weekLevelCells.days.map((dayKey) => {
                                const k = `${String(lvl)}@@${dayKey}`;
                                const st = weekLevelCells.cellStatus.get(k) ?? 'NINGUNO';
                                const title = weekLevelCells.cellTitle.get(k) ?? `${String(lvl)} • ${dayKey}`;
                                const c = weekLevelCells.cellCounts.get(k);
                                const rejected = c ? (c['RECHAZADO'] ?? 0) : 0;
                                const changes = weekLevelCells.cellChanges.get(k);
                                return (
                                  <td key={k} className="px-3 py-2">
                                    <div className="flex items-center gap-2" title={title}>
                                      <div className="relative inline-flex">
                                        <div className={`w-4 h-4 rounded ${statusSwatchClass(st)} border border-slate-200`} />
                                        {rejected > 0 && (
                                          <div className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center">
                                            {rejected}
                                          </div>
                                        )}
                                      </div>
                                      {changes && sumTotals(changes) > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap">
                                          {(['EN PROGRESO', 'PARA INSPECCION', 'APROBADO', 'CERRADO', 'RECHAZADO'] as ConstructionStatus[])
                                            .filter((s) => (changes[s] ?? 0) > 0)
                                            .map((s) => (
                                              <div key={`chg-${k}-${s}`} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-slate-200 bg-white">
                                                <div className={`w-2 h-2 rounded ${statusSwatchClass(s)} border border-slate-200`} />
                                                <div className="text-[10px] font-black text-slate-700">{changes[s]}</div>
                                              </div>
                                            ))}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isMobileLayout ? (
        <div className="flex flex-1 overflow-hidden relative">
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className={isViewerMaximized ? "fixed inset-0 z-50 bg-white flex flex-col" : "flex-1 relative bg-slate-50"}>
              {isViewerMaximized && (
                <div className="h-12 px-6 border-b border-slate-200 bg-white flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Modelo 3D</div>
                  <button
                    type="button"
                    onClick={() => setIsViewerMaximized(false)}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-2"
                    title="Volver"
                  >
                    <Minimize2 className="w-4 h-4 text-slate-600" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Volver</span>
                  </button>
                </div>
              )}

              <div className={isViewerMaximized ? "flex-1 relative bg-slate-50" : "absolute inset-0"}>
                {showWelcome && !isLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <div className="bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-slate-200 max-w-md text-center pointer-events-auto">
                      <h2 className="text-2xl font-light text-slate-900 mb-2">Extractor de Cantidades</h2>
                      <p className="text-slate-500 text-sm">
                        Selecciona un modelo del menú izquierdo.
                      </p>
                    </div>
                  </div>
                )}

                <BIMViewer
                  onModelLoaded={handleModelLoaded}
                  allElements={baseElements}
                  visibleElements={statusFilteredElements}
                  statuses={viewerStatuses}
                  statusVisibility={statusVisibility}
                  onToggleStatusVisibility={(key) => setStatusVisibility((prev) => ({ ...prev, [key]: !(prev[key] !== false) }))}
                  statusColorsEnabled={statusColorsEnabled}
                  gridVisible={gridVisible}
                  isLoading={isLoading}
                  showPileNumberLabels={isStructureModel && showPileNumberLabels}
                  pileNumberLabels={pileNumberLabels}
                  selectedElementId={selectedElementId || undefined}
                  selectedElementIds={selectedElementIds}
                  onSelectionChange={(ids) => {
                    setSelectedElementIds(ids);
                    setSelectedElementId(ids[0] ?? null);
                  }}
                  isIsolateMode={isIsolateMode}
                  onRegisterFocusToFiltered={registerFocusFiltered}
                />

                <div />

                <div className="absolute top-4 left-4 z-30 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setLeftPanelCollapsed(false)}
                    className="p-2 rounded-lg shadow border transition-all flex items-center gap-2 bg-white/90 backdrop-blur-md text-slate-700 border-slate-200 hover:bg-white"
                    title="Modelos"
                  >
                    <Folder className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Modelos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightPanelCollapsed(false)}
                    className="p-2 rounded-lg shadow border transition-all flex items-center gap-2 bg-white/90 backdrop-blur-md text-slate-700 border-slate-200 hover:bg-white"
                    title="Filtros"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Filtros</span>
                  </button>
                </div>

                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  <button
                    onClick={refreshProgressFromSheet}
                    className="p-2 rounded-lg shadow border transition-all flex items-center gap-2 bg-white/90 backdrop-blur-md text-slate-700 border-slate-200 hover:bg-white disabled:opacity-60"
                    title="Actualizar avance desde Google Sheets"
                    disabled={isRefreshingProgress}
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshingProgress ? 'animate-spin' : ''}`} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Actualizar</span>
                  </button>
                  <button
                    onClick={() => setIsViewerMaximized((v) => !v)}
                    className="p-2 rounded-lg shadow border transition-all flex items-center gap-2 bg-white/90 backdrop-blur-md text-slate-700 border-slate-200 hover:bg-white"
                    title={isViewerMaximized ? 'Volver' : 'Maximizar modelo'}
                  >
                    {isViewerMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    <span className="text-[10px] font-bold uppercase tracking-widest">{isViewerMaximized ? 'Volver' : 'Maximizar'}</span>
                  </button>
                  <button
                    onClick={onFocusFiltered}
                    className="p-2 rounded-lg shadow border transition-all flex items-center gap-2 bg-white/90 backdrop-blur-md text-slate-700 border-slate-200 hover:bg-white disabled:opacity-60"
                    title="Enfocar filtrados"
                    disabled={!focusFilteredRef.current}
                  >
                    <Move className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Enfocar</span>
                  </button>
                  <button
                    onClick={() => setIsIsolateMode(!isIsolateMode)}
                    className={`p-2 rounded-lg shadow border transition-all flex items-center gap-2 ${isIsolateMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-white/90 backdrop-blur-md text-slate-700 border-slate-200 hover:bg-white'}`}
                    title={isIsolateMode ? "Desactivar Aislamiento" : "Activar Aislamiento"}
                  >
                    <div className={`w-2 h-2 rounded-full ${isIsolateMode ? 'bg-white animate-pulse' : 'bg-slate-300'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Aislar Selección</span>
                  </button>
                  <button
                    onClick={() => setStatusColorsEnabled((v) => !v)}
                    className={`p-2 rounded-lg shadow border transition-all flex items-center gap-2 ${statusColorsEnabled ? 'bg-[#024959] text-white border-[#003E52]' : 'bg-white/90 backdrop-blur-md text-slate-700 border-slate-200 hover:bg-white'}`}
                    title={statusColorsEnabled ? 'Apagar colores' : 'Encender colores'}
                  >
                    <Palette className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Colores</span>
                  </button>
                  <button
                    onClick={() => setGridVisible((v) => !v)}
                    className={`p-2 rounded-lg shadow border transition-all flex items-center gap-2 ${gridVisible ? 'bg-white/90 backdrop-blur-md text-slate-700 border-slate-200 hover:bg-white' : 'bg-white/70 backdrop-blur-md text-slate-400 border-slate-200 hover:bg-white'}`}
                    title={gridVisible ? 'Apagar rejilla' : 'Encender rejilla'}
                  >
                    <Grid3X3 className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Rejilla</span>
                  </button>
                </div>
              </div>
            </div>

            {!isViewerMaximized && (
              <div className="flex flex-col border-t border-slate-200" style={{ height: isTableDocked ? 44 : tablePanelHeight }}>
                <div className="h-10 px-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tabla de cantidades</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsTableDocked((v) => !v)}
                      className="p-1 hover:bg-slate-200 rounded transition-colors"
                      title={isTableDocked ? 'Mostrar panel' : 'Guardar abajo'}
                    >
                      {isTableDocked ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsTableVisible((v) => !v)}
                      className="p-1 hover:bg-slate-200 rounded transition-colors"
                      title={isTableVisible ? 'Ocultar tabla' : 'Mostrar tabla'}
                    >
                      {isTableVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsTableMaximized(true)}
                      className="p-1 hover:bg-slate-200 rounded transition-colors disabled:opacity-50"
                      title="Maximizar"
                      disabled={!isTableVisible || isTableDocked}
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {!isTableMaximized && isTableVisible && !isTableDocked && (
                  <DataTable
                    elements={statusFilteredElements}
                    onSelectElement={(id) => {
                      setSelectedElementId(id);
                      setSelectedElementIds(id ? [id] : []);
                    }}
                    selectedElementId={selectedElementId || undefined}
                    selectedElementIds={selectedElementIds}
                    onSetSelectedElementIds={setSelectedElementIds}
                    statuses={viewerStatuses}
                    history={elementHistory}
                    onChangeStatus={handleChangeStatus}
                    onChangeStatusMany={handleChangeStatusMany}
                    onClearFilters={resetFilters}
                  />
                )}
                {!isTableMaximized && (!isTableVisible || isTableDocked) && (
                  <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                    {isTableDocked ? 'Guardada abajo' : 'Tabla oculta'}
                  </div>
                )}
              </div>
            )}
          </div>

          {!leftPanelCollapsed && (
            <>
              <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setLeftPanelCollapsed(true)} />
              <div className="fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[360px] bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden">
                <div className="border-b border-slate-100 bg-slate-50/50 flex items-center justify-between p-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Modelos IFC</h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={fetchAvailableModels}
                      className="p-1 hover:bg-slate-200 rounded transition-colors"
                      title="Actualizar lista"
                    >
                      {isModelsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeftPanelCollapsed(true)}
                      className="p-1 hover:bg-slate-200 rounded transition-colors"
                      title="Cerrar"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
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

                  {(['ESTRUCTURA', 'GENERAL', 'DRIVE'] as const).map((group) => {
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
                                  onClick={() => {
                                    void loadRemoteModel(m);
                                    setLeftPanelCollapsed(true);
                                  }}
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
            </>
          )}

          {!rightPanelCollapsed && (
            <>
              <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setRightPanelCollapsed(true)} />
              <div className="fixed inset-y-0 right-0 z-50 w-[85vw] max-w-[360px] bg-white border-l border-slate-200 h-full overflow-hidden">
                <Sidebar
                  categories={sidebarData}
                  selectedClassifications={selectedClassifications}
                  selectedCategories={selectedCategories}
                  selectedSubCategories={selectedSubCategories}
                  onToggleClassification={toggleClassification}
                  onToggleCategory={toggleCategory}
                  onToggleSubCategory={toggleSubCategory}
                  levels={levels}
                  selectedLevels={selectedLevels}
                  onToggleLevel={toggleLevel}
                  diameters={diameters}
                  selectedDiameter={selectedDiameter}
                  onDiameterChange={setSelectedDiameter}
                  isStructureModel={isStructureModel}
                  materials={materials}
                  selectedMaterial={selectedMaterial}
                  onMaterialChange={setSelectedMaterial}
                  pileNumbers={pileNumbers}
                  selectedPileNumbers={selectedPileNumbers}
                  onTogglePileNumber={togglePileNumberSelection}
                  onSetSelectedPileNumbers={setSelectedPileNumbers}
                  onClearPileSelection={clearPileSelection}
                  showPileLabels={showPileNumberLabels}
                  onToggleShowPileLabels={() => setShowPileNumberLabels((v) => !v)}
                onChangeSelectedPilesStatus={changeStatusForSelectedPiles}
                  onFocusFiltered={onFocusFiltered}
                  onResetFilters={resetFilters}
                  onToggleCollapse={() => setRightPanelCollapsed(true)}
                />
              </div>
            </>
          )}

          {isTableMaximized && (
            <div className="fixed inset-0 z-50 bg-white flex flex-col">
              <div className="h-12 px-6 border-b border-slate-200 bg-white flex items-center justify-between">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tabla de cantidades</div>
                <button
                  type="button"
                  onClick={() => setIsTableMaximized(false)}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-2"
                  title="Volver"
                >
                  <Minimize2 className="w-4 h-4 text-slate-600" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Volver</span>
                </button>
              </div>
              <DataTable
                elements={statusFilteredElements}
                onSelectElement={(id) => {
                  setSelectedElementId(id);
                  setSelectedElementIds(id ? [id] : []);
                }}
                selectedElementId={selectedElementId || undefined}
                selectedElementIds={selectedElementIds}
                onSetSelectedElementIds={setSelectedElementIds}
                statuses={viewerStatuses}
                history={elementHistory}
                onChangeStatus={handleChangeStatus}
                onChangeStatusMany={handleChangeStatusMany}
                onClearFilters={resetFilters}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <>
            <div
              className="bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden"
              style={{ width: leftPanelCollapsed ? 44 : leftPanelWidth }}
            >
              <div className={`border-b border-slate-100 bg-slate-50/50 flex items-center justify-between ${leftPanelCollapsed ? 'p-2' : 'p-4'}`}>
                {!leftPanelCollapsed && (
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Modelos IFC</h3>
                )}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setLeftPanelCollapsed((v) => !v)}
                    className="p-1 hover:bg-slate-200 rounded transition-colors"
                    title={leftPanelCollapsed ? 'Mostrar panel' : 'Ocultar panel'}
                  >
                    {leftPanelCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </button>
                  {!leftPanelCollapsed && (
                    <button
                      type="button"
                      onClick={fetchAvailableModels}
                      className="p-1 hover:bg-slate-200 rounded transition-colors"
                      title="Actualizar lista"
                    >
                      {isModelsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              {!leftPanelCollapsed && (
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

                  {(['ESTRUCTURA', 'GENERAL', 'DRIVE'] as const).map((group) => {
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
              )}
            </div>

            {!leftPanelCollapsed && (
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
            )}

            <div className="flex-1 flex flex-col overflow-hidden relative">
              <div className={isViewerMaximized ? "fixed inset-0 z-50 bg-white flex flex-col" : "flex-1 relative bg-slate-50"}>
                {isViewerMaximized && (
                  <div className="h-12 px-6 border-b border-slate-200 bg-white flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Modelo 3D</div>
                    <button
                      type="button"
                      onClick={() => setIsViewerMaximized(false)}
                      className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-2"
                      title="Volver"
                    >
                      <Minimize2 className="w-4 h-4 text-slate-600" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Volver</span>
                    </button>
                  </div>
                )}

                <div className={isViewerMaximized ? "flex-1 relative bg-slate-50" : "absolute inset-0"}>
                  {showWelcome && !isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                      <div className="bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-slate-200 max-w-md text-center pointer-events-auto">
                        <h2 className="text-2xl font-light text-slate-900 mb-2">Extractor de Cantidades</h2>
                        <p className="text-slate-500 text-sm">
                          Selecciona un modelo del menú izquierdo.
                        </p>
                      </div>
                    </div>
                  )}

                  <BIMViewer
                    onModelLoaded={handleModelLoaded}
                    allElements={baseElements}
                    visibleElements={statusFilteredElements}
                    statuses={viewerStatuses}
                    statusVisibility={statusVisibility}
                    onToggleStatusVisibility={(key) => setStatusVisibility((prev) => ({ ...prev, [key]: !(prev[key] !== false) }))}
                    statusColorsEnabled={statusColorsEnabled}
                    gridVisible={gridVisible}
                    isLoading={isLoading}
                    showPileNumberLabels={isStructureModel && showPileNumberLabels}
                    pileNumberLabels={pileNumberLabels}
                    selectedElementId={selectedElementId || undefined}
                    selectedElementIds={selectedElementIds}
                    onSelectionChange={(ids) => {
                      setSelectedElementIds(ids);
                      setSelectedElementId(ids[0] ?? null);
                    }}
                    isIsolateMode={isIsolateMode}
                  />

                  <div />

                  <div className="absolute top-4 right-4 flex flex-col gap-2">
                    <button
                      onClick={refreshProgressFromSheet}
                      className="p-2 rounded-lg shadow border transition-all flex items-center gap-2 bg-white/90 backdrop-blur-md text-slate-700 border-slate-200 hover:bg-white disabled:opacity-60"
                      title="Actualizar avance desde Google Sheets"
                      disabled={isRefreshingProgress}
                    >
                      <RefreshCw className={`w-4 h-4 ${isRefreshingProgress ? 'animate-spin' : ''}`} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Actualizar</span>
                    </button>
                    <button
                      onClick={() => setIsViewerMaximized((v) => !v)}
                      className="p-2 rounded-lg shadow border transition-all flex items-center gap-2 bg-white/90 backdrop-blur-md text-slate-700 border-slate-200 hover:bg-white"
                      title={isViewerMaximized ? 'Volver' : 'Maximizar modelo'}
                    >
                      {isViewerMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      <span className="text-[10px] font-bold uppercase tracking-widest">{isViewerMaximized ? 'Volver' : 'Maximizar'}</span>
                    </button>
                    <button
                      onClick={() => setIsIsolateMode(!isIsolateMode)}
                      className={`p-2 rounded-lg shadow border transition-all flex items-center gap-2 ${isIsolateMode ? 'bg-blue-600 text-white border-blue-500' : 'bg-white/90 backdrop-blur-md text-slate-700 border-slate-200 hover:bg-white'}`}
                      title={isIsolateMode ? "Desactivar Aislamiento" : "Activar Aislamiento"}
                    >
                      <div className={`w-2 h-2 rounded-full ${isIsolateMode ? 'bg-white animate-pulse' : 'bg-slate-300'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Aislar Selección</span>
                    </button>
                    <button
                      onClick={() => setStatusColorsEnabled((v) => !v)}
                      className={`p-2 rounded-lg shadow border transition-all flex items-center gap-2 ${statusColorsEnabled ? 'bg-[#024959] text-white border-[#003E52]' : 'bg-white/90 backdrop-blur-md text-slate-700 border-slate-200 hover:bg-white'}`}
                      title={statusColorsEnabled ? 'Apagar colores' : 'Encender colores'}
                    >
                      <Palette className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Colores</span>
                    </button>
                    <button
                      onClick={() => setGridVisible((v) => !v)}
                      className={`p-2 rounded-lg shadow border transition-all flex items-center gap-2 ${gridVisible ? 'bg-white/90 backdrop-blur-md text-slate-700 border-slate-200 hover:bg-white' : 'bg-white/70 backdrop-blur-md text-slate-400 border-slate-200 hover:bg-white'}`}
                      title={gridVisible ? 'Apagar rejilla' : 'Encender rejilla'}
                    >
                      <Grid3X3 className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Rejilla</span>
                    </button>
                  </div>
                </div>
              </div>

              {!isViewerMaximized && (
                <>
                  <div
                    className={`h-3 ${isTableDocked ? 'bg-slate-50' : 'bg-slate-100 hover:bg-blue-200 active:bg-blue-300'} cursor-row-resize select-none touch-none relative z-20`}
                    onPointerDown={(e) => {
                      if (isTableDocked) return;
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                      } catch {
                      }
                      const start = tablePanelHeight;
                      startVerticalDrag(e, (dy) => {
                        const next = Math.min(900, Math.max(180, start - dy));
                        setTablePanelHeight(next);
                      });
                    }}
                  />

                  <div className="flex flex-col border-t border-slate-200" style={{ height: isTableDocked ? 44 : tablePanelHeight }}>
                    <div className="h-10 px-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tabla de cantidades</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsTableDocked((v) => !v)}
                          className="p-1 hover:bg-slate-200 rounded transition-colors"
                          title={isTableDocked ? 'Mostrar panel' : 'Guardar abajo'}
                        >
                          {isTableDocked ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsTableVisible((v) => !v)}
                          className="p-1 hover:bg-slate-200 rounded transition-colors"
                          title={isTableVisible ? 'Ocultar tabla' : 'Mostrar tabla'}
                        >
                          {isTableVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsTableMaximized(true)}
                          className="p-1 hover:bg-slate-200 rounded transition-colors disabled:opacity-50"
                          title="Maximizar"
                          disabled={!isTableVisible || isTableDocked}
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {!isTableMaximized && isTableVisible && !isTableDocked && (
                      <DataTable
                        elements={statusFilteredElements}
                        onSelectElement={(id) => {
                          setSelectedElementId(id);
                          setSelectedElementIds(id ? [id] : []);
                        }}
                        selectedElementId={selectedElementId || undefined}
                        selectedElementIds={selectedElementIds}
                        onSetSelectedElementIds={setSelectedElementIds}
                        statuses={viewerStatuses}
                        history={elementHistory}
                        onChangeStatus={handleChangeStatus}
                        onChangeStatusMany={handleChangeStatusMany}
                        onClearFilters={resetFilters}
                      />
                    )}
                    {!isTableMaximized && (!isTableVisible || isTableDocked) && (
                      <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                        {isTableDocked ? 'Guardada abajo' : 'Tabla oculta'}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {!rightPanelCollapsed && (
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
            )}

            {rightPanelCollapsed ? (
              <div style={{ width: 44 }} className="bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden">
                <div className="p-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setRightPanelCollapsed(false)}
                    className="p-1 hover:bg-slate-200 rounded transition-colors"
                    title="Mostrar panel"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ width: rightPanelWidth }} className="h-full overflow-hidden">
                <Sidebar
                  categories={sidebarData}
                  selectedClassifications={selectedClassifications}
                  selectedCategories={selectedCategories}
                  selectedSubCategories={selectedSubCategories}
                  onToggleClassification={toggleClassification}
                  onToggleCategory={toggleCategory}
                  onToggleSubCategory={toggleSubCategory}
                  levels={levels}
                  selectedLevels={selectedLevels}
                  onToggleLevel={toggleLevel}
                  diameters={diameters}
                  selectedDiameter={selectedDiameter}
                  onDiameterChange={setSelectedDiameter}
                  isStructureModel={isStructureModel}
                  materials={materials}
                  selectedMaterial={selectedMaterial}
                  onMaterialChange={setSelectedMaterial}
                  pileNumbers={pileNumbers}
                  selectedPileNumbers={selectedPileNumbers}
                  onTogglePileNumber={togglePileNumberSelection}
                  onSetSelectedPileNumbers={setSelectedPileNumbers}
                  onClearPileSelection={clearPileSelection}
                  showPileLabels={showPileNumberLabels}
                  onToggleShowPileLabels={() => setShowPileNumberLabels((v) => !v)}
                  onFocusFiltered={onFocusFiltered}
                  onResetFilters={resetFilters}
                  onToggleCollapse={() => setRightPanelCollapsed(true)}
                />
              </div>
            )}
          </>

          {isTableMaximized && (
            <div className="fixed inset-0 z-50 bg-white flex flex-col">
              <div className="h-12 px-6 border-b border-slate-200 bg-white flex items-center justify-between">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tabla de cantidades</div>
                <button
                  type="button"
                  onClick={() => setIsTableMaximized(false)}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-2"
                  title="Volver"
                >
                  <Minimize2 className="w-4 h-4 text-slate-600" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Volver</span>
                </button>
              </div>
              <DataTable
                elements={statusFilteredElements}
                onSelectElement={(id) => {
                  setSelectedElementId(id);
                  setSelectedElementIds(id ? [id] : []);
                }}
                selectedElementId={selectedElementId || undefined}
                selectedElementIds={selectedElementIds}
                onSetSelectedElementIds={setSelectedElementIds}
                statuses={viewerStatuses}
                history={elementHistory}
                onChangeStatus={handleChangeStatus}
                onChangeStatusMany={handleChangeStatusMany}
                onClearFilters={resetFilters}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
