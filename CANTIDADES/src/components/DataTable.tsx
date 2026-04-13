import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BIMElement } from '../types';

type PurchaseStatus = 'PENDIENTE' | 'PEDIDO' | 'COMPRADO' | 'ALMACEN' | 'INSTALADO';

interface HistoryEntry {
  status: PurchaseStatus;
  at: string;
}

interface DataTableProps {
  elements: BIMElement[];
  onSelectElement: (id: string | null) => void;
  selectedElementId?: string;
  selectedElementIds?: string[];
  onSetSelectedElementIds?: (ids: string[]) => void;
  modelKey?: string;
  statuses: Record<string, PurchaseStatus | undefined>;
  history?: Record<string, HistoryEntry[] | undefined>;
  isSanitaryModel?: boolean;
  onChangeStatus: (id: string, status: PurchaseStatus) => void;
  onChangeStatusMany?: (ids: string[], status: PurchaseStatus) => void;
  onClearFilters?: () => void;
}

type PipeStageState = {
  pedido: number;
  comprado: number;
  almacen: number;
  instalado: number;
};

export default function DataTable({ elements, onSelectElement, selectedElementId, selectedElementIds, onSetSelectedElementIds, modelKey, statuses, history, isSanitaryModel, onChangeStatus, onChangeStatusMany, onClearFilters }: DataTableProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const [activeTab, setActiveTab] = useState<'DETALLE' | 'ESTADOS' | 'HISTORIAL' | 'TUBERIAS' | 'UNIONES'>('DETALLE');
  const [bulkStatus, setBulkStatus] = useState<PurchaseStatus>('COMPRADO');
  const [rowHeight, setRowHeight] = useState(() => {
    const stored = Number(localStorage.getItem('cantidades:tableRowHeight'));
    return Number.isFinite(stored) && stored >= 18 && stored <= 40 ? stored : 24;
  });
  const selectedSet = useMemo(() => new Set(selectedElementIds ?? []), [selectedElementIds]);
  const lastAnchorIndexRef = useRef<number | null>(null);

  const STATUS_ORDER: PurchaseStatus[] = ['PENDIENTE', 'PEDIDO', 'COMPRADO', 'ALMACEN', 'INSTALADO'];

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });

    const ro = new ResizeObserver(() => setContainerHeight(el.clientHeight));
    ro.observe(el);

    setContainerHeight(el.clientHeight);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, []);

  const getProp = (el: BIMElement, key: string) => {
    if (!el.properties) return '-';
    const val = el.properties[key];
    if (val === undefined || val === null) return '-';
    
    // Si es un objeto complejo (común en IFC/OBC), intentar extraer el valor real
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
      if (v !== '-' && v !== '') return v;
    }
    return '-';
  };

  const parseNumber = (value: unknown) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const s = String(value).trim();
    if (s === '' || s === '-') return null;
    const cleaned = s
      .replace(/\s/g, '')
      .replace(',', '.')
      .replace(/[^\d.\-]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };

  const getMetric = (el: BIMElement, key: string, fallback?: number) => {
    const raw = getProp(el, key);
    const n = parseNumber(raw);
    if (n !== null) return n;
    return fallback ?? 0;
  };

  const pipeStagesStorageKey = useMemo(() => `cantidades:pipeStages:${modelKey || 'local'}`, [modelKey]);
  const [pipeStagesByGroup, setPipeStagesByGroup] = useState<Record<string, PipeStageState>>({});
  const pipeAdditionsStorageKey = useMemo(() => `cantidades:pipeAdditions:${modelKey || 'local'}`, [modelKey]);
  const [pipeAdditionsByGroup, setPipeAdditionsByGroup] = useState<Record<string, number>>({});
  const unionAdditionsStorageKey = useMemo(() => `cantidades:unionAdditions:${modelKey || 'local'}`, [modelKey]);
  const [unionAdditionsByGroup, setUnionAdditionsByGroup] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(pipeStagesStorageKey);
      if (!raw) {
        setPipeStagesByGroup({});
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, any>;
      const next: Record<string, PipeStageState> = {};
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          const pedido = Number(v?.pedido ?? 0);
          const comprado = Number(v?.comprado ?? 0);
          const almacen = Number(v?.almacen ?? 0);
          const instalado = Number(v?.instalado ?? 0);
          next[k] = {
            pedido: Number.isFinite(pedido) ? Math.max(0, Math.floor(pedido)) : 0,
            comprado: Number.isFinite(comprado) ? Math.max(0, Math.floor(comprado)) : 0,
            almacen: Number.isFinite(almacen) ? Math.max(0, Math.floor(almacen)) : 0,
            instalado: Number.isFinite(instalado) ? Math.max(0, Math.floor(instalado)) : 0
          };
        }
      }
      setPipeStagesByGroup(next);
    } catch {
      setPipeStagesByGroup({});
    }
  }, [pipeStagesStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(pipeStagesStorageKey, JSON.stringify(pipeStagesByGroup));
    } catch {
    }
  }, [pipeStagesByGroup, pipeStagesStorageKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(pipeAdditionsStorageKey);
      if (!raw) {
        setPipeAdditionsByGroup({});
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const next: Record<string, number> = {};
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          const n = Number(v);
          next[k] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
        }
      }
      setPipeAdditionsByGroup(next);
    } catch {
      setPipeAdditionsByGroup({});
    }
  }, [pipeAdditionsStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(pipeAdditionsStorageKey, JSON.stringify(pipeAdditionsByGroup));
    } catch {
    }
  }, [pipeAdditionsByGroup, pipeAdditionsStorageKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(unionAdditionsStorageKey);
      if (!raw) {
        setUnionAdditionsByGroup({});
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const next: Record<string, number> = {};
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          const n = Number(v);
          next[k] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
        }
      }
      setUnionAdditionsByGroup(next);
    } catch {
      setUnionAdditionsByGroup({});
    }
  }, [unionAdditionsStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(unionAdditionsStorageKey, JSON.stringify(unionAdditionsByGroup));
    } catch {
    }
  }, [unionAdditionsByGroup, unionAdditionsStorageKey]);

  const normalizePipeStages = (totalUnits: number, st: PipeStageState | undefined) => {
    const installed = Math.min(Math.max(0, Math.floor(st?.instalado ?? 0)), totalUnits);
    const almacen = Math.min(Math.max(0, Math.floor(st?.almacen ?? 0)), totalUnits - installed);
    const comprado = Math.min(Math.max(0, Math.floor(st?.comprado ?? 0)), totalUnits - installed - almacen);
    const pedido = Math.min(Math.max(0, Math.floor(st?.pedido ?? 0)), totalUnits - installed - almacen - comprado);
    const pendiente = Math.max(0, totalUnits - (pedido + comprado + almacen + installed));
    return { pendiente, pedido, comprado, almacen, instalado: installed };
  };

  const normalizePipeStageMeters = (totalLength: number, totalUnits: number, st: PipeStageState | undefined) => {
    const units = normalizePipeStages(totalUnits, st);
    let remaining = Math.max(0, totalLength);
    const instalado = Math.min(remaining, units.instalado * 6);
    remaining -= instalado;
    const almacen = Math.min(remaining, units.almacen * 6);
    remaining -= almacen;
    const comprado = Math.min(remaining, units.comprado * 6);
    remaining -= comprado;
    const pedido = Math.min(remaining, units.pedido * 6);
    remaining -= pedido;
    return { pendiente: remaining, pedido, comprado, almacen, instalado };
  };

  const derivePipeStagesFromStatusLength = (totalUnits: number, statusLength: Record<PurchaseStatus, number>): PipeStageState => {
    const unitsFromLength = (length: number) => {
      if (!(length > 0)) return 0;
      return Math.min(totalUnits, Math.ceil((length - 1e-9) / 6));
    };
    const instalado = unitsFromLength(statusLength.INSTALADO);
    const uptoAlmacen = unitsFromLength(statusLength.INSTALADO + statusLength.ALMACEN);
    const almacen = Math.max(0, uptoAlmacen - instalado);
    const uptoComprado = unitsFromLength(statusLength.INSTALADO + statusLength.ALMACEN + statusLength.COMPRADO);
    const comprado = Math.max(0, uptoComprado - uptoAlmacen);
    const uptoPedido = unitsFromLength(statusLength.INSTALADO + statusLength.ALMACEN + statusLength.COMPRADO + statusLength.PEDIDO);
    const pedido = Math.max(0, uptoPedido - uptoComprado);
    return normalizePipeStages(totalUnits, { pedido, comprado, almacen, instalado });
  };

  const movePipeStage = (totalUnits: number, current: PipeStageState | undefined, stage: 'pedido' | 'comprado' | 'almacen' | 'instalado', nextValue: number) => {
    const cur = normalizePipeStages(totalUnits, current);
    const target = Math.max(0, Math.floor(nextValue));

    if (stage === 'pedido') {
      const max = totalUnits - (cur.comprado + cur.almacen + cur.instalado);
      const pedido = Math.min(target, max);
      return { pedido, comprado: cur.comprado, almacen: cur.almacen, instalado: cur.instalado };
    }
    if (stage === 'comprado') {
      const total = cur.pedido + cur.comprado;
      const max = totalUnits - (cur.almacen + cur.instalado);
      const comprado = Math.min(target, total, max);
      const pedido = total - comprado;
      return { pedido, comprado, almacen: cur.almacen, instalado: cur.instalado };
    }
    if (stage === 'almacen') {
      const total = cur.comprado + cur.almacen;
      const max = totalUnits - cur.instalado;
      const almacen = Math.min(target, total, max);
      const comprado = total - almacen;
      return { pedido: cur.pedido, comprado, almacen, instalado: cur.instalado };
    }
    const total = cur.almacen + cur.instalado;
    const instalado = Math.min(target, total, totalUnits);
    const almacen = total - instalado;
    return { pedido: cur.pedido, comprado: cur.comprado, almacen, instalado };
  };

  const elementsById = useMemo(() => {
    const map = new Map<string, BIMElement>();
    for (const el of elements) map.set(el.id, el);
    return map;
  }, [elements]);

  const applyPipeAssignmentsToModel = (groupKey: string, ids: string[], totalUnits: number, totalLength: number, st: PipeStageState) => {
    const items = ids
      .map((id) => {
        const el = elementsById.get(id);
        if (!el) return null;
        const length = Math.max(0, getMetric(el, 'LONGITUD INTEGRADO', 0));
        return { id, length };
      })
      .filter(Boolean) as Array<{ id: string; length: number }>;

    const tgt = normalizePipeStageMeters(totalLength, totalUnits, st);
    let needInst = tgt.instalado;
    let needAlm = tgt.almacen;
    let needComp = tgt.comprado;
    let needPed = tgt.pedido;

    const assigned: Record<PurchaseStatus, string[]> = { PENDIENTE: [], PEDIDO: [], COMPRADO: [], ALMACEN: [], INSTALADO: [] };

    for (const it of items) {
      if (needInst > 0) {
        assigned.INSTALADO.push(it.id);
        needInst -= it.length;
        continue;
      }
      if (needAlm > 0) {
        assigned.ALMACEN.push(it.id);
        needAlm -= it.length;
        continue;
      }
      if (needComp > 0) {
        assigned.COMPRADO.push(it.id);
        needComp -= it.length;
        continue;
      }
      if (needPed > 0) {
        assigned.PEDIDO.push(it.id);
        needPed -= it.length;
        continue;
      }
      assigned.PENDIENTE.push(it.id);
    }

    if (onChangeStatusMany) {
      if (assigned.PENDIENTE.length) onChangeStatusMany(assigned.PENDIENTE, 'PENDIENTE');
      if (assigned.PEDIDO.length) onChangeStatusMany(assigned.PEDIDO, 'PEDIDO');
      if (assigned.COMPRADO.length) onChangeStatusMany(assigned.COMPRADO, 'COMPRADO');
      if (assigned.ALMACEN.length) onChangeStatusMany(assigned.ALMACEN, 'ALMACEN');
      if (assigned.INSTALADO.length) onChangeStatusMany(assigned.INSTALADO, 'INSTALADO');
    } else {
      for (const id of assigned.PENDIENTE) onChangeStatus(id, 'PENDIENTE');
      for (const id of assigned.PEDIDO) onChangeStatus(id, 'PEDIDO');
      for (const id of assigned.COMPRADO) onChangeStatus(id, 'COMPRADO');
      for (const id of assigned.ALMACEN) onChangeStatus(id, 'ALMACEN');
      for (const id of assigned.INSTALADO) onChangeStatus(id, 'INSTALADO');
    }
  };

  const pipePurchaseSummary = useMemo(() => {
    if (!isSanitaryModel) return [];
    const map = new Map<string, { tipo: string; diameter: string; level: string; ids: string[]; totalLength: number; count: number; statusLength: Record<PurchaseStatus, number>; statusCount: Record<PurchaseStatus, number> }>();
    const asNumber = (v: string) => {
      const n = parseNumber(v);
      return n !== null ? n : null;
    };
    for (const el of elements) {
      const classif = getFirstProp(el, ["CLASIFICACION", "CLASIFICACIÓN"]);
      const isPipe = /tuber/i.test(classif) && !/union/i.test(classif);
      if (!isPipe) continue;
      const len = getMetric(el, 'LONGITUD INTEGRADO', 0);
      if (!(len > 0)) continue;
      const st: PurchaseStatus = statuses[el.id] ?? 'PENDIENTE';
      const tipoRaw = getProp(el, "NOMBRE INTEGRADO");
      const tipo = tipoRaw !== '-' && tipoRaw !== '' ? tipoRaw : el.name;
      const diameterRaw = getFirstProp(el, ["Tamaño", "TAMAÑO", "TAMANO"]);
      const diameter = diameterRaw !== '-' && diameterRaw !== '' ? diameterRaw : 'SIN DIÁMETRO';
      const levelRaw = getProp(el, 'NIVEL INTEGRADO');
      const level = levelRaw !== '-' && levelRaw !== '' ? levelRaw : 'SIN NIVEL';
      const key = `${tipo}||${diameter}||${level}`;
      const cur = map.get(key) ?? {
        tipo,
        diameter,
        level,
        ids: [],
        totalLength: 0,
        count: 0,
        statusLength: { PENDIENTE: 0, PEDIDO: 0, COMPRADO: 0, ALMACEN: 0, INSTALADO: 0 },
        statusCount: { PENDIENTE: 0, PEDIDO: 0, COMPRADO: 0, ALMACEN: 0, INSTALADO: 0 }
      };
      cur.ids.push(el.id);
      cur.totalLength += len;
      cur.count += 1;
      cur.statusLength[st] += len;
      cur.statusCount[st] += 1;
      map.set(key, cur);
    }
    const arr = Array.from(map.values()).map((v) => {
      const units = Math.ceil(v.totalLength / 6);
      const waste = units * 6 - v.totalLength;
      const groupKey = `${v.tipo}||${v.diameter}||${v.level}`;
      return { ...v, units, waste, groupKey };
    });
    return arr.sort((a, b) => {
      const t = a.tipo.localeCompare(b.tipo, 'es');
      if (t !== 0) return t;
      const na = asNumber(a.diameter);
      const nb = asNumber(b.diameter);
      if (na !== null && nb !== null) return na - nb;
      if (na !== null) return -1;
      if (nb !== null) return 1;
      const d = a.diameter.localeCompare(b.diameter, 'es');
      if (d !== 0) return d;
      return a.level.localeCompare(b.level, 'es');
    });
  }, [elements, getFirstProp, getMetric, getProp, isSanitaryModel, statuses]);

  const unionsPurchaseSummary = useMemo(() => {
    if (!isSanitaryModel) return [];
    const map = new Map<string, { tipo: string; diameter: string; ids: string[]; count: number; statusCount: Record<PurchaseStatus, number> }>();
    const asNumber = (v: string) => {
      const n = parseNumber(v);
      return n !== null ? n : null;
    };
    for (const el of elements) {
      const classif = getFirstProp(el, ["CLASIFICACION", "CLASIFICACIÓN"]);
      const isUnion = /union/i.test(classif);
      if (!isUnion) continue;
      const st: PurchaseStatus = statuses[el.id] ?? 'PENDIENTE';
      const tipoRaw = getProp(el, "NOMBRE INTEGRADO");
      const tipo = tipoRaw !== '-' && tipoRaw !== '' ? tipoRaw : el.name;
      const diameterRaw = getFirstProp(el, ["Tamaño", "TAMAÑO", "TAMANO"]);
      const diameter = diameterRaw !== '-' && diameterRaw !== '' ? diameterRaw : 'SIN DIÁMETRO';
      const key = `${tipo}||${diameter}`;
      const cur = map.get(key) ?? {
        tipo,
        diameter,
        ids: [],
        count: 0,
        statusCount: { PENDIENTE: 0, PEDIDO: 0, COMPRADO: 0, ALMACEN: 0, INSTALADO: 0 }
      };
      cur.ids.push(el.id);
      cur.count += 1;
      cur.statusCount[st] += 1;
      map.set(key, cur);
    }
    const pickDominantStatus = (v: { statusCount: Record<PurchaseStatus, number> }): PurchaseStatus => {
      let best: PurchaseStatus = 'PENDIENTE';
      let bestCount = -1;
      for (const st of STATUS_ORDER) {
        const cnt = v.statusCount[st] ?? 0;
        if (cnt > bestCount) {
          best = st;
          bestCount = cnt;
        }
      }
      return best;
    };
    const arr = Array.from(map.values()).map((v) => {
      const dominantStatus = pickDominantStatus(v);
      const groupKey = `${v.tipo}||${v.diameter}`;
      return { ...v, dominantStatus, groupKey };
    });
    return arr.sort((a, b) => {
      const t = a.tipo.localeCompare(b.tipo, 'es');
      if (t !== 0) return t;
      const na = asNumber(a.diameter);
      const nb = asNumber(b.diameter);
      if (na !== null && nb !== null) return na - nb;
      if (na !== null) return -1;
      if (nb !== null) return 1;
      return a.diameter.localeCompare(b.diameter, 'es');
    });
  }, [elements, getFirstProp, getProp, isSanitaryModel, statuses]);

  const applyStatusToIds = (ids: string[], status: PurchaseStatus) => {
    if (onChangeStatusMany) {
      onChangeStatusMany(ids, status);
      return;
    }
    for (const id of ids) onChangeStatus(id, status);
  };

  const normalizeUnionStages = (totalUnits: number, counts?: Partial<Record<PurchaseStatus, number>>) => {
    const instalado = Math.min(Math.max(0, Math.floor(counts?.INSTALADO ?? 0)), totalUnits);
    const almacen = Math.min(Math.max(0, Math.floor(counts?.ALMACEN ?? 0)), totalUnits - instalado);
    const comprado = Math.min(Math.max(0, Math.floor(counts?.COMPRADO ?? 0)), totalUnits - instalado - almacen);
    const pedido = Math.min(Math.max(0, Math.floor(counts?.PEDIDO ?? 0)), totalUnits - instalado - almacen - comprado);
    const pendiente = Math.max(0, totalUnits - (pedido + comprado + almacen + instalado));
    return { pendiente, pedido, comprado, almacen, instalado };
  };

  const moveUnionStage = (totalUnits: number, current: Partial<Record<PurchaseStatus, number>> | undefined, stage: 'pedido' | 'comprado' | 'almacen' | 'instalado', nextValue: number) => {
    const cur = normalizeUnionStages(totalUnits, current);
    const target = Math.max(0, Math.floor(nextValue));

    if (stage === 'pedido') {
      const max = totalUnits - (cur.comprado + cur.almacen + cur.instalado);
      const pedido = Math.min(target, max);
      return { pedido, comprado: cur.comprado, almacen: cur.almacen, instalado: cur.instalado };
    }
    if (stage === 'comprado') {
      const total = cur.pedido + cur.comprado;
      const max = totalUnits - (cur.almacen + cur.instalado);
      const comprado = Math.min(target, total, max);
      const pedido = total - comprado;
      return { pedido, comprado, almacen: cur.almacen, instalado: cur.instalado };
    }
    if (stage === 'almacen') {
      const total = cur.comprado + cur.almacen;
      const max = totalUnits - cur.instalado;
      const almacen = Math.min(target, total, max);
      const comprado = total - almacen;
      return { pedido: cur.pedido, comprado, almacen, instalado: cur.instalado };
    }
    const total = cur.almacen + cur.instalado;
    const instalado = Math.min(target, total, totalUnits);
    const almacen = total - instalado;
    return { pedido: cur.pedido, comprado: cur.comprado, almacen, instalado };
  };

  const applyUnionAssignmentsToModel = (ids: string[], counts: { pedido: number; comprado: number; almacen: number; instalado: number }) => {
    const orderedIds = [...ids].sort((a, b) => a.localeCompare(b, 'es'));
    let needInst = counts.instalado;
    let needAlm = counts.almacen;
    let needComp = counts.comprado;
    let needPed = counts.pedido;
    const assigned: Record<PurchaseStatus, string[]> = { PENDIENTE: [], PEDIDO: [], COMPRADO: [], ALMACEN: [], INSTALADO: [] };

    for (const id of orderedIds) {
      if (needInst > 0) {
        assigned.INSTALADO.push(id);
        needInst -= 1;
        continue;
      }
      if (needAlm > 0) {
        assigned.ALMACEN.push(id);
        needAlm -= 1;
        continue;
      }
      if (needComp > 0) {
        assigned.COMPRADO.push(id);
        needComp -= 1;
        continue;
      }
      if (needPed > 0) {
        assigned.PEDIDO.push(id);
        needPed -= 1;
        continue;
      }
      assigned.PENDIENTE.push(id);
    }

    if (assigned.PENDIENTE.length) applyStatusToIds(assigned.PENDIENTE, 'PENDIENTE');
    if (assigned.PEDIDO.length) applyStatusToIds(assigned.PEDIDO, 'PEDIDO');
    if (assigned.COMPRADO.length) applyStatusToIds(assigned.COMPRADO, 'COMPRADO');
    if (assigned.ALMACEN.length) applyStatusToIds(assigned.ALMACEN, 'ALMACEN');
    if (assigned.INSTALADO.length) applyStatusToIds(assigned.INSTALADO, 'INSTALADO');
  };

  const totals = useMemo(() => {
    let area = 0;
    let length = 0;
    let volume = 0;
    for (const el of elements) {
      area += getMetric(el, 'AREA INTEGRADO', 0);
      length += getMetric(el, 'LONGITUD INTEGRADO', 0);
      volume += getMetric(el, 'VOLUMEN INTEGRADO', el.volume);
    }
    return { count: elements.length, area, length, volume };
  }, [elements]);

  const escapeCsvCell = (value: unknown) => {
    const text = String(value ?? '');
    if (/[;"\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const downloadCsv = (rows: Array<Array<unknown>>, baseName: string) => {
    const content = rows.map((row) => row.map(escapeCsvCell).join(';')).join('\r\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportCurrentTab = () => {
    const safeModel = (modelKey || 'local').replace(/[^\w.-]+/g, '_');
    if (activeTab === 'DETALLE') {
      const rows: Array<Array<unknown>> = [[
        'Sel', 'Estado', 'Clasificación', 'Tipo', 'Categoría', 'Elemento', 'Detalle', 'Material Integrado', 'Ubicación', 'Área M2', 'Longitud M', 'Volumen M3'
      ]];
      for (const el of elements) {
        const st = statuses[el.id] ?? 'PENDIENTE';
        const tipoRaw = getProp(el, "NOMBRE INTEGRADO");
        const tipo = tipoRaw !== '-' && tipoRaw !== '' ? tipoRaw : el.name;
        rows.push([
          selectedSet.has(el.id) ? 'X' : '',
          st,
          (() => {
            const v = getFirstProp(el, ["CLASIFICACION", "CLASIFICACIÓN"]);
            return v !== '-' ? v : 'SIN CLASIFICAR';
          })(),
          tipo,
          el.category ?? '',
          getProp(el, "NOMBRE INTEGRADO") || el.name,
          getProp(el, "DETALLE") || '-',
          getProp(el, "MATERIAL INTEGRADO"),
          getProp(el, "NIVEL INTEGRADO"),
          format2FromRaw(getProp(el, "AREA INTEGRADO")),
          format2FromRaw(getProp(el, "LONGITUD INTEGRADO")),
          format2FromRaw(getProp(el, "VOLUMEN INTEGRADO"), el.volume)
        ]);
      }
      downloadCsv(rows, `${safeModel}_detalle`);
      return;
    }
    if (activeTab === 'ESTADOS') {
      const rows: Array<Array<unknown>> = [['Estado', 'Cantidad', 'Área m2', 'Longitud m', 'Volumen m3']];
      for (const st of STATUS_ORDER) {
        const v = statusTotals[st];
        rows.push([st, v.count, format2(v.area), format2(v.length), format2(v.volume)]);
      }
      rows.push(['TOTAL', totals.count, format2(totals.area), format2(totals.length), format2(totals.volume)]);
      downloadCsv(rows, `${safeModel}_estados`);
      return;
    }
    if (activeTab === 'HISTORIAL') {
      const rows: Array<Array<unknown>> = [['ID', 'Tipo', ...STATUS_ORDER]];
      for (const el of elements) {
        const tipoRaw = getProp(el, "NOMBRE INTEGRADO");
        const tipo = tipoRaw !== '-' && tipoRaw !== '' ? tipoRaw : el.name;
        const entries = (history?.[el.id] ?? []).slice().sort((a, b) => a.at.localeCompare(b.at));
        const latestByStatus = new Map<PurchaseStatus, string>();
        for (const entry of entries) latestByStatus.set(entry.status, entry.at);
        rows.push([el.id, tipo, ...STATUS_ORDER.map((st) => latestByStatus.get(st) ?? '-')]);
      }
      downloadCsv(rows, `${safeModel}_historial`);
      return;
    }
    if (activeTab === 'TUBERIAS') {
      const rows: Array<Array<unknown>> = [[
        'Tipo', 'Diámetro', 'Nivel', 'Unidades (6m)', 'Pendiente', 'Pedido', 'Comprado', 'Almacén', 'Instalado', 'Longitud total (m)', 'Restante (m)', 'Desperdicio (m)', 'Adicionales'
      ]];
      for (const r of pipePurchaseSummary) {
        const baseState = pipeStagesByGroup[r.groupKey] ?? derivePipeStagesFromStatusLength(r.units, r.statusLength);
        const display = normalizePipeStages(r.units, baseState);
        const remaining = normalizePipeStageMeters(r.totalLength, r.units, baseState).pendiente;
        rows.push([
          r.tipo, r.diameter, r.level, r.units, display.pendiente, display.pedido, display.comprado, display.almacen, display.instalado,
          format2(r.totalLength), format2(remaining), format2(r.waste), pipeAdditionsByGroup[r.groupKey] ?? 0
        ]);
      }
      downloadCsv(rows, `${safeModel}_tuberias`);
      return;
    }
    if (activeTab === 'UNIONES') {
      const rows: Array<Array<unknown>> = [[
        'Tipo', 'Diámetro', 'Unidades totales', 'Unidades pendientes', 'Pedido', 'Comprado', 'Almacén', 'Instalado', 'Adicionales'
      ]];
      for (const r of unionsPurchaseSummary) {
        const display = normalizeUnionStages(r.count, r.statusCount);
        rows.push([
          r.tipo, r.diameter, r.count, display.pendiente, display.pedido, display.comprado, display.almacen, display.instalado, unionAdditionsByGroup[r.groupKey] ?? 0
        ]);
      }
      downloadCsv(rows, `${safeModel}_uniones`);
    }
  };

  const statusTotals = useMemo(() => {
    const base: Record<PurchaseStatus, { count: number; area: number; length: number; volume: number }> = {
      PENDIENTE: { count: 0, area: 0, length: 0, volume: 0 },
      PEDIDO: { count: 0, area: 0, length: 0, volume: 0 },
      COMPRADO: { count: 0, area: 0, length: 0, volume: 0 },
      ALMACEN: { count: 0, area: 0, length: 0, volume: 0 },
      INSTALADO: { count: 0, area: 0, length: 0, volume: 0 }
    };
    for (const el of elements) {
      const st = statuses[el.id] ?? 'PENDIENTE';
      const bucket = base[st];
      bucket.count += 1;
      bucket.area += getMetric(el, 'AREA INTEGRADO', 0);
      bucket.length += getMetric(el, 'LONGITUD INTEGRADO', 0);
      bucket.volume += getMetric(el, 'VOLUMEN INTEGRADO', el.volume);
    }
    return base;
  }, [elements, statuses]);

  const format2 = (n: number) => n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const format2FromRaw = (raw: unknown, fallback?: number) => {
    const n = parseNumber(raw);
    if (n !== null) return format2(n);
    if (fallback !== undefined && Number.isFinite(fallback)) return format2(fallback);
    return '-';
  };

  const overscan = 20;
  const totalRows = elements.length;

  useEffect(() => {
    try {
      localStorage.setItem('cantidades:tableRowHeight', String(rowHeight));
    } catch {
    }
  }, [rowHeight]);

  const { paddingTop, paddingBottom, visibleElements, startIndex } = useMemo(() => {
    const safeScrollTop = Math.max(0, scrollTop);
    const start = Math.max(0, Math.floor(safeScrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / rowHeight) + overscan * 2;
    const end = Math.min(totalRows, start + visibleCount);
    const top = start * rowHeight;
    const bottom = Math.max(0, (totalRows - end) * rowHeight);
    return {
      paddingTop: top,
      paddingBottom: bottom,
      visibleElements: elements.slice(start, end),
      startIndex: start
    };
  }, [containerHeight, elements, rowHeight, scrollTop, totalRows]);

  const statusRowBg = (st: PurchaseStatus) => {
    switch (st) {
      case 'PENDIENTE':
        return 'bg-slate-100';
      case 'PEDIDO':
        return 'bg-blue-100';
      case 'COMPRADO':
        return 'bg-amber-100';
      case 'ALMACEN':
        return 'bg-violet-100';
      case 'INSTALADO':
        return 'bg-emerald-100';
    }
  };

  const statusTint = (st: PurchaseStatus) => {
    switch (st) {
      case 'PENDIENTE':
        return { row: 'bg-slate-50', hover: 'hover:bg-slate-100', pill: 'bg-slate-200 text-slate-700' };
      case 'PEDIDO':
        return { row: 'bg-blue-50', hover: 'hover:bg-blue-100', pill: 'bg-blue-200 text-blue-900' };
      case 'COMPRADO':
        return { row: 'bg-amber-50', hover: 'hover:bg-amber-100', pill: 'bg-amber-200 text-amber-900' };
      case 'ALMACEN':
        return { row: 'bg-violet-50', hover: 'hover:bg-violet-100', pill: 'bg-violet-200 text-violet-900' };
      case 'INSTALADO':
        return { row: 'bg-emerald-50', hover: 'hover:bg-emerald-100', pill: 'bg-emerald-200 text-emerald-900' };
    }
  };

  const nextStatus = (cur: PurchaseStatus): PurchaseStatus => {
    const idx = STATUS_ORDER.indexOf(cur);
    return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length] ?? 'PENDIENTE';
  };

  const allIds = useMemo(() => elements.map((e) => e.id), [elements]);
  const isAllSelected = selectedElementIds && selectedElementIds.length > 0 && selectedElementIds.length === allIds.length;
  const selectedCount = selectedElementIds?.length ?? 0;

  const applySelectionAtIndex = (absoluteIndex: number, shouldSelect: boolean, isRange: boolean) => {
    if (!onSetSelectedElementIds) return;
    const current = selectedElementIds ?? [];
    const anchor = lastAnchorIndexRef.current;
    const next = new Set(current);

    if (isRange && anchor !== null) {
      const from = Math.min(anchor, absoluteIndex);
      const to = Math.max(anchor, absoluteIndex);
      for (let i = from; i <= to; i += 1) {
        const id = elements[i]?.id;
        if (!id) continue;
        if (shouldSelect) next.add(id);
        else next.delete(id);
      }
    } else {
      const id = elements[absoluteIndex]?.id;
      if (id) {
        if (shouldSelect) next.add(id);
        else next.delete(id);
      }
    }

    lastAnchorIndexRef.current = absoluteIndex;
    onSetSelectedElementIds(Array.from(next));
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="h-10 px-4 border-b border-slate-100 bg-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('DETALLE')}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-colors ${
              activeTab === 'DETALLE'
                ? 'bg-[#003d4d] text-white border-[#003d4d]'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Detalle
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ESTADOS')}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-colors ${
              activeTab === 'ESTADOS'
                ? 'bg-[#003d4d] text-white border-[#003d4d]'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Estados
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('HISTORIAL')}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-colors ${
              activeTab === 'HISTORIAL'
                ? 'bg-[#003d4d] text-white border-[#003d4d]'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Historial
          </button>
          {isSanitaryModel && (
            <button
              type="button"
              onClick={() => setActiveTab('TUBERIAS')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                activeTab === 'TUBERIAS'
                  ? 'bg-[#003d4d] text-white border-[#003d4d]'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Tuberías
            </button>
          )}
          {isSanitaryModel && (
            <button
              type="button"
              onClick={() => setActiveTab('UNIONES')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                activeTab === 'UNIONES'
                  ? 'bg-[#003d4d] text-white border-[#003d4d]'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Uniones
            </button>
          )}
          <button
            type="button"
            onClick={exportCurrentTab}
            className="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-colors bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            title="Descargar CSV separado por punto y coma"
          >
            Exportar CSV
          </button>
        </div>

        <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest flex items-center gap-4">
          <span>Elementos: {totals.count.toLocaleString('es-CO')}</span>
          <span>Área: {format2(totals.area)} m²</span>
          <span>Longitud: {format2(totals.length)} m</span>
          <span>Volumen: {format2(totals.volume)} m³</span>
        </div>
      </div>

      <div className="h-10 px-4 border-b border-slate-100 bg-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">
            <input
              type="checkbox"
              checked={Boolean(isAllSelected)}
              onChange={(e) => {
                if (!onSetSelectedElementIds) return;
                if (e.target.checked) onSetSelectedElementIds(allIds);
                else onSetSelectedElementIds([]);
              }}
              className="accent-[#003d4d]"
            />
            Seleccionar todo
          </label>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Seleccionados: {selectedCount.toLocaleString('es-CO')}
          </span>
          <button
            type="button"
            onClick={() => onSetSelectedElementIds?.([])}
            className="px-2 py-1 rounded border border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50"
          >
            Limpiar selección
          </button>
          <button
            type="button"
            onClick={onClearFilters}
            className="px-2 py-1 rounded border border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            disabled={!onClearFilters}
          >
            Limpiar filtros
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={String(rowHeight)}
            onChange={(e) => setRowHeight(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600"
            title="Tamaño de filas"
          >
            <option value="20">Compacto</option>
            <option value="24">Normal</option>
            <option value="32">Grande</option>
          </select>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as PurchaseStatus)}
            className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600"
          >
            {STATUS_ORDER.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              if (!onChangeStatusMany) return;
              if (!selectedElementIds || selectedElementIds.length === 0) return;
              onChangeStatusMany(selectedElementIds, bulkStatus);
            }}
            className="px-3 py-1 rounded bg-[#003d4d] text-white text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-40"
            disabled={!onChangeStatusMany || !selectedElementIds || selectedElementIds.length === 0}
          >
            Aplicar
          </button>
          <button
            type="button"
            onClick={() => {
              if (!onChangeStatusMany) return;
              if (!selectedElementIds || selectedElementIds.length === 0) return;
              onChangeStatusMany(selectedElementIds, 'COMPRADO');
            }}
            className="px-3 py-1 rounded bg-amber-500 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-amber-600 disabled:opacity-40"
            disabled={!onChangeStatusMany || !selectedElementIds || selectedElementIds.length === 0}
          >
            Comprar
          </button>
        </div>
      </div>

      {activeTab === 'ESTADOS' ? (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#003d4d] text-white z-10">
              <tr>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Estado</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Cantidad</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Área m²</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Longitud m</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-right">Volumen m³</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {STATUS_ORDER.map((st) => {
                const v = statusTotals[st];
                const bg = statusRowBg(st);
                return (
                  <tr key={st} className={bg}>
                    <td className="px-4 py-2 text-xs font-bold text-slate-700">{st}</td>
                    <td className="px-4 py-2 text-xs text-right font-mono text-slate-700">{v.count.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-2 text-xs text-right font-mono text-slate-700">{format2(v.area)}</td>
                    <td className="px-4 py-2 text-xs text-right font-mono text-slate-700">{format2(v.length)}</td>
                    <td className="px-4 py-2 text-xs text-right font-mono font-bold text-slate-900">{format2(v.volume)}</td>
                  </tr>
                );
              })}
              <tr className="bg-white">
                <td className="px-4 py-2 text-xs font-black text-slate-900 uppercase">Total</td>
                <td className="px-4 py-2 text-xs text-right font-mono text-slate-900">{totals.count.toLocaleString('es-CO')}</td>
                <td className="px-4 py-2 text-xs text-right font-mono text-slate-900">{format2(totals.area)}</td>
                <td className="px-4 py-2 text-xs text-right font-mono text-slate-900">{format2(totals.length)}</td>
                <td className="px-4 py-2 text-xs text-right font-mono font-black text-slate-900">{format2(totals.volume)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : activeTab === 'DETALLE' ? (
        <div ref={containerRef} className="flex-1 overflow-auto bg-white">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead className="sticky top-0 bg-[#003d4d] text-white z-10">
              <tr>
                <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Sel</th>
                <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Estado</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Clasificación</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Tipo</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Categoría</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Elemento</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Detalle</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Material Integrado</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Ubicación</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Área M2</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Longitud M</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-right">Volumen M3</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paddingTop > 0 && (
                <tr style={{ height: paddingTop }}>
                  <td colSpan={12} />
                </tr>
              )}

              {visibleElements.map((el, idx) => {
                const isSelected = selectedElementId === el.id;
                const st: PurchaseStatus = statuses[el.id] ?? 'PENDIENTE';
                const tint = statusTint(st);
                const isChecked = selectedSet.has(el.id);
                const absoluteIndex = startIndex + idx;
                const tipoRaw = getProp(el, "NOMBRE INTEGRADO");
                const tipo = tipoRaw !== '-' && tipoRaw !== '' ? tipoRaw : el.name;

                return (
                  <tr
                    key={el.id}
                    className={`${tint.row} ${tint.hover} cursor-pointer transition-colors ${isSelected ? 'outline outline-2 outline-blue-300' : ''}`}
                    onClick={(e) => {
                      if (e.shiftKey) {
                        applySelectionAtIndex(absoluteIndex, true, true);
                        return;
                      }
                      lastAnchorIndexRef.current = absoluteIndex;
                      onSelectElement(el.id);
                    }}
                  >
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = e.currentTarget;
                          applySelectionAtIndex(absoluteIndex, target.checked, e.shiftKey);
                        }}
                        className="accent-[#003d4d]"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onChangeStatus(el.id, nextStatus(st));
                        }}
                        className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${tint.pill}`}
                        title="Cambiar estado"
                      >
                        {st}
                      </button>
                    </td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 uppercase font-bold">
                      {(() => {
                        const v = getFirstProp(el, ["CLASIFICACION", "CLASIFICACIÓN"]);
                        return v !== '-' ? v : 'SIN CLASIFICAR';
                      })()}
                    </td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 uppercase font-medium">{tipo}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 uppercase">{el.category}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 uppercase font-medium">{getProp(el, "NOMBRE INTEGRADO") || el.name}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 uppercase">{getProp(el, "DETALLE") || '-'}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 uppercase">{getProp(el, "MATERIAL INTEGRADO")}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 uppercase">{getProp(el, "NIVEL INTEGRADO")}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 text-right font-mono">{format2FromRaw(getProp(el, "AREA INTEGRADO"))}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 text-right font-mono">{format2FromRaw(getProp(el, "LONGITUD INTEGRADO"))}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 text-right font-mono font-bold">
                      {format2FromRaw(getProp(el, "VOLUMEN INTEGRADO"), el.volume)}
                    </td>
                  </tr>
                );
              })}

              {paddingBottom > 0 && (
                <tr style={{ height: paddingBottom }}>
                  <td colSpan={12} />
                </tr>
              )}

              {totalRows === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-400 text-xs italic">
                    No hay datos para mostrar con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'HISTORIAL' ? (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead className="sticky top-0 bg-[#003d4d] text-white z-10">
              <tr>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">ID</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Tipo</th>
                {STATUS_ORDER.map((st) => (
                  <th key={st} className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">{st}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {elements.map((el) => {
                const tipoRaw = getProp(el, "NOMBRE INTEGRADO");
                const tipo = tipoRaw !== '-' && tipoRaw !== '' ? tipoRaw : el.name;
                const entries = (history?.[el.id] ?? []).slice().sort((a, b) => a.at.localeCompare(b.at));
                const latestByStatus = new Map<PurchaseStatus, string>();
                for (const entry of entries) {
                  latestByStatus.set(entry.status, entry.at);
                }
                return (
                  <tr key={el.id}>
                    <td className="px-4 py-2 text-xs font-mono text-slate-700">{el.id}</td>
                    <td className="px-4 py-2 text-xs text-slate-700">{tipo}</td>
                    {STATUS_ORDER.map((st) => (
                      <td key={st} className="px-4 py-2 text-[10px] text-slate-600">
                        {latestByStatus.get(st) ? new Date(latestByStatus.get(st)!).toLocaleString('es-CO') : '-'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'TUBERIAS' ? (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="sticky top-0 bg-[#003d4d] text-white z-10">
              <tr>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Tipo</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Diámetro</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Nivel</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Unidades (6m)</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Pendiente</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Pedido</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Comprado</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Almacén</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Instalado</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Longitud total (m)</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Restante (m)</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Desperdicio (m)</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-right">Adicionales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pipePurchaseSummary.map((r) => (
                <tr key={r.groupKey}>
                  <td className="px-4 py-2 text-xs font-bold text-slate-700">{r.tipo}</td>
                  <td className="px-4 py-2 text-xs text-slate-700">{r.diameter}</td>
                  <td className="px-4 py-2 text-xs text-slate-700">{r.level}</td>
                  <td className="px-4 py-2 text-xs text-right font-mono font-black text-slate-900">{r.units.toLocaleString('es-CO')}</td>
                  {(() => {
                    const baseState = pipeStagesByGroup[r.groupKey] ?? derivePipeStagesFromStatusLength(r.units, r.statusLength);
                    const display = normalizePipeStages(r.units, baseState);
                    const onSet = (stage: 'pedido' | 'comprado' | 'almacen' | 'instalado') => (value: number) => {
                      setPipeStagesByGroup((prev) => {
                        const current = prev[r.groupKey] ?? derivePipeStagesFromStatusLength(r.units, r.statusLength);
                        const next = movePipeStage(r.units, current, stage, value);
                        const updated = { ...prev, [r.groupKey]: next };
                        applyPipeAssignmentsToModel(r.groupKey, r.ids, r.units, r.totalLength, next);
                        return updated;
                      });
                    };
                    const toSafeNumber = (raw: string) => {
                      const n = Number(raw);
                      return Number.isFinite(n) ? n : 0;
                    };
                    return (
                      <>
                        <td className="px-4 py-2 text-xs text-right font-mono font-black text-slate-900">{display.pendiente.toLocaleString('es-CO')}</td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={display.pedido}
                            onChange={(e) => onSet('pedido')(toSafeNumber(e.target.value))}
                            className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={display.comprado}
                            onChange={(e) => onSet('comprado')(toSafeNumber(e.target.value))}
                            className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={display.almacen}
                            onChange={(e) => onSet('almacen')(toSafeNumber(e.target.value))}
                            className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={display.instalado}
                            onChange={(e) => onSet('instalado')(toSafeNumber(e.target.value))}
                            className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                          />
                        </td>
                      </>
                    );
                  })()}
                  <td className="px-4 py-2 text-xs text-right font-mono text-slate-700">{format2(r.totalLength)}</td>
                  <td className="px-4 py-2 text-xs text-right font-mono font-black text-slate-900">{format2(normalizePipeStageMeters(r.totalLength, r.units, pipeStagesByGroup[r.groupKey] ?? derivePipeStagesFromStatusLength(r.units, r.statusLength)).pendiente)}</td>
                  <td className="px-4 py-2 text-xs text-right font-mono text-slate-700">{format2(r.waste)}</td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      value={pipeAdditionsByGroup[r.groupKey] ?? 0}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        setPipeAdditionsByGroup((prev) => ({ ...prev, [r.groupKey]: Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0 }));
                      }}
                      className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                    />
                  </td>
                </tr>
              ))}
              {pipePurchaseSummary.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-slate-400 text-xs italic">
                    No hay tuberías con longitud para resumir con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'UNIONES' ? (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[1050px]">
            <thead className="sticky top-0 bg-[#003d4d] text-white z-10">
              <tr>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Tipo</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Diámetro</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Unidades totales</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Unidades pendientes</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Pedido</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Comprado</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Almacén</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Instalado</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-right">Adicionales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {unionsPurchaseSummary.map((r) => (
                <tr key={r.groupKey}>
                  <td className="px-4 py-2 text-xs font-bold text-slate-700">{r.tipo}</td>
                  <td className="px-4 py-2 text-xs text-slate-700">{r.diameter}</td>
                  {(() => {
                    const display = normalizeUnionStages(r.count, r.statusCount);
                    const onSet = (stage: 'pedido' | 'comprado' | 'almacen' | 'instalado') => (value: number) => {
                      const next = moveUnionStage(r.count, r.statusCount, stage, value);
                      applyUnionAssignmentsToModel(r.ids, next);
                    };
                    const toSafeNumber = (raw: string) => {
                      const n = Number(raw);
                      return Number.isFinite(n) ? n : 0;
                    };
                    return (
                      <>
                        <td className="px-4 py-2 text-xs text-right font-mono font-black text-slate-900">{r.count.toLocaleString('es-CO')}</td>
                        <td className="px-4 py-2 text-xs text-right font-mono font-black text-slate-900">{display.pendiente.toLocaleString('es-CO')}</td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={display.pedido}
                            onChange={(e) => onSet('pedido')(toSafeNumber(e.target.value))}
                            className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={display.comprado}
                            onChange={(e) => onSet('comprado')(toSafeNumber(e.target.value))}
                            className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={display.almacen}
                            onChange={(e) => onSet('almacen')(toSafeNumber(e.target.value))}
                            className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={display.instalado}
                            onChange={(e) => onSet('instalado')(toSafeNumber(e.target.value))}
                            className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={unionAdditionsByGroup[r.groupKey] ?? 0}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              setUnionAdditionsByGroup((prev) => ({ ...prev, [r.groupKey]: Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0 }));
                            }}
                            className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                          />
                        </td>
                      </>
                    );
                  })()}
                </tr>
              ))}
              {unionsPurchaseSummary.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-xs italic">
                    No hay uniones de tubería para resumir con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
