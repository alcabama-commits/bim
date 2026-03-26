import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BIMElement, CategorySummary } from '../types';
import { LayoutGrid, Table as TableIcon, BarChart3, Info, FileDown, Search, Filter, X, ChevronDown, ChevronUp, Layers } from 'lucide-react';

interface DashboardProps {
  elements: BIMElement[];
  summaries: CategorySummary[];
  onSelectElement: (id: string | null) => void;
  onSelectGroup?: (ids: string[], groupKey: string) => void;
  selectedElementId?: string;
  selectedGroupKey?: string;
}

interface FilterState {
  path: string;
  value: string;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const PRIORITY_PROPS = [
  "AREA INTEGRADO",
  "LONGITUD INTEGRADO",
  "MATERIAL INTEGRADO",
  "NIVEL INTEGRADO",
  "NOMBRE INTEGRADO",
  "VOLUMEN INTEGRADO"
];

export default function Dashboard({ elements, summaries: initialSummaries, onSelectElement, onSelectGroup, selectedElementId, selectedGroupKey }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'table'>('summary');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterState[]>([]);
  const [newFilterPath, setNewFilterPath] = useState('');
  const [newFilterValue, setNewFilterValue] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [groupBy, setGroupBy] = useState<string>('category');
  
  const getNestedValue = (el: BIMElement, path: string): any => {
    if (path === 'category') return el.category;
    if (!el.properties) return undefined;

    const getVal = (v: any): any => {
      if (v === undefined || v === null) return v;
      if (typeof v !== 'object') return v;
      if ('value' in v) return getVal(v.value);
      if ('Value' in v) return getVal(v.Value);
      if ('NominalValue' in v) return getVal(v.NominalValue);
      if ('QuantityValue' in v) return getVal(v.QuantityValue);
      return v;
    };

    // Búsqueda exhaustiva con prioridad en grupos de Identidad
    const findProperty = (obj: any, targetName: string): any => {
      if (!obj || typeof obj !== 'object') return undefined;
      const target = targetName.trim().toLowerCase();

      // 1. Coincidencia directa
      for (const key in obj) {
        if (key.toLowerCase() === target) return getVal(obj[key]);
      }

      // 2. Prioridad: Grupos de Identidad
      const isIdentityGroup = (k: string) => {
        const lowerK = k.trim().toLowerCase();
        return lowerK.includes('datos de identidad') || lowerK.includes('identity data');
      };
      for (const key in obj) {
        if (isIdentityGroup(key)) {
          const found = findProperty(obj[key], targetName);
          if (found !== undefined) return found;
        }
      }

      // 3. Manejo de Arrays
      if (Array.isArray(obj)) {
        for (const item of obj) {
          if (item && typeof item === 'object') {
            const name = getVal(item.Name || item.name || item.Key || item.key || item.ParameterName || item.Tag);
            if (typeof name === 'string' && name.toLowerCase() === target) {
              return getVal(item.Value || item.value || item.Val || item.val || item.ParameterValue || item.NominalValue || item);
            }
            const found = findProperty(item, targetName);
            if (found !== undefined) return found;
          }
        }
        return undefined;
      }

      // 4. Búsqueda recursiva general
      for (const key in obj) {
        if (isIdentityGroup(key)) continue;
        const val = obj[key];
        if (val && typeof val === 'object') {
          if ('value' in val && Object.keys(val).length === 1) continue;
          const found = findProperty(val, targetName);
          if (found !== undefined) return found;
        }
      }
      return undefined;
    };

    // Primero intentamos la ruta exacta (por si es una ruta de puntos como "Pset.Prop")
    const parts = path.split('.');
    if (parts.length > 1) {
      let current: any = el.properties;
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          current = undefined;
          break;
        }
      }
      if (current !== undefined) return getVal(current);
    }

