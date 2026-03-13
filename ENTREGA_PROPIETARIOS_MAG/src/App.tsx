/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, CheckCircle2, Clock, Info, Search, Lock, Save, Loader2, Eye, EyeOff } from 'lucide-react';
import { 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { fetchSheetData, updateSheetStatus, SheetData } from './services/sheetService';
import { API_CONFIG } from './config';

// --- Types ---

type Status = 'owner_delivered' | 'post_construction_delivered' | 'notarized' | 'weekly_goal' | 'in_process' | 'special' | 'under_construction';
type Tab = 'towers' | 'charts';

const getStatusLabel = (status: Status) => {
  switch (status) {
    case 'owner_delivered': return 'Entregado a propietario';
    case 'post_construction_delivered': return 'Entregado a Post construcción';
    case 'notarized': return 'Escriturado';
    case 'weekly_goal': return 'Lista meta semanal';
    case 'in_process': return 'Sin proceso';
    case 'under_construction': return 'En obra';
    case 'special': return 'Área Especial';
    default: return '';
  }
};

interface Apartment {
  id: string;
  number: string;
  status: Status;
  weeklyGoalDate?: string | null;
}

interface Tower {
  id: number;
  name: string;
  apartments: Apartment[];
}

interface PendingChange {
  towerId: number;
  aptNumber: string;
  status: Status;
  weeklyGoalDate?: string | null;
}

// --- Constants & Mock Data Generation ---

const TOTAL_TOWERS = 21;
const FLOORS_PER_TOWER = 9;
const APTS_PER_FLOOR = 4;

const generateStructure = (): Tower[] => {
  const towers: Tower[] = [];
  
  for (let t = 1; t <= TOTAL_TOWERS; t++) {
    const apartments: Apartment[] = [];
    for (let f = 1; f <= FLOORS_PER_TOWER; f++) {
      for (let a = 1; a <= APTS_PER_FLOOR; a++) {
        const aptNumber = `${f}0${a}`;
        let status: Status = 'in_process'; // Default status
        
        // Special case for COW as seen in the image (Tower 1, Floor 1, Position 4)
        if (f === 1 && a === 4) {
          status = 'special';
        }

        apartments.push({
          id: `t${t}-f${f}-a${a}`,
          number: status === 'special' ? 'COW' : aptNumber,
          status: status,
        });
      }
    }
    towers.push({
      id: t,
      name: `TORRE ${t}`,
      apartments,
    });
  }
  return towers;
};

// --- Components ---

const ApartmentCell = ({ 
  apartment, 
  onClick 
}: { 
  apartment: Apartment; 
  onClick: (apt: Apartment) => void;
  key?: string;
}) => {
  const getStatusStyles = (status: Status) => {
    switch (status) {
      case 'owner_delivered':
        return 'bg-blue-600 text-white border-blue-700';
      case 'post_construction_delivered':
        return 'bg-green-500 text-white border-green-600';
      case 'notarized':
        return 'bg-orange-500 text-white border-orange-600';
      case 'weekly_goal':
        return 'bg-red-600 text-white border-red-700';
      case 'in_process':
        return 'bg-white text-alcabama-black border-alcabama-light-grey';
      case 'under_construction':
        return 'bg-gray-400 text-white border-gray-500';
      case 'special':
        return 'bg-white text-alcabama-black border-alcabama-light-grey italic opacity-60';
      default:
        return 'bg-white text-alcabama-black border-alcabama-light-grey';
    }
  };

  return (
    <div
      onClick={() => onClick(apartment)}
      className={`
        flex items-center justify-center h-8 w-full text-[10px] font-medium border
        transition-all duration-200 hover:scale-110 hover:z-10 cursor-pointer shadow-sm
        ${getStatusStyles(apartment.status)}
      `}
      title={`Apartamento ${apartment.number} - ${getStatusLabel(apartment.status)}${apartment.status === 'weekly_goal' && apartment.weeklyGoalDate ? ` (${apartment.weeklyGoalDate})` : ''}`}
    >
      {apartment.number}
    </div>
  );
};

const TowerCard = ({ 
  tower, 
  onApartmentClick,
  statusFilter,
  weeklyGoalDateFilter
}: { 
  tower: Tower; 
  onApartmentClick: (apt: Apartment) => void;
  statusFilter: Status | null;
  weeklyGoalDateFilter: string | null;
  key?: string;
}) => {
  // Group apartments by floor (descending)
  const floors = useMemo(() => {
    const grouped: Record<number, Apartment[]> = {};
    tower.apartments.forEach((apt) => {
      const floorNum = parseInt(apt.id.split('-')[1].substring(1));
      if (!grouped[floorNum]) grouped[floorNum] = [];
      grouped[floorNum].push(apt);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => parseInt(b) - parseInt(a))
      .map(([floor, apts]) => ({ floor: parseInt(floor), apts }));
  }, [tower]);

  const towerStats = useMemo(() => ({
    owner: tower.apartments.filter(a => a.status === 'owner_delivered').length,
    post: tower.apartments.filter(a => a.status === 'post_construction_delivered').length,
    notarized: tower.apartments.filter(a => a.status === 'notarized').length,
    weekly: tower.apartments.filter(a => a.status === 'weekly_goal').length,
    process: tower.apartments.filter(a => a.status === 'in_process').length,
    underConstruction: tower.apartments.filter(a => a.status === 'under_construction').length,
    total: tower.apartments.filter(a => a.status !== 'special').length,
  }), [tower]);

  const ownerPercentage = towerStats.total > 0
    ? Math.round((towerStats.owner / towerStats.total) * 100)
    : 0;

  const filteredCount = statusFilter
    ? tower.apartments.filter(a =>
        a.status === statusFilter &&
        (statusFilter !== 'weekly_goal' || !weeklyGoalDateFilter || a.weeklyGoalDate === weeklyGoalDateFilter)
      ).length
    : towerStats.total;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className={`bg-white rounded-xl shadow-lg overflow-hidden border border-alcabama-light-grey flex flex-col ${statusFilter && filteredCount === 0 ? 'opacity-40' : ''}`}
    >
      <div className="bg-alcabama-black text-white py-2 px-4 text-center font-bold text-sm tracking-wider">
        {statusFilter
          ? `${tower.name} - ${getStatusLabel(statusFilter)}${statusFilter === 'weekly_goal' && weeklyGoalDateFilter ? ` ${weeklyGoalDateFilter}` : ''} (${filteredCount})`
          : `${tower.name} - ${ownerPercentage}%`}
      </div>
      
      <div className="p-3 flex-1">
        <div className="grid grid-cols-[40px_1fr] gap-1">
          {/* Header Row */}
          <div className="text-[8px] font-bold text-alcabama-grey flex items-center justify-center uppercase">
            Piso
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="text-[8px] font-bold text-alcabama-grey text-center uppercase">
                Apt {n}
              </div>
            ))}
          </div>

          {/* Floor Rows */}
          {floors.map(({ floor, apts }) => (
            <React.Fragment key={floor}>
              <div className="flex items-center justify-center text-[10px] font-bold text-alcabama-dark-grey bg-alcabama-light-grey/20 rounded">
                P{floor}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {apts.map((apt) => (
                  statusFilter && (
                    apt.status !== statusFilter ||
                    (statusFilter === 'weekly_goal' && weeklyGoalDateFilter && apt.weeklyGoalDate !== weeklyGoalDateFilter)
                  )
                    ? <div key={apt.id} className="h-8 w-full" />
                    : (
                      <ApartmentCell
                        key={apt.id}
                        apartment={apt}
                        onClick={onApartmentClick}
                      />
                    )
                ))}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="bg-alcabama-light-grey/5 px-4 py-3 border-t border-alcabama-light-grey grid grid-cols-2 gap-2 text-xs text-alcabama-dark-grey leading-tight">
        <div className="flex items-start gap-2">
          <div className="w-2.5 h-2.5 bg-blue-600 rounded-sm shrink-0 mt-0.5" />
          <span className="break-words">Propietarios: <strong className="font-bold">{towerStats.owner}</strong></span>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-2.5 h-2.5 bg-green-500 rounded-sm shrink-0 mt-0.5" />
          <span className="break-words">Post Const.: <strong className="font-bold">{towerStats.post}</strong></span>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-2.5 h-2.5 bg-orange-500 rounded-sm shrink-0 mt-0.5" />
          <span className="break-words">Escriturado: <strong className="font-bold">{towerStats.notarized}</strong></span>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-2.5 h-2.5 bg-red-600 rounded-sm shrink-0 mt-0.5" />
          <span className="break-words">Meta Semanal: <strong className="font-bold">{towerStats.weekly}</strong></span>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-2.5 h-2.5 bg-gray-400 border border-gray-500 rounded-sm shrink-0 mt-0.5" />
          <span className="break-words">En obra: <strong className="font-bold">{towerStats.underConstruction}</strong></span>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-2.5 h-2.5 bg-white border border-alcabama-light-grey rounded-sm shrink-0 mt-0.5" />
          <span className="break-words">Sin proceso: <strong className="font-bold">{towerStats.process}</strong></span>
        </div>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | null>(null);
  const [weeklyGoalDateFilter, setWeeklyGoalDateFilter] = useState<string | null>(null);
  const [weeklyGoalDateInput, setWeeklyGoalDateInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [timelineDateFilter, setTimelineDateFilter] = useState(() => new Date().toISOString().slice(0, 10));
  // activeTab removed
  const [allTowers, setAllTowers] = useState<Tower[]>(() => generateStructure());
  const [editingApartment, setEditingApartment] = useState<{ towerId: number, apartment: Apartment } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    if (!editingApartment) return;
    const d = editingApartment.apartment.weeklyGoalDate;
    const fallback = new Date().toISOString().slice(0, 10);
    setWeeklyGoalDateInput(typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : fallback);
  }, [editingApartment]);

  // Load data from Google Sheets
  React.useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchSheetData();
        if (data && data.length > 0) {
          setAllTowers(prevTowers => {
            // Create a map for faster lookup: "towerId-aptNumber" -> status
            const statusMap = new Map<string, { status: Status; weeklyGoalDate?: string | null }>();
            data.forEach(item => {
              const status = item.status as Status;
              statusMap.set(`${item.towerId}-${item.aptNumber}`, {
                status,
                weeklyGoalDate: (item as SheetData).weeklyGoalDate ?? null
              });
            });
            
            return prevTowers.map(tower => ({
              ...tower,
              apartments: tower.apartments.map(apt => {
                const key = `${tower.id}-${apt.number}`;
                const entry = statusMap.get(key);
                
                // Only update if we have a valid status and it's not a special area
                if (entry?.status && apt.status !== 'special') {
                   return { ...apt, status: entry.status, weeklyGoalDate: entry.status === 'weekly_goal' ? (entry.weeklyGoalDate ?? null) : null };
                }
                return apt;
              })
            }));
          });
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Password Protection State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [pendingStatus, setPendingStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());
  const [isSaving, setIsSaving] = useState(false);

  // Warn before unload if there are pending changes
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingChanges.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingChanges]);

  const handleStatusChange = (newStatus: Status) => {
    if (!editingApartment) return;
    
    // If in edit mode, apply change immediately
    if (isEditMode) {
      // Optimistic update
      setAllTowers(prev => prev.map(tower => {
        if (tower.id !== editingApartment.towerId) return tower;
        return {
          ...tower,
          apartments: tower.apartments.map(apt => 
            apt.id === editingApartment.apartment.id
              ? { ...apt, status: newStatus, weeklyGoalDate: newStatus === 'weekly_goal' ? weeklyGoalDateInput : null }
              : apt
          )
        };
      }));

      // Add to pending changes
      setPendingChanges(prev => {
        const newMap = new Map(prev);
        const key = `${editingApartment.towerId}-${editingApartment.apartment.number}`;
        newMap.set(key, {
          towerId: editingApartment.towerId,
          aptNumber: editingApartment.apartment.number,
          status: newStatus,
          weeklyGoalDate: newStatus === 'weekly_goal' ? weeklyGoalDateInput : null
        });
        return newMap;
      });

      setEditingApartment(null);
    } else {
      // If not in edit mode, this shouldn't happen via UI but as a safeguard
      // we can prompt for edit mode or just ignore. 
    }
  };

  const handleSaveChanges = async () => {
    if (pendingChanges.size === 0) return;
    
    setIsSaving(true);
    
    try {
      // Process all pending changes
      // Since GAS API (as implemented) handles one by one, we loop.
      // Ideally we would update GAS to handle batch, but for now we loop.
      const changes: PendingChange[] = Array.from(pendingChanges.values());
      let successCount = 0;
      
      // Execute sequentially to avoid overwhelming the script/rate limits if any
      for (const change of changes) {
        const success = await updateSheetStatus(change.towerId, change.aptNumber, change.status, change.weeklyGoalDate);
        if (success) successCount++;
      }
      
      if (successCount === changes.length) {
        setPendingChanges(new Map<string, PendingChange>());
      } else {
        console.error(`Failed to save ${changes.length - successCount} changes`);
        // We could keep failed changes in the map, but for simplicity let's clear all 
        // and rely on the user to check if something looks wrong or just re-edit.
        // Or better: keep failed ones? 
        // For now, let's clear and assume retries will happen if user notices.
        setPendingChanges(new Map<string, PendingChange>()); 
        alert('Algunos cambios no se pudieron guardar. Por favor verifica.');
      }
    } catch (err) {
      console.error('Error saving changes:', err);
      alert('Error al guardar cambios.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnableEditMode = () => {
    setShowPasswordModal(true);
    setPassword('');
    setError('');
    setShowPassword(false);
  };

  const confirmStatusChange = () => {
    if (password === 'Alcabama2026') {
      setIsEditMode(true);
      setShowPasswordModal(false);
      setPassword('');
    } else {
      setError('Contraseña incorrecta');
    }
  };

  const filteredTowers = useMemo(() => {
    return allTowers.filter(t => 
      t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allTowers, searchTerm]);

  const stats = useMemo(() => {
    const total = allTowers.reduce((acc, t) => acc + t.apartments.filter(a => a.status !== 'special').length, 0);
    const ownerDelivered = allTowers.reduce((acc, t) => acc + t.apartments.filter(a => a.status === 'owner_delivered').length, 0);
    const postConstruction = allTowers.reduce((acc, t) => acc + t.apartments.filter(a => a.status === 'post_construction_delivered').length, 0);
    const notarized = allTowers.reduce((acc, t) => acc + t.apartments.filter(a => a.status === 'notarized').length, 0);
    const weeklyGoal = allTowers.reduce((acc, t) => acc + t.apartments.filter(a => a.status === 'weekly_goal').length, 0);
    const inProcess = allTowers.reduce((acc, t) => acc + t.apartments.filter(a => a.status === 'in_process').length, 0);
    const underConstruction = allTowers.reduce((acc, t) => acc + t.apartments.filter(a => a.status === 'under_construction').length, 0);
    
    return {
      total,
      ownerDelivered,
      postConstruction,
      notarized,
      weeklyGoal,
      inProcess,
      underConstruction,
      percentage: Math.round((ownerDelivered / total) * 100)
    };
  }, [allTowers]);

  const weeklyGoalTimeline = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    const isISODate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const addDaysISO = (iso: string, days: number) => {
      const d = new Date(`${iso}T00:00:00`);
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };

    const scheduled = allTowers.flatMap(tower =>
      tower.apartments
        .filter(a => a.status === 'weekly_goal')
        .map(a => ({
          towerId: tower.id,
          towerName: tower.name,
          aptNumber: a.number,
          date: a.weeklyGoalDate ?? null
        }))
        .filter(i => isISODate(i.date))
    );

    const byDate = new Map<string, typeof scheduled>();
    for (const item of scheduled) {
      const current = byDate.get(item.date);
      if (current) current.push(item);
      else byDate.set(item.date, [item]);
    }

    const anchor = isISODate(timelineDateFilter) ? timelineDateFilter : today;
    const start = addDaysISO(anchor, -6);

    const days = Array.from({ length: 13 }, (_, i) => {
      const date = addDaysISO(start, i);
      const kind =
        date < today ? 'overdue' :
        date === today ? 'today' :
        'upcoming';

      return {
        indexLabel: String(i).padStart(2, '0'),
        date,
        kind,
        items: byDate.get(date) ?? []
      };
    });

    const selectedDate = isISODate(timelineDateFilter) ? timelineDateFilter : today;

    return {
      total: scheduled.length,
      today,
      selectedDate,
      days,
      byDate
    };
  }, [allTowers, timelineDateFilter]);

  const pieData = [
    { name: 'Propietario', value: stats.ownerDelivered, color: '#2563eb' },
    { name: 'Post Const.', value: stats.postConstruction, color: '#22c55e' },
    { name: 'Escriturado', value: stats.notarized, color: '#f97316' },
    { name: 'Meta Semanal', value: stats.weeklyGoal, color: '#dc2626' },
    { name: 'En Obra', value: stats.underConstruction, color: '#9ca3af' },
    { name: 'Sin Proceso', value: stats.inProcess, color: '#e5e7eb' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-alcabama-white">
      {/* Navigation / Header */}
      <header className="bg-white border-b border-alcabama-light-grey sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            <div className="flex items-center">
              <img 
                src="https://i.postimg.cc/GmWLmfZZ/Logo-transparente_negro.png" 
                alt="Alcabama Logo" 
                className="h-10 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            
            {/* Thin Pink Line */}
            <div className="flex-1 mx-12 h-[1px] bg-alcabama-pink/40 hidden md:block" />

            <div className="flex items-center gap-6">
              <img 
                src="https://i.postimg.cc/g2Qx69g0/1669399714-logo-magnolias-web-01.jpg" 
                alt="Magnolias Logo" 
                className="h-16 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Secondary Header for Stats & Search */}
      <div className="bg-alcabama-light-grey/5 border-b border-alcabama-light-grey/20 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-8">
              <div className="hidden sm:flex items-center gap-4">
                {/* Save Button */}
                {isEditMode && pendingChanges.size > 0 && (
                  <button
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {isSaving ? 'Guardando...' : `Guardar (${pendingChanges.size})`}
                  </button>
                )}

                {/* Edit Mode Toggle */}
                <button
                  onClick={() => {
                    if (isEditMode) {
                      setIsEditMode(false);
                    } else {
                      handleEnableEditMode();
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    isEditMode 
                      ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' 
                      : 'bg-white text-alcabama-grey border border-alcabama-light-grey hover:bg-alcabama-light-grey/10'
                  }`}
                >
                  <Lock size={14} className={isEditMode ? 'text-white' : 'text-alcabama-grey'} />
                  {isEditMode ? 'Edición Activa' : 'Habilitar Edición'}
                </button>
              </div>
            </div>

            <div className="relative w-full md:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-alcabama-grey" size={14} />
                <input 
                  type="text" 
                  placeholder="Buscar torre..."
                  className="bg-white border border-alcabama-light-grey rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-alcabama-pink transition-all w-full md:w-64 shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* General Progress Chart Section */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-alcabama-light-grey mb-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              
              {/* Left Side: Stacked Progress Bar (Rectangle) */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-end mb-1">
                   <h3 className="text-sm font-bold uppercase tracking-wider text-alcabama-grey">Progreso General</h3>
                   <span className="text-xs font-medium text-alcabama-light-grey">{stats.ownerDelivered} / {stats.total} Entregados</span>
                </div>
                
                {/* The Progress Bar Container */}
                <div className="h-16 w-full flex rounded-xl overflow-hidden bg-gray-100 relative shadow-inner">
                  {pieData.map((item, index) => {
                     const widthPercent = stats.total > 0 ? (item.value / stats.total) * 100 : 0;
                     if (widthPercent <= 0) return null;
                     return (
                       <div 
                         key={item.name}
                         className="h-full relative group transition-all duration-500 ease-out hover:opacity-90 flex items-center justify-center overflow-hidden"
                         style={{ width: `${widthPercent}%`, backgroundColor: item.color }}
                       >
                         {/* Text inside bar if wide enough */}
                         {widthPercent > 8 && (
                            <span className={`text-[10px] md:text-xs font-bold drop-shadow-md ${item.name === 'Sin Proceso' ? 'text-alcabama-dark-grey' : 'text-white'}`}>
                                {Math.round(widthPercent)}%
                            </span>
                         )}

                         {/* Tooltip on Hover */}
                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                           <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl whitespace-nowrap">
                             <div className="font-bold mb-0.5">{item.name}</div>
                             <div>{item.value} unidades ({Math.round(widthPercent)}%)</div>
                             {/* Triangle arrow */}
                             <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                           </div>
                         </div>
                       </div>
                     );
                  })}
                </div>

                {/* Compact Legend */}
                <div className="flex flex-wrap gap-x-6 gap-y-3 mt-4">
                   {pieData.map((item) => {
                      const percent = stats.total > 0 ? ((item.value / stats.total) * 100).toFixed(1) : '0';
                      return (
                        <div key={item.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color, border: item.name === 'Sin Proceso' ? '1px solid #e5e7eb' : 'none' }} />
                          <div className="flex flex-col leading-none">
                             <span className="text-[10px] font-bold text-alcabama-dark-grey uppercase tracking-wide">{item.name}</span>
                             <span className="text-[10px] text-alcabama-grey font-medium mt-0.5">{percent}% ({item.value})</span>
                          </div>
                        </div>
                      );
                   })}
                </div>
              </div>
              
              {/* Right Side: Big Total Number */}
              <div className="flex flex-col items-center justify-center md:border-l md:border-alcabama-light-grey h-full py-4">
                 <span className="text-sm font-bold text-alcabama-grey uppercase tracking-wider mb-2">Total Unidades</span>
                 <span className="text-7xl font-black text-alcabama-black tracking-tight">{stats.total}</span>
                 <div className="mt-2 text-xs text-alcabama-light-grey font-medium bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                    100% del proyecto
                 </div>
              </div>

            </div>

              {/* Dashboard Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-12">
                {[
                  {
                    status: 'owner_delivered' as const,
                    count: stats.ownerDelivered,
                    label: 'Entregado Propietario',
                    iconClassName: 'w-10 h-10 bg-blue-600 rounded-lg mb-2 flex items-center justify-center text-white font-bold',
                    activeClassName: 'ring-2 ring-offset-2 ring-blue-600 border-blue-600',
                    hoverClassName: 'hover:border-blue-600'
                  },
                  {
                    status: 'post_construction_delivered' as const,
                    count: stats.postConstruction,
                    label: 'Post Construcción',
                    iconClassName: 'w-10 h-10 bg-green-500 rounded-lg mb-2 flex items-center justify-center text-white font-bold',
                    activeClassName: 'ring-2 ring-offset-2 ring-green-500 border-green-500',
                    hoverClassName: 'hover:border-green-500'
                  },
                  {
                    status: 'notarized' as const,
                    count: stats.notarized,
                    label: 'Escriturado',
                    iconClassName: 'w-10 h-10 bg-orange-500 rounded-lg mb-2 flex items-center justify-center text-white font-bold',
                    activeClassName: 'ring-2 ring-offset-2 ring-orange-500 border-orange-500',
                    hoverClassName: 'hover:border-orange-500'
                  },
                  {
                    status: 'weekly_goal' as const,
                    count: stats.weeklyGoal,
                    label: 'Meta Semanal',
                    iconClassName: 'w-10 h-10 bg-red-600 rounded-lg mb-2 flex items-center justify-center text-white font-bold',
                    activeClassName: 'ring-2 ring-offset-2 ring-red-600 border-red-600',
                    hoverClassName: 'hover:border-red-600'
                  },
                  {
                    status: 'under_construction' as const,
                    count: stats.underConstruction,
                    label: 'En Obra',
                    iconClassName: 'w-10 h-10 bg-gray-400 rounded-lg mb-2 flex items-center justify-center text-white font-bold',
                    activeClassName: 'ring-2 ring-offset-2 ring-gray-400 border-gray-500',
                    hoverClassName: 'hover:border-gray-500'
                  },
                  {
                    status: 'in_process' as const,
                    count: stats.inProcess,
                    label: 'Sin Proceso',
                    iconClassName: 'w-10 h-10 bg-white border border-alcabama-light-grey rounded-lg mb-2 flex items-center justify-center text-alcabama-black font-bold',
                    activeClassName: 'ring-2 ring-offset-2 ring-alcabama-black border-alcabama-black',
                    hoverClassName: 'hover:border-alcabama-black'
                  }
                ].map((card) => {
                  const isActive = statusFilter === card.status;
                  return (
                    <button
                      key={card.status}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        const next = statusFilter === card.status ? null : card.status;
                        setStatusFilter(next);
                        if (next !== 'weekly_goal') setWeeklyGoalDateFilter(null);
                      }}
                      className={`bg-white p-4 rounded-xl shadow-sm border border-alcabama-light-grey flex flex-col items-center text-center transition-all ${isActive ? card.activeClassName : card.hoverClassName}`}
                    >
                      <div className={card.iconClassName}>
                        {card.count}
                      </div>
                      <p className="text-[10px] text-alcabama-grey uppercase font-bold tracking-wider leading-tight">{card.label}</p>
                    </button>
                  );
                })}
              </div>

              {statusFilter && (
                <div className="mb-8 flex items-center justify-between gap-4 bg-alcabama-light-grey/5 p-4 rounded-xl border border-alcabama-light-grey/20">
                  <div className="flex items-center gap-6">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey">
                      Filtro: <span className="text-alcabama-black">{getStatusLabel(statusFilter)}</span>
                    </div>
                    {statusFilter === 'weekly_goal' && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey">Fecha</span>
                        <input
                          type="date"
                          value={weeklyGoalDateFilter ?? ''}
                          onChange={(e) => setWeeklyGoalDateFilter(e.target.value ? e.target.value : null)}
                          className="h-9 rounded-lg border border-alcabama-light-grey px-3 text-xs text-alcabama-dark-grey"
                        />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter(null);
                      setWeeklyGoalDateFilter(null);
                    }}
                    className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey hover:text-alcabama-black transition-colors"
                  >
                    Quitar filtro
                  </button>
                </div>
              )}

              <div className="mb-8 bg-white rounded-xl shadow-sm border border-alcabama-light-grey p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey">Línea de tiempo</div>
                    <div className="text-xs text-alcabama-dark-grey mt-1">
                      Entregas pendientes (Lista meta semanal): <strong className="font-bold">{weeklyGoalTimeline.total}</strong>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey">Fecha</span>
                      <input
                        type="date"
                        value={weeklyGoalTimeline.selectedDate}
                        onChange={(e) => setTimelineDateFilter(e.target.value)}
                        className="h-9 rounded-lg border border-alcabama-light-grey px-3 text-xs text-alcabama-dark-grey"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('weekly_goal');
                        setWeeklyGoalDateFilter(weeklyGoalTimeline.selectedDate);
                      }}
                      className="h-9 px-3 rounded-lg bg-alcabama-black text-white text-[10px] font-bold uppercase tracking-wider hover:bg-black transition-colors"
                    >
                      Ver en torres
                    </button>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-start justify-between gap-2">
                    {weeklyGoalTimeline.days.map((day) => {
                      const isSelected = weeklyGoalTimeline.selectedDate === day.date;
                      const labelClass = isSelected
                        ? 'bg-alcabama-pink text-white border-alcabama-pink'
                        : 'bg-alcabama-light-grey/10 text-alcabama-dark-grey border-alcabama-light-grey/40';

                      return (
                        <button
                          key={day.date}
                          type="button"
                          onClick={() => setTimelineDateFilter(day.date)}
                          className="flex-1 flex flex-col items-center gap-2"
                        >
                          <div className={`w-10 h-10 rounded-md border flex items-center justify-center text-xs font-black tracking-wider ${labelClass}`}>
                            {day.indexLabel}
                          </div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey">
                            {day.date.slice(8, 10)}/{day.date.slice(5, 7)}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative mt-3">
                    <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-[2px] bg-alcabama-pink/40" />
                    <div className="flex items-center justify-between gap-2">
                      {weeklyGoalTimeline.days.map((day) => {
                        const isSelected = weeklyGoalTimeline.selectedDate === day.date;
                        const hasItems = day.items.length > 0;
                        const dotBase =
                          day.kind === 'overdue'
                            ? 'bg-red-600 border-red-700'
                            : day.kind === 'today'
                              ? 'bg-orange-500 border-orange-600'
                              : 'bg-alcabama-pink border-alcabama-pink';

                        const dotClass = hasItems
                          ? `${dotBase} shadow-md`
                          : 'bg-white border-alcabama-light-grey';

                        const sizeClass = isSelected ? 'w-4 h-4' : hasItems ? 'w-3 h-3' : 'w-2.5 h-2.5';

                        return (
                          <button
                            key={`${day.date}-dot`}
                            type="button"
                            onClick={() => setTimelineDateFilter(day.date)}
                            className="flex-1 relative flex items-center justify-center py-4"
                            aria-label={`Día ${day.date}`}
                          >
                            <span className={`rounded-full border ${dotClass} ${sizeClass}`} />
                            {hasItems && (
                              <span className={`absolute -top-1 text-[10px] font-black ${isSelected ? 'text-alcabama-black' : 'text-alcabama-grey'}`}>
                                {day.items.length}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-alcabama-light-grey/50 bg-alcabama-light-grey/5 p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div className="text-sm font-bold text-alcabama-black">
                        {weeklyGoalTimeline.selectedDate}
                      </div>
                      <div className="text-xs text-alcabama-grey">
                        {weeklyGoalTimeline.byDate.get(weeklyGoalTimeline.selectedDate)?.length ?? 0} aptos programados
                      </div>
                    </div>

                    {(() => {
                      const selectedItems = weeklyGoalTimeline.byDate.get(weeklyGoalTimeline.selectedDate) ?? [];
                      if (selectedItems.length === 0) {
                        return <div className="mt-3 text-sm text-alcabama-grey">No hay entregas programadas para este día.</div>;
                      }

                      const byTower = new Map<number, string[]>();
                      for (const item of selectedItems) {
                        const current = byTower.get(item.towerId);
                        if (current) current.push(item.aptNumber);
                        else byTower.set(item.towerId, [item.aptNumber]);
                      }

                      const towers = Array.from(byTower.entries()).sort(([a], [b]) => a - b);

                      return (
                        <div className="mt-3 space-y-2">
                          {towers.map(([towerId, apts]) => (
                            <div key={towerId} className="flex flex-wrap items-center gap-2">
                              <span className="px-2 py-1 rounded-md text-[10px] font-black bg-alcabama-black text-white">
                                T{towerId}
                              </span>
                              {apts.slice(0, 30).map((apt) => (
                                <span
                                  key={`${towerId}-${apt}`}
                                  className="px-2 py-1 rounded-md text-[10px] font-bold bg-white border border-alcabama-light-grey text-alcabama-dark-grey"
                                >
                                  {apt}
                                </span>
                              ))}
                              {apts.length > 30 && (
                                <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-white border border-alcabama-light-grey text-alcabama-grey">
                                  +{apts.length - 30} más
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 mb-8 bg-alcabama-light-grey/5 p-4 rounded-xl border border-alcabama-light-grey/20">
                <span className="text-[10px] font-bold uppercase text-alcabama-grey">Convenciones:</span>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-600 rounded-sm" />
                  <span className="text-[10px] text-alcabama-dark-grey">Entregado a propietario</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-sm" />
                  <span className="text-[10px] text-alcabama-dark-grey">Entregado a Post construcción</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-sm" />
                  <span className="text-[10px] text-alcabama-dark-grey">Escriturado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-600 rounded-sm" />
                  <span className="text-[10px] text-alcabama-dark-grey">Lista meta semanal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-400 border border-gray-500 rounded-sm" />
                  <span className="text-[10px] text-alcabama-dark-grey">En obra</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-white border border-alcabama-light-grey rounded-sm" />
                  <span className="text-[10px] text-alcabama-dark-grey">Sin proceso</span>
                </div>
              </div>

              {/* Towers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {filteredTowers.map((tower) => (
                  <TowerCard 
                    key={tower.id} 
                    tower={tower} 
                    onApartmentClick={(apt) => setEditingApartment({ towerId: tower.id, apartment: apt })}
                    statusFilter={statusFilter}
                    weeklyGoalDateFilter={weeklyGoalDateFilter}
                  />
                ))}
              </div>

              {filteredTowers.length === 0 && (
                <div className="text-center py-20">
                  <Building2 size={48} className="mx-auto text-alcabama-light-grey mb-4" />
                  <p className="text-alcabama-grey">No se encontraron torres que coincidan con "{searchTerm}"</p>
                </div>
              )}
            </motion.div>
      </main>

      {/* Footer */}
      <footer className="bg-alcabama-black text-white py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-8">
          <img 
            src="https://i.postimg.cc/0yDgcyBp/Logo-transparente_blanco.png" 
            alt="Alcabama Logo" 
            className="h-8 opacity-50"
            referrerPolicy="no-referrer"
          />
          <div className="text-center md:text-right">
            <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] mb-2">Plataforma de Gestión de Entregas</p>
            <p className="text-xs text-white/60">© {new Date().getFullYear()} Inversiones Alcabama S.A. Todos los derechos reservados. v1.2</p>
          </div>
        </div>
      </footer>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingApartment && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingApartment(null)}
              className="absolute inset-0 bg-alcabama-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="bg-alcabama-black p-6 text-white">
                <h3 className="text-xl font-bold">Actualizar Estado</h3>
                <p className="text-xs text-white/60 uppercase tracking-widest mt-1">
                  Torre {editingApartment.towerId} • Apartamento {editingApartment.apartment.number}
                </p>
              </div>
              
              <div className="p-6 space-y-3">
                <p className="text-[10px] font-bold uppercase text-alcabama-grey mb-4">Selecciona el nuevo estado:</p>
                
                <button 
                  onClick={() => handleStatusChange('owner_delivered')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-alcabama-light-grey hover:border-blue-600 hover:bg-blue-50 transition-all group"
                >
                  <div className="w-4 h-4 bg-blue-600 rounded-full" />
                  <span className="text-sm font-medium text-alcabama-dark-grey group-hover:text-blue-700">Entregado a propietario</span>
                </button>

                <button 
                  onClick={() => handleStatusChange('post_construction_delivered')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-alcabama-light-grey hover:border-green-500 hover:bg-green-50 transition-all group"
                >
                  <div className="w-4 h-4 bg-green-500 rounded-full" />
                  <span className="text-sm font-medium text-alcabama-dark-grey group-hover:text-green-700">Entregado a Post construcción</span>
                </button>

                <button 
                  onClick={() => handleStatusChange('notarized')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-alcabama-light-grey hover:border-orange-500 hover:bg-orange-50 transition-all group"
                >
                  <div className="w-4 h-4 bg-orange-500 rounded-full" />
                  <span className="text-sm font-medium text-alcabama-dark-grey group-hover:text-orange-700">Escriturado</span>
                </button>

                <div className="w-full flex items-center justify-between gap-4 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey">Fecha meta semanal</span>
                  <input
                    type="date"
                    value={weeklyGoalDateInput}
                    onChange={(e) => setWeeklyGoalDateInput(e.target.value)}
                    className="h-9 rounded-lg border border-alcabama-light-grey px-3 text-xs text-alcabama-dark-grey"
                  />
                </div>

                <button 
                  onClick={() => handleStatusChange('weekly_goal')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-alcabama-light-grey hover:border-red-600 hover:bg-red-50 transition-all group"
                >
                  <div className="w-4 h-4 bg-red-600 rounded-full" />
                  <span className="text-sm font-medium text-alcabama-dark-grey group-hover:text-red-700">Lista meta semanal</span>
                </button>

                <button 
                  onClick={() => handleStatusChange('under_construction')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-alcabama-light-grey hover:border-gray-500 hover:bg-gray-50 transition-all group"
                >
                  <div className="w-4 h-4 bg-gray-400 rounded-full" />
                  <span className="text-sm font-medium text-alcabama-dark-grey group-hover:text-gray-600">En obra</span>
                </button>

                <button 
                  onClick={() => handleStatusChange('in_process')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-alcabama-light-grey hover:border-alcabama-black hover:bg-alcabama-light-grey/5 transition-all group"
                >
                  <div className="w-4 h-4 bg-white border border-alcabama-light-grey rounded-full" />
                  <span className="text-sm font-medium text-alcabama-dark-grey group-hover:text-alcabama-black">Sin proceso</span>
                </button>

                <div className="pt-4">
                  <button 
                    onClick={() => setEditingApartment(null)}
                    className="w-full py-3 text-xs font-bold uppercase tracking-widest text-alcabama-grey hover:text-alcabama-black transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPasswordModal(false)}
              className="absolute inset-0 bg-alcabama-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="bg-alcabama-black p-6 text-white flex items-center gap-3">
                <Lock size={20} />
                <h3 className="text-lg font-bold">Verificar Identidad</h3>
              </div>
              
              <div className="p-6 space-y-4">
                <p className="text-sm text-alcabama-grey">
                  Ingresa la contraseña para confirmar el cambio de estado.
                </p>
                
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Contraseña"
                      className="w-full px-4 py-3 rounded-xl border border-alcabama-light-grey focus:outline-none focus:ring-2 focus:ring-alcabama-black/20 focus:border-alcabama-black transition-all"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && confirmStatusChange()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-alcabama-grey hover:text-alcabama-black transition-colors"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {error && (
                    <p className="text-xs text-red-500 font-bold ml-1">{error}</p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setShowPasswordModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-alcabama-grey hover:bg-alcabama-light-grey/10 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmStatusChange}
                    className="flex-1 py-3 text-xs font-bold uppercase tracking-widest bg-alcabama-black text-white rounded-xl hover:bg-alcabama-black/90 transition-all"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
