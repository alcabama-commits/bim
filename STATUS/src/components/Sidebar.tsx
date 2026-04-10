import React, { useRef, useState } from 'react';
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
  levels: string[];
  selectedLevels: string[];
  onToggleLevel: (level: string) => void;
  diameters: string[];
  selectedDiameter: string;
  onDiameterChange: (diameter: string) => void;
  isStructureModel?: boolean;
  materials?: string[];
  selectedMaterial?: string;
  onMaterialChange?: (material: string) => void;
  pileNumbers?: string[];
  selectedPileNumbers?: string[];
  onTogglePileNumber?: (pile: string) => void;
  onSetSelectedPileNumbers?: (piles: string[]) => void;
  onClearPileSelection?: () => void;
  showPileLabels?: boolean;
  onToggleShowPileLabels?: () => void;
  onChangeSelectedPilesStatus?: (status: 'NINGUNO' | 'EN PROGRESO' | 'PARA INSPECCION' | 'APROBADO' | 'CERRADO' | 'RECHAZADO') => void;
  onResetFilters: () => void;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  categories,
  selectedClassifications,
  selectedCategories,
  selectedSubCategories,
  onToggleClassification,
  onToggleCategory,
  onToggleSubCategory,
  levels,
  selectedLevels,
  onToggleLevel,
  diameters,
  selectedDiameter,
  onDiameterChange,
  isStructureModel = false,
  materials = [],
  selectedMaterial = 'Todos',
  onMaterialChange,
  pileNumbers = [],
  selectedPileNumbers = [],
  onTogglePileNumber,
  onSetSelectedPileNumbers,
  onClearPileSelection,
  showPileLabels = false,
  onToggleShowPileLabels,
  onChangeSelectedPilesStatus,
  onResetFilters,
  onToggleCollapse
}: SidebarProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pileMenuOpen, setPileMenuOpen] = useState(false);
  const [pileMulti, setPileMulti] = useState(false);
  const [pileStatus, setPileStatus] = useState<'NINGUNO' | 'EN PROGRESO' | 'PARA INSPECCION' | 'APROBADO' | 'CERRADO' | 'RECHAZADO'>('EN PROGRESO');
  const lastActionAtRef = useRef(0);
  const tapRef = useRef<{ pointerId: number | null; x: number; y: number; moved: boolean }>({
    pointerId: null,
    x: 0,
    y: 0,
    moved: false
  });

  const toggleExpand = (name: string) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const runAction = (fn: () => void) => {
    const now = Date.now();
    if (now - lastActionAtRef.current < 60) return;
    lastActionAtRef.current = now;
    fn();
  };

  const togglePile = (pile: string) => {
    if (pileMulti) {
      if (onTogglePileNumber) onTogglePileNumber(pile);
      else if (onSetSelectedPileNumbers) {
        const next = new Set(selectedPileNumbers);
        if (next.has(pile)) next.delete(pile);
        else next.add(pile);
        onSetSelectedPileNumbers(Array.from(next));
      }
      return;
    }

    if (onSetSelectedPileNumbers) {
      if (selectedPileNumbers.length === 1 && selectedPileNumbers[0] === pile) onSetSelectedPileNumbers([]);
      else onSetSelectedPileNumbers([pile]);
      return;
    }

    if (!onTogglePileNumber || !onClearPileSelection) return;
    if (selectedPileNumbers.length === 1 && selectedPileNumbers[0] === pile) {
      onClearPileSelection();
      return;
    }
    onClearPileSelection();
    onTogglePileNumber(pile);
  };

  return (
    <div className="bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Clasificación / Categoría</h3>
        <div className="flex items-center gap-1">
          <button 
            onClick={onResetFilters}
            className="p-1 hover:bg-slate-200 rounded transition-colors"
            title="Limpiar filtros"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 hover:bg-slate-200 rounded transition-colors"
              title="Ocultar panel"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {categories.map(classif => (
            <div key={classif.name} className="mb-2">
              <div 
                className="flex items-center gap-2 py-3 md:py-1 px-3 md:px-2 bg-slate-100/50 rounded cursor-pointer mb-1 group touch-manipulation select-none"
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
                    <CheckSquare className="w-5 h-5 md:w-4 md:h-4 text-blue-600" />
                  ) : (
                    <Square className="w-5 h-5 md:w-4 md:h-4 text-slate-300" />
                  )}
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">{classif.name}</span>
                </button>
              </div>
  
              {expanded[classif.name] && (
                <div className="ml-2 space-y-1">
                  {classif.categories.map(cat => (
                    <div key={cat.name} className="mb-1">
                      <div className="flex items-center gap-2 py-3 md:py-1 px-3 md:px-2 hover:bg-slate-50 rounded cursor-pointer group touch-manipulation select-none">
                        {cat.children.length > 0 ? (
                          <button 
                            onClick={() => toggleExpand(`${classif.name}-${cat.name}`)}
                            className="p-0.5 text-slate-400 hover:text-slate-600"
                          >
                            {expanded[`${classif.name}-${cat.name}`] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        ) : (
                          <div className="w-5" />
                        )}
                        <button 
                          onClick={() => onToggleCategory(cat.name)}
                          className="flex items-center gap-2 flex-1 text-left"
                        >
                          {selectedCategories.includes(cat.name) ? (
                            <CheckSquare className="w-5 h-5 md:w-4 md:h-4 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 md:w-4 md:h-4 text-slate-300" />
                          )}
                          <span className="text-[11px] font-bold text-slate-700 uppercase">{cat.name}</span>
                        </button>
                      </div>
                      
                      {cat.children.length > 0 && expanded[`${classif.name}-${cat.name}`] && (
                        <div className="ml-8 mt-1 space-y-1">
                          {cat.children.map(sub => (
                            <button 
                              key={sub}
                              onClick={() => onToggleSubCategory(sub)}
                              className="flex items-center gap-2 w-full py-3 md:py-1 px-3 md:px-2 hover:bg-slate-50 rounded text-left touch-manipulation select-none"
                            >
                              {selectedSubCategories.includes(sub) ? (
                                <CheckSquare className="w-5 h-5 md:w-3.5 md:h-3.5 text-blue-600" />
                              ) : (
                                <Square className="w-5 h-5 md:w-3.5 md:h-3.5 text-slate-300" />
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
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Niveles</h3>
          <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
            {[...levels].sort((a, b) => {
              const aNum = parseFloat(a.match(/-?\d+(\.\d+)?/)?.[0] || '0');
              const bNum = parseFloat(b.match(/-?\d+(\.\d+)?/)?.[0] || '0');
              return aNum - bNum;
            }).map((level) => {
              const isSelected = selectedLevels.includes(level);
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => onToggleLevel(level)}
                  className={`px-2 py-3 md:py-2 text-[11px] md:text-[10px] font-medium rounded transition-all border text-center leading-tight touch-manipulation select-none ${
                    isSelected
                      ? 'bg-blue-600 border-blue-700 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {level || '(En blanco)'}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          {isStructureModel ? (
            <>
              <div className="flex items-center justify-between gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => runAction(() => setPileMenuOpen((v) => !v))}
                  onPointerUp={() => runAction(() => setPileMenuOpen((v) => !v))}
                  className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest touch-manipulation select-none"
                  title={pileMenuOpen ? 'Ocultar menú' : 'Mostrar menú'}
                >
                  <span>Número de pilote</span>
                  {pileMenuOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => runAction(() => setPileMulti((v) => !v))}
                    onPointerUp={() => runAction(() => setPileMulti((v) => !v))}
                    className={`px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-widest ${
                      pileMulti ? 'bg-[#003E52] text-white border-[#003E52]' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    } touch-manipulation select-none`}
                    title="Activar o desactivar marcación múltiple"
                  >
                    {pileMulti ? 'Múltiple' : 'Único'}
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction(() => onClearPileSelection?.())}
                    onPointerUp={() => runAction(() => onClearPileSelection?.())}
                    className="px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-700 disabled:opacity-60 touch-manipulation select-none"
                    disabled={!onClearPileSelection || selectedPileNumbers.length === 0}
                    title="Limpiar selección de pilotes"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              <div className="text-[10px] font-bold text-slate-600 mb-2">
                Seleccionados: {selectedPileNumbers.length}
              </div>

              {pileMenuOpen && (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  {pileNumbers.length === 0 ? (
                    <div className="text-[10px] text-slate-500">No se encontraron pilotes en el modelo.</div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {pileNumbers.map((p) => {
                        const checked = selectedPileNumbers.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => runAction(() => togglePile(p))}
                            onPointerDown={(e) => {
                              tapRef.current.pointerId = e.pointerId;
                              tapRef.current.x = e.clientX;
                              tapRef.current.y = e.clientY;
                              tapRef.current.moved = false;
                              try {
                                (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
                              } catch {
                              }
                            }}
                            onPointerMove={(e) => {
                              if (tapRef.current.pointerId !== e.pointerId) return;
                              const dx = Math.abs(e.clientX - tapRef.current.x);
                              const dy = Math.abs(e.clientY - tapRef.current.y);
                              if (dx > 10 || dy > 10) tapRef.current.moved = true;
                            }}
                            onPointerUp={(e) => {
                              if (tapRef.current.pointerId !== e.pointerId) return;
                              const moved = tapRef.current.moved;
                              tapRef.current.pointerId = null;
                              tapRef.current.moved = false;
                              try {
                                (e.currentTarget as HTMLButtonElement).releasePointerCapture(e.pointerId);
                              } catch {
                              }
                              if (!moved) runAction(() => togglePile(p));
                            }}
                            className={`aspect-square rounded-lg border text-sm font-black transition-colors ${
                              checked ? 'bg-[#003E52] text-white border-[#003E52]' : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                            } touch-manipulation select-none active:scale-[0.98]`}
                            disabled={!onTogglePileNumber && !onSetSelectedPileNumbers}
                            title={`Seleccionar pilote ${p}`}
                          >
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <select
                  value={pileStatus}
                  onChange={(e) => setPileStatus(e.target.value as any)}
                  className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600"
                >
                  <option value="EN PROGRESO">EN PROGRESO</option>
                  <option value="PARA INSPECCION">PARA INSPECCION</option>
                  <option value="APROBADO">APROBADO</option>
                  <option value="CERRADO">CERRADO</option>
                  <option value="RECHAZADO">RECHAZADO</option>
                  <option value="NINGUNO">NINGUNO</option>
                </select>
                <button
                  type="button"
                  onClick={() => runAction(() => onChangeSelectedPilesStatus?.(pileStatus))}
                  onPointerUp={() => runAction(() => onChangeSelectedPilesStatus?.(pileStatus))}
                  className="px-3 py-1 rounded bg-[#003d4d] text-white text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-40 touch-manipulation select-none"
                  disabled={!onChangeSelectedPilesStatus || selectedPileNumbers.length === 0}
                  title="Aplicar estado a pilotes seleccionados"
                >
                  Aplicar
                </button>
              </div>

              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 mt-4">Material</h3>
              <select
                value={selectedMaterial}
                onChange={(e) => onMaterialChange?.(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                disabled={!onMaterialChange}
              >
                <option value="Todos">Todos</option>
                {materials.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Diámetros</h3>
              <select
                value={selectedDiameter}
                onChange={(e) => onDiameterChange(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="Todos">Todos</option>
                {diameters.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