    // Si no es una ruta de puntos o falló, hacemos búsqueda profunda
    return findProperty(el.properties, path);
  };

  const dynamicSummaries = useMemo(() => {
    if (groupBy === 'category') return initialSummaries;

    const groupMap: Record<string, { totalVolume: number; count: number }> = {};
    elements.forEach(el => {
      const val = getNestedValue(el, groupBy);
      const groupKey = val !== undefined && val !== null ? String(val) : 'Sin valor';
      
      if (!groupMap[groupKey]) {
        groupMap[groupKey] = { totalVolume: 0, count: 0 };
      }
      groupMap[groupKey].totalVolume += el.volume;
      groupMap[groupKey].count += 1;
    });

    return Object.entries(groupMap)
      .map(([category, data]) => ({
        category,
        totalVolume: data.totalVolume,
        count: data.count
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume);
  }, [elements, initialSummaries, groupBy]);

  const totalVolume = useMemo(() => dynamicSummaries.reduce((acc, curr) => acc + curr.totalVolume, 0), [dynamicSummaries]);

  const availableProperties = useMemo(() => {
    const keys = new Set<string>();
    elements.forEach(el => {
      // Add standard properties
      keys.add('category');
      
      if (el.properties) {
        Object.entries(el.properties).forEach(([key, value]) => {
          if (value && typeof value === 'object' && !('value' in value)) {
            Object.keys(value).forEach(subKey => {
              keys.add(`${key}.${subKey}`);
            });
          } else {
            keys.add(key);
          }
        });
      }
    });
    return Array.from(keys).sort();
  }, [elements]);

  const handleGroupClick = (groupKey: string) => {
    if (!onSelectGroup) return;
    
    if (selectedGroupKey === groupKey) {
      onSelectGroup([], '');
      return;
    }

    const groupElements = elements.filter(el => {
      const val = getNestedValue(el, groupBy);
      const key = val !== undefined && val !== null ? String(val) : 'Sin valor';
      return key === groupKey;
    });
    
    const ids = groupElements.map(el => el.id);
    onSelectGroup(ids, groupKey);
  };

  const filteredElements = useMemo(() => {
    return elements.filter(el => {
      // Search term filter
      const matchesSearch = 
        el.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        el.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        el.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      // Active filters
      return activeFilters.every(filter => {
        const val = getNestedValue(el, filter.path);
        if (val === undefined || val === null) return false;
        return String(val).toLowerCase().includes(filter.value.toLowerCase());
      });
    });
  }, [elements, searchTerm, activeFilters]);

  const sortedElements = useMemo(() => {
    let sortableItems = [...filteredElements];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aVal, bVal;
        if (sortConfig.key === 'id') { aVal = a.id; bVal = b.id; }
        else if (sortConfig.key === 'name') { aVal = a.name; bVal = b.name; }
        else if (sortConfig.key === 'volume') { aVal = a.volume; bVal = b.volume; }
        else {
          aVal = getNestedValue(a, sortConfig.key);
          bVal = getNestedValue(b, sortConfig.key);
        }

        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredElements, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const addFilter = () => {
    if (newFilterPath && newFilterValue) {
      setActiveFilters([...activeFilters, { path: newFilterPath, value: newFilterValue }]);
      setNewFilterPath('');
      setNewFilterValue('');
    }
  };

  const removeFilter = (index: number) => {
    setActiveFilters(activeFilters.filter((_, i) => i !== index));
  };

  const exportCSV = () => {
    const headers = ['ID', 'Nombre', 'Categoria', 'Volumen (m3)'];
    // Add active sort key to headers if it's a custom property
    const isCustomSort = sortConfig && !['id', 'name', 'volume'].includes(sortConfig.key);
    if (isCustomSort) headers.push(sortConfig.key);

    const rows = sortedElements.map(el => {
      const row = [el.id, el.name, el.category, el.volume.toString()];
      if (isCustomSort) {
        const val = getNestedValue(el, sortConfig.key!);
        row.push(String(val || ''));
      }
      return row;
    });
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "cantidades_bim.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden border-l border-slate-200">
      {/* Tab Switcher */}
      <div className="flex bg-white border-b border-slate-200 p-1">
        <button 
          onClick={() => setActiveTab('summary')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest transition-all rounded-lg ${activeTab === 'summary' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <BarChart3 className="w-4 h-4" />
          Resumen
        </button>
        <button 
          onClick={() => setActiveTab('table')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest transition-all rounded-lg ${activeTab === 'table' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <TableIcon className="w-4 h-4" />
          Tabla de Datos
        </button>
      </div>

      {/* Header Stats (Always visible) */}
      <div className="p-6 border-b border-slate-100 bg-white space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Volumen Total</p>
            <p className="text-3xl font-light text-emerald-950">{totalVolume.toFixed(2)} <span className="text-sm font-normal text-emerald-600">m³</span></p>
          </div>
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Elementos</p>
            <p className="text-3xl font-light text-blue-950">{elements.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <Layers className="w-4 h-4 text-slate-400" />
          <div className="flex-1">
            <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Agrupar Resumen por:</p>
            <select 
              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              <optgroup label="Básico">
                <option value="category">Categoría (IFC Type)</option>
              </optgroup>
              <optgroup label="Parámetros Integrados">
                {PRIORITY_PROPS.map(prop => (
                  <option key={prop} value={prop}>{prop}</option>
                ))}
              </optgroup>
              <optgroup label="Otras Propiedades">
                {availableProperties.filter(p => p !== 'category' && !PRIORITY_PROPS.includes(p)).map(prop => (
                  <option key={prop} value={prop}>{prop}</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === 'summary' ? (
          <>
            {/* Bulk Summary Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <LayoutGrid className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-tight">Resumen por {groupBy === 'category' ? 'Categoría' : groupBy}</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {dynamicSummaries.map((s, i) => (
                  <div 
                    key={s.category} 
                    onClick={() => handleGroupClick(s.category)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer group ${selectedGroupKey === s.category ? 'bg-slate-900 border-slate-900 shadow-lg' : 'bg-slate-50 border-slate-100 hover:border-blue-200 hover:bg-blue-50/30'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <p className={`text-[10px] font-bold uppercase tracking-wider truncate ${selectedGroupKey === s.category ? 'text-slate-400' : 'text-slate-500'}`}>{s.category}</p>
                    </div>
                    <p className={`text-lg font-light ${selectedGroupKey === s.category ? 'text-white' : 'text-slate-900'}`}>{s.totalVolume.toFixed(2)} <span className={`text-[10px] font-normal ${selectedGroupKey === s.category ? 'text-slate-500' : 'text-slate-400'}`}>m³</span></p>
                    <p className={`text-[10px] ${selectedGroupKey === s.category ? 'text-slate-500' : 'text-slate-400'}`}>{s.count} elementos</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Charts Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-tight">Distribución de Volumen</h3>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dynamicSummaries} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="category" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      width={80}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="totalVolume" radius={[0, 4, 4, 0]}>
                      {dynamicSummaries.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : (
          /* Full Data Table Tab */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full min-h-[500px]">
            <div className="p-4 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TableIcon className="w-4 h-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-tight">Explorador de Datos</h3>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2 rounded-xl border transition-all shadow-sm flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${showFilters ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Filter className="w-4 h-4" />
                    Filtros {activeFilters.length > 0 && `(${activeFilters.length})`}
                  </button>
                  <button 
                    onClick={exportCSV}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
                  >
                    <FileDown className="w-4 h-4" />
                    Exportar
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar por ID, Nombre o Categoría..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {showFilters && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-inner space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Filtros Avanzados</h4>
                      {activeFilters.length > 0 && (
                        <button 
                          onClick={() => setActiveFilters([])}
                          className="text-[9px] text-red-500 hover:text-red-600 font-bold uppercase"
                        >
                          Limpiar Todo
                        </button>
                      )}
                    </div>

                    {/* Filter Builder */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-bold text-slate-400 uppercase ml-1">Propiedad</label>
                        <select 
                          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={newFilterPath}
                          onChange={(e) => setNewFilterPath(e.target.value)}
                        >
                          <option value="">Seleccionar...</option>
                          {availableProperties.map(prop => (
                            <option key={prop} value={prop}>{prop}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-bold text-slate-400 uppercase ml-1">Valor / Acción</label>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            placeholder="Filtrar por..."
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            value={newFilterValue}
                            onChange={(e) => setNewFilterValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addFilter()}
                          />
                          <button 
                            onClick={addFilter}
                            disabled={!newFilterPath || !newFilterValue}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                          >
                            Filtrar
                          </button>
                          <button 
                            onClick={() => newFilterPath && requestSort(newFilterPath)}
                            disabled={!newFilterPath}
                            className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                            title="Ordenar por esta propiedad"
                          >
                            Ordenar
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Active Filters List */}
                    {activeFilters.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {activeFilters.map((filter, index) => (
                          <div key={index} className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg">
                            <span className="text-[9px] font-bold text-blue-600 uppercase">{filter.path}:</span>
                            <span className="text-[10px] text-blue-800">{filter.value}</span>
                            <button onClick={() => removeFilter(index)} className="text-blue-400 hover:text-blue-600">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white shadow-sm z-10">
                  <tr className="border-b border-slate-100">
                    <th 
                      className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600"
                      onClick={() => requestSort('id')}
                    >
                      <div className="flex items-center gap-1">
                        ID
                        {sortConfig?.key === 'id' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600"
                      onClick={() => requestSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        Nombre
                        {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right cursor-pointer hover:text-slate-600"
                      onClick={() => requestSort('volume')}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        Volumen
                        {sortConfig?.key === 'volume' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </th>
                    {sortConfig && !['id', 'name', 'volume'].includes(sortConfig.key) && (
                      <th 
                        className="px-4 py-3 text-[10px] font-bold text-blue-500 uppercase tracking-wider text-right cursor-pointer hover:text-blue-600 bg-blue-50/30"
                        onClick={() => requestSort(sortConfig.key)}
                      >
                        <div className="flex items-center gap-1 justify-end">
                          {sortConfig.key.split('.').pop()}
                          {sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sortedElements.map((el) => (
                    <tr 
                      key={el.id} 
                      className={`group hover:bg-slate-50 cursor-pointer transition-colors ${selectedElementId === el.id ? 'bg-blue-50' : ''}`}
                      onClick={() => onSelectElement(el.id)}
                    >
                      <td className="px-4 py-3 text-[10px] font-mono text-slate-400">{el.id}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-slate-700 truncate max-w-[150px]">{el.name}</p>
                        <p className="text-[9px] text-slate-400 uppercase tracking-tight">{el.category}</p>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-900 text-right font-semibold">
                        {el.volume > 0 ? el.volume.toFixed(4) : <span className="text-slate-300 italic">Sin datos</span>}
                      </td>
                      {sortConfig && !['id', 'name', 'volume'].includes(sortConfig.key) && (
                        <td className="px-4 py-3 text-[10px] font-mono text-blue-600 text-right bg-blue-50/10">
                          {String(getNestedValue(el, sortConfig.key) || '-')}
                        </td>
                      )}
                    </tr>
                  ))}
                  {filteredElements.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-12 text-center text-slate-400 text-xs italic">
                        No se encontraron elementos que coincidan con la búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Selected Info (Always visible at bottom if something is selected) */}
        {selectedElementId && (
          <div className="bg-slate-900 p-6 rounded-2xl shadow-xl text-white">
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-4 h-4 text-blue-400" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Propiedades del Elemento</h3>
            </div>
            {elements.find(e => e.id === selectedElementId) ? (
              <div>
                <p className="text-lg font-light mb-1">{elements.find(e => e.id === selectedElementId)?.name}</p>
                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-4">
                  {elements.find(e => e.id === selectedElementId)?.category}
                </p>
                <div className="grid grid-cols-1 gap-4 pt-4 border-t border-white/10">
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] uppercase tracking-widest text-slate-500">ID Express (IFC)</p>
                    <p className="text-[10px] font-mono bg-slate-800 px-2 py-1 rounded">{selectedElementId}</p>
                  </div>
                  {elements.find(e => e.id === selectedElementId)?.globalId && (
                    <div className="flex justify-between items-center">
                      <p className="text-[9px] uppercase tracking-widest text-slate-500">Global ID (GUID)</p>
                      <p className="text-[10px] font-mono bg-slate-800 px-2 py-1 rounded">
                        {elements.find(e => e.id === selectedElementId)?.globalId}
                      </p>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] uppercase tracking-widest text-slate-500">Volumen Neto</p>
                    <p className="text-xl font-light text-emerald-400">
                      {elements.find(e => e.id === selectedElementId)?.volume.toFixed(4)} <span className="text-xs">m³</span>
                    </p>
                  </div>
                </div>

                {/* All Properties Section */}
                {elements.find(e => e.id === selectedElementId)?.properties && (
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <p className="text-[9px] uppercase tracking-widest text-slate-500 mb-3">Todas las Propiedades</p>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {Object.entries(elements.find(e => e.id === selectedElementId)?.properties || {}).map(([key, value]) => {
                        const displayValue = (v: any) => {
                          if (v && typeof v === 'object' && 'value' in v) return String(v.value);
                          if (typeof v === 'object') {
                            try {
                              return JSON.stringify(v);
                            } catch (e) {
                              return "[Object]";
                            }
                          }
                          return String(v);
                        };
                        if (typeof value === 'object' && value !== null && !('value' in value)) {
                          return (
                            <div key={key} className="bg-slate-800/50 p-2 rounded-lg">
                              <p className="text-[8px] text-blue-400 font-bold uppercase mb-1">{key}</p>
                              <div className="pl-2 space-y-1">
                                {Object.entries(value).map(([subKey, subValue]) => (
                                  <div key={subKey} className="flex justify-between gap-4">
                                    <span className="text-[8px] text-slate-500 truncate">{subKey}</span>
                                    <span className="text-[9px] text-slate-300 font-mono text-right">{displayValue(subValue)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div key={key} className="flex justify-between gap-4 py-1 border-b border-white/5 last:border-0">
                            <span className="text-[9px] text-slate-400">{key}</span>
                            <span className="text-[9px] text-slate-200 font-mono text-right">{displayValue(value)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm opacity-70 italic">Selecciona un elemento para ver detalles.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
