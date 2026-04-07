import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BIMElement } from '../types';

type PurchaseStatus = 'PENDIENTE' | 'PEDIDO' | 'COMPRADO' | 'EN BODEGA' | 'INSTALADO';

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
  statuses: Record<string, PurchaseStatus | undefined>;
  history?: Record<string, HistoryEntry[] | undefined>;
  onChangeStatus: (id: string, status: PurchaseStatus) => void;
  onChangeStatusMany?: (ids: string[], status: PurchaseStatus) => void;
  onClearFilters?: () => void;
}

export default function DataTable({ elements, onSelectElement, selectedElementId, selectedElementIds, onSetSelectedElementIds, statuses, history, onChangeStatus, onChangeStatusMany, onClearFilters }: DataTableProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const [activeTab, setActiveTab] = useState<'DETALLE' | 'ESTADOS' | 'HISTORIAL'>('DETALLE');
  const [bulkStatus, setBulkStatus] = useState<PurchaseStatus>('COMPRADO');
  const [rowHeight, setRowHeight] = useState(() => {
    const stored = Number(localStorage.getItem('cantidades:tableRowHeight'));
    return Number.isFinite(stored) && stored >= 18 && stored <= 40 ? stored : 24;
  });
  const selectedSet = useMemo(() => new Set(selectedElementIds ?? []), [selectedElementIds]);
  const lastAnchorIndexRef = useRef<number | null>(null);

  const STATUS_ORDER: PurchaseStatus[] = ['PENDIENTE', 'PEDIDO', 'COMPRADO', 'EN BODEGA', 'INSTALADO'];

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

  const statusTotals = useMemo(() => {
    const base: Record<PurchaseStatus, { count: number; area: number; length: number; volume: number }> = {
      PENDIENTE: { count: 0, area: 0, length: 0, volume: 0 },
      PEDIDO: { count: 0, area: 0, length: 0, volume: 0 },
      COMPRADO: { count: 0, area: 0, length: 0, volume: 0 },
      'EN BODEGA': { count: 0, area: 0, length: 0, volume: 0 },
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
      case 'EN BODEGA':
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
      case 'EN BODEGA':
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
      ) : (
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
      )}
    </div>
  );
}
