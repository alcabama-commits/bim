import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckSquare, Square } from 'lucide-react';

interface CategoryNode {
  name: string;
  children: string[];
}

interface ClassificationNode {
  name: string;
  categories: CategoryNode[];
}

interface SidebarProps {
  categories: ClassificationNode[];
  selectedClassifications: string[];
  selectedCategories: string[];
  selectedSubCategories: string[];
  onToggleClassification: (name: string) => void;
  onToggleCategory: (name: string) => void;
  onToggleSubCategory: (name: string) => void;
  materials: string[];
  selectedMaterial: string;
  onMaterialChange: (material: string) => void;
  onResetFilters: () => void;
}

export default function Sidebar({
  categories,
  selectedClassifications,
  selectedCategories,
  selectedSubCategories,
  onToggleClassification,
  onToggleCategory,
  onToggleSubCategory,
  materials,
  selectedMaterial,
  onMaterialChange,
  onResetFilters
}: SidebarProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (name: string) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="w-72 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Clasificación / Categoría</h3>
        <button 
          onClick={onResetFilters}
          className="p-1 hover:bg-slate-200 rounded transition-colors"
          title="Limpiar filtros"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {categories.map(classif => (
          <div key={classif.name} className="mb-2">
            <div 
              className="flex items-center gap-1 py-1 px-2 bg-slate-100/50 rounded cursor-pointer mb-1 group"
            >
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(classif.name);
                }}
                className="p-0.5 text-slate-500 hover:text-slate-700"
              >
                {expanded[classif.name] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              
              <button 
                onClick={() => onToggleClassification(classif.name)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                {selectedClassifications.includes(classif.name) ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-300" />
                )}
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">{classif.name}</span>
              </button>
            </div>

            {expanded[classif.name] && (
              <div className="ml-2 space-y-1">
                {classif.categories.map(cat => (
                  <div key={cat.name} className="mb-1">
                    <div className="flex items-center gap-1 py-1 px-2 hover:bg-slate-50 rounded cursor-pointer group">
                      <button 
                        onClick={() => toggleExpand(`${classif.name}-${cat.name}`)}
                        className="p-0.5 text-slate-400 hover:text-slate-600"
                      >
                        {expanded[`${classif.name}-${cat.name}`] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => onToggleCategory(cat.name)}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        {selectedCategories.includes(cat.name) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                        <span className="text-[11px] font-bold text-slate-700 uppercase">{cat.name}</span>
                      </button>
                    </div>
                    
                    {expanded[`${classif.name}-${cat.name}`] && (
                      <div className="ml-8 mt-1 space-y-1">
                        {cat.children.map(sub => (
                          <button 
                            key={sub}
                            onClick={() => onToggleSubCategory(sub)}
                            className="flex items-center gap-2 w-full py-1 px-2 hover:bg-slate-50 rounded text-left"
                          >
                            {selectedSubCategories.includes(sub) ? (
                              <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-slate-300" />
                            )}
                            <span className="text-[10px] text-slate-600">{sub}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Material</h3>
        <select 
          value={selectedMaterial}
          onChange={(e) => onMaterialChange(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
        >
          <option value="Todas">Todas</option>
          {materials.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
