import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BIMElement } from '../types';

interface DataTableProps {
  elements: BIMElement[];
  onSelectElement: (id: string | null) => void;
  selectedElementId?: string;
}

export default function DataTable({ elements, onSelectElement, selectedElementId }: DataTableProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

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
    <div ref={containerRef} className="flex-1 overflow-auto bg-white">
      <table className="w-full text-left border-collapse min-w-[1000px]">
        <thead className="sticky top-0 bg-[#003d4d] text-white z-10">
          <tr>
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
              <td colSpan={9} />
            </tr>
          )}

          {visibleElements.map((el) => {
            const isSelected = selectedElementId === el.id;
            return (
              <tr 
                key={el.id} 
                className={`hover:bg-blue-50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-100' : ''}`}
                onClick={() => onSelectElement(el.id)}
              >
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
              <td colSpan={9} />
            </tr>
          )}

          {totalRows === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-xs italic">
                No hay datos para mostrar con los filtros actuales.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
