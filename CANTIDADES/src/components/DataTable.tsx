import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BIMElement } from '../types';

type PurchaseStatus = 'PENDIENTE' | 'COMPRADO' | 'EN SITIO';

interface DataTableProps {
  elements: BIMElement[];
  onSelectElement: (id: string | null) => void;
  selectedElementId?: string;
  statuses: Record<string, PurchaseStatus | undefined>;
  onChangeStatus: (id: string, status: PurchaseStatus) => void;
}

export default function DataTable({ elements, onSelectElement, selectedElementId, statuses, onChangeStatus }: DataTableProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const [activeTab, setActiveTab] = useState<'DETALLE' | 'ESTADOS'>('DETALLE');

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
      COMPRADO: { count: 0, area: 0, length: 0, volume: 0 },
      'EN SITIO': { count: 0, area: 0, length: 0, volume: 0 }
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

  const rowHeight = 24;
  const overscan = 20;
  const totalRows = elements.length;

  const { paddingTop, paddingBottom, visibleElements } = useMemo(() => {
    const safeScrollTop = Math.max(0, scrollTop);
    const start = Math.max(0, Math.floor(safeScrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / rowHeight) + overscan * 2;
    const end = Math.min(totalRows, start + visibleCount);
    const top = start * rowHeight;
    const bottom = Math.max(0, (totalRows - end) * rowHeight);
    return {
      paddingTop: top,
      paddingBottom: bottom,
      visibleElements: elements.slice(start, end)
    };
  }, [containerHeight, elements, scrollTop, totalRows]);

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
        </div>

        <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest flex items-center gap-4">
          <span>Elementos: {totals.count.toLocaleString('es-CO')}</span>
          <span>Área: {format2(totals.area)} m²</span>
          <span>Longitud: {format2(totals.length)} m</span>
          <span>Volumen: {format2(totals.volume)} m³</span>
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
              {(Object.keys(statusTotals) as PurchaseStatus[]).map((st) => {
                const v = statusTotals[st];
                const bg =
                  st === 'PENDIENTE'
                    ? 'bg-slate-100'
                    : st === 'COMPRADO'
                      ? 'bg-amber-100'
                      : 'bg-emerald-100';
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
      ) : (
        <div ref={containerRef} className="flex-1 overflow-auto bg-white">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead className="sticky top-0 bg-[#003d4d] text-white z-10">
              <tr>
                <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Estado</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Clasificación</th>
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
                  <td colSpan={10} />
                </tr>
              )}

              {visibleElements.map((el) => {
                const isSelected = selectedElementId === el.id;
                const st: PurchaseStatus = statuses[el.id] ?? 'PENDIENTE';
                const rowTint =
                  st === 'PENDIENTE'
                    ? 'bg-slate-50'
                    : st === 'COMPRADO'
                      ? 'bg-amber-50'
                      : 'bg-emerald-50';
                const hover =
                  st === 'PENDIENTE'
                    ? 'hover:bg-slate-100'
                    : st === 'COMPRADO'
                      ? 'hover:bg-amber-100'
                      : 'hover:bg-emerald-100';
                const pill =
                  st === 'PENDIENTE'
                    ? 'bg-slate-200 text-slate-700'
                    : st === 'COMPRADO'
                      ? 'bg-amber-200 text-amber-900'
                      : 'bg-emerald-200 text-emerald-900';

                const nextStatus = (cur: PurchaseStatus): PurchaseStatus =>
                  cur === 'PENDIENTE' ? 'COMPRADO' : cur === 'COMPRADO' ? 'EN SITIO' : 'PENDIENTE';

                return (
                  <tr
                    key={el.id}
                    className={`${rowTint} ${hover} cursor-pointer transition-colors ${isSelected ? 'outline outline-2 outline-blue-300' : ''}`}
                    onClick={() => onSelectElement(el.id)}
                  >
                    <td className="px-3 py-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onChangeStatus(el.id, nextStatus(st));
                        }}
                        className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${pill}`}
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
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 uppercase">{el.category}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 uppercase font-medium">{getProp(el, "NOMBRE INTEGRADO") || el.name}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 uppercase">{getProp(el, "DETALLE") || '-'}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 uppercase">{getProp(el, "MATERIAL INTEGRADO")}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 uppercase">{getProp(el, "NIVEL INTEGRADO")}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 text-right font-mono">{getProp(el, "AREA INTEGRADO")}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 text-right font-mono">{getProp(el, "LONGITUD INTEGRADO")}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 text-right font-mono font-bold">
                      {getProp(el, "VOLUMEN INTEGRADO") !== '-' ? getProp(el, "VOLUMEN INTEGRADO") : el.volume.toFixed(2)}
                    </td>
                  </tr>
                );
              })}

              {paddingBottom > 0 && (
                <tr style={{ height: paddingBottom }}>
                  <td colSpan={10} />
                </tr>
              )}

              {totalRows === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400 text-xs italic">
                    No hay datos para mostrar con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
