/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, CheckCircle2, Clock, Info, Search, BarChart3, LayoutGrid, Lock } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { fetchSheetData, updateSheetStatus, SheetData } from './services/sheetService';
import { API_CONFIG } from './config';

// --- Types ---

type Status = 'owner_delivered' | 'post_construction_delivered' | 'notarized' | 'weekly_goal' | 'in_process' | 'special';
type Tab = 'towers' | 'charts';

interface Apartment {
  id: string;
  number: string;
  status: Status;
}

interface Tower {
  id: number;
  name: string;
  apartments: Apartment[];
}

// --- Constants & Mock Data Generation ---

const TOTAL_TOWERS = 19;
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
      case 'special':
        return 'bg-white text-alcabama-black border-alcabama-light-grey italic opacity-60';
      default:
        return 'bg-white text-alcabama-black border-alcabama-light-grey';
    }
  };

  const getStatusLabel = (status: Status) => {
    switch (status) {
      case 'owner_delivered': return 'Entregado a propietario';
      case 'post_construction_delivered': return 'Entregado a Post construcción';
      case 'notarized': return 'Escriturado';
      case 'weekly_goal': return 'Lista meta semanal';
      case 'in_process': return 'En proceso';
      case 'special': return 'Área Especial';
      default: return '';
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
      title={`Apartamento ${apartment.number} - ${getStatusLabel(apartment.status)}`}
    >
      {apartment.number}
    </div>
  );
};

const TowerCard = ({ 
  tower, 
  onApartmentClick 
}: { 
  tower: Tower; 
  onApartmentClick: (apt: Apartment) => void;
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
    total: tower.apartments.filter(a => a.status !== 'special').length,
  }), [tower]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="bg-white rounded-xl shadow-lg overflow-hidden border border-alcabama-light-grey flex flex-col"
    >
      <div className="bg-alcabama-black text-white py-2 px-4 text-center font-bold text-sm tracking-wider">
        {tower.name}
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
                  <ApartmentCell 
                    key={apt.id} 
                    apartment={apt} 
                    onClick={onApartmentClick}
                  />
                ))}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="bg-alcabama-light-grey/5 px-4 py-3 border-t border-alcabama-light-grey grid grid-cols-2 gap-y-2 gap-x-2 text-sm text-alcabama-dark-grey leading-tight">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-blue-600 rounded-sm shrink-0" />
          <span className="truncate">Propietarios: <strong className="text-sm">{towerStats.owner}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-green-500 rounded-sm shrink-0" />
          <span className="truncate">Post Const.: <strong className="text-sm">{towerStats.post}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-orange-500 rounded-sm shrink-0" />
          <span className="truncate">Escriturado: <strong className="text-sm">{towerStats.notarized}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-red-600 rounded-sm shrink-0" />
          <span className="truncate">Meta Semanal: <strong className="text-sm">{towerStats.weekly}</strong></span>
        </div>
        <div className="flex items-center gap-2 col-span-2">
          <div className="w-2.5 h-2.5 bg-white border border-alcabama-light-grey rounded-sm shrink-0" />
          <span className="truncate">En proceso: <strong className="text-sm">{towerStats.process}</strong></span>
        </div>
      </div>
    </motion.div>
  );
};

const ChartsView = ({ towers, stats }: { towers: Tower[], stats: any }) => {
  const pieData = [
    { name: 'Propietario', value: stats.ownerDelivered, color: '#2563eb' },
    { name: 'Post Const.', value: stats.postConstruction, color: '#22c55e' },
    { name: 'Escriturado', value: stats.notarized, color: '#f97316' },
    { name: 'Meta Semanal', value: stats.weeklyGoal, color: '#dc2626' },
    { name: 'En Proceso', value: stats.inProcess, color: '#e5e7eb' },
  ];

  const barData = towers.map(t => ({
    name: t.name.replace('TORRE ', 'T'),
    entregados: t.apartments.filter(a => a.status === 'owner_delivered').length,
    total: t.apartments.filter(a => a.status !== 'special').length,
  })).sort((a, b) => b.entregados - a.entregados);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pie Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-alcabama-light-grey">
          <h3 className="text-sm font-bold uppercase tracking-wider text-alcabama-grey mb-6">Distribución de Estados</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary Table */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-alcabama-light-grey">
          <h3 className="text-sm font-bold uppercase tracking-wider text-alcabama-grey mb-6">Resumen Numérico</h3>
          <div className="space-y-4">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-3 bg-alcabama-light-grey/5 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm font-medium text-alcabama-dark-grey">{item.name}</span>
                </div>
                <span className="text-lg font-bold">{item.value}</span>
              </div>
            ))}
            <div className="pt-4 border-t border-alcabama-light-grey flex justify-between items-center">
              <span className="text-sm font-bold text-alcabama-black uppercase">Total Unidades</span>
              <span className="text-2xl font-black text-alcabama-pink">{stats.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-alcabama-light-grey">
        <h3 className="text-sm font-bold uppercase tracking-wider text-alcabama-grey mb-6">Entregas a Propietario por Torre</h3>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#605E62' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#605E62' }} />
              <Tooltip 
                cursor={{ fill: '#f3f4f6' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Bar dataKey="entregados" fill="#2563eb" radius={[4, 4, 0, 0]} name="Entregados" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('towers');
  const [allTowers, setAllTowers] = useState<Tower[]>(() => generateStructure());
  const [editingApartment, setEditingApartment] = useState<{ towerId: number, apartment: Apartment } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from Google Sheets
  React.useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchSheetData();
        if (data && data.length > 0) {
          setAllTowers(prevTowers => {
            // Create a map for faster lookup: "towerId-aptNumber" -> status
            const statusMap = new Map();
            data.forEach(item => {
              statusMap.set(`${item.towerId}-${item.aptNumber}`, item.status);
            });
            
            return prevTowers.map(tower => ({
              ...tower,
              apartments: tower.apartments.map(apt => {
                const key = `${tower.id}-${apt.number}`;
                const newStatus = statusMap.get(key) as Status;
                
                // Only update if we have a valid status and it's not a special area
                if (newStatus && apt.status !== 'special') {
                   return { ...apt, status: newStatus };
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
  const [password, setPassword] = useState('');
  const [pendingStatus, setPendingStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

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
            apt.id === editingApartment.apartment.id ? { ...apt, status: newStatus } : apt
          )
        };
      }));

      // Update Google Sheet
      updateSheetStatus(
        editingApartment.towerId, 
        editingApartment.apartment.number, 
        newStatus
      ).then(success => {
        if (!success) {
           console.error('Failed to sync with Google Sheets');
           // Here we could revert the optimistic update if we wanted to be strict
        }
      });

      setEditingApartment(null);
    } else {
      // If not in edit mode, this shouldn't happen via UI but as a safeguard
      // we can prompt for edit mode or just ignore. 
      // Given the UI will hide/show things based on edit mode, we might not reach here.
      // But if we do, let's just ignore or set error.
    }
  };

  const handleEnableEditMode = () => {
    setShowPasswordModal(true);
    setPassword('');
    setError('');
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
    const total = allTowers.reduce((acc, t) => acc + t.apartments.length, 0);
    const ownerDelivered = allTowers.reduce((acc, t) => acc + t.apartments.filter(a => a.status === 'owner_delivered').length, 0);
    const postConstruction = allTowers.reduce((acc, t) => acc + t.apartments.filter(a => a.status === 'post_construction_delivered').length, 0);
    const notarized = allTowers.reduce((acc, t) => acc + t.apartments.filter(a => a.status === 'notarized').length, 0);
    const weeklyGoal = allTowers.reduce((acc, t) => acc + t.apartments.filter(a => a.status === 'weekly_goal').length, 0);
    const inProcess = allTowers.reduce((acc, t) => acc + t.apartments.filter(a => a.status === 'in_process').length, 0);
    
    return {
      total,
      ownerDelivered,
      postConstruction,
      notarized,
      weeklyGoal,
      inProcess,
      percentage: Math.round((ownerDelivered / total) * 100)
    };
  }, [allTowers]);

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
              <div className="flex bg-white rounded-xl p-1 border border-alcabama-light-grey shadow-sm">
                <button 
                  onClick={() => setActiveTab('towers')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'towers' ? 'bg-alcabama-black text-white' : 'text-alcabama-grey hover:bg-alcabama-light-grey/10'}`}
                >
                  <LayoutGrid size={14} />
                  Torres
                </button>
                <button 
                  onClick={() => setActiveTab('charts')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'charts' ? 'bg-alcabama-black text-white' : 'text-alcabama-grey hover:bg-alcabama-light-grey/10'}`}
                >
                  <BarChart3 size={14} />
                  Gráficos
                </button>
              </div>
              <div className="hidden sm:flex items-center gap-4">
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

                <div className="h-8 w-[1px] bg-alcabama-light-grey/30 mx-2" />

                <span className="text-[10px] uppercase tracking-tighter text-alcabama-grey font-bold">Progreso General</span>
                <div className="w-32 h-2 bg-alcabama-light-grey/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-alcabama-pink transition-all duration-1000" 
                    style={{ width: `${stats.percentage}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-alcabama-pink">{stats.percentage}%</span>
              </div>
            </div>

            {activeTab === 'towers' && (
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
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'towers' ? (
            <motion.div
              key="towers"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Dashboard Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-alcabama-light-grey flex flex-col items-center text-center">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg mb-2 flex items-center justify-center text-white font-bold">
                    {stats.ownerDelivered}
                  </div>
                  <p className="text-[10px] text-alcabama-grey uppercase font-bold tracking-wider leading-tight">Entregado Propietario</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-alcabama-light-grey flex flex-col items-center text-center">
                  <div className="w-10 h-10 bg-green-500 rounded-lg mb-2 flex items-center justify-center text-white font-bold">
                    {stats.postConstruction}
                  </div>
                  <p className="text-[10px] text-alcabama-grey uppercase font-bold tracking-wider leading-tight">Post Construcción</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-alcabama-light-grey flex flex-col items-center text-center">
                  <div className="w-10 h-10 bg-orange-500 rounded-lg mb-2 flex items-center justify-center text-white font-bold">
                    {stats.notarized}
                  </div>
                  <p className="text-[10px] text-alcabama-grey uppercase font-bold tracking-wider leading-tight">Escriturado</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-alcabama-light-grey flex flex-col items-center text-center">
                  <div className="w-10 h-10 bg-red-600 rounded-lg mb-2 flex items-center justify-center text-white font-bold">
                    {stats.weeklyGoal}
                  </div>
                  <p className="text-[10px] text-alcabama-grey uppercase font-bold tracking-wider leading-tight">Meta Semanal</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-alcabama-light-grey flex flex-col items-center text-center">
                  <div className="w-10 h-10 bg-white border border-alcabama-light-grey rounded-lg mb-2 flex items-center justify-center text-alcabama-black font-bold">
                    {stats.inProcess}
                  </div>
                  <p className="text-[10px] text-alcabama-grey uppercase font-bold tracking-wider leading-tight">En Proceso</p>
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
                  <div className="w-3 h-3 bg-white border border-alcabama-light-grey rounded-sm" />
                  <span className="text-[10px] text-alcabama-dark-grey">En proceso</span>
                </div>
              </div>

              {/* Towers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {filteredTowers.map((tower) => (
                  <TowerCard 
                    key={tower.id} 
                    tower={tower} 
                    onApartmentClick={(apt) => setEditingApartment({ towerId: tower.id, apartment: apt })}
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
          ) : (
            <motion.div
              key="charts"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <ChartsView towers={allTowers} stats={stats} />
            </motion.div>
          )}
        </AnimatePresence>
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
            <p className="text-xs text-white/60">© {new Date().getFullYear()} Alcabama S.A. Todos los derechos reservados. v1.2</p>
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

                <button 
                  onClick={() => handleStatusChange('weekly_goal')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-alcabama-light-grey hover:border-red-600 hover:bg-red-50 transition-all group"
                >
                  <div className="w-4 h-4 bg-red-600 rounded-full" />
                  <span className="text-sm font-medium text-alcabama-dark-grey group-hover:text-red-700">Lista meta semanal</span>
                </button>

                <button 
                  onClick={() => handleStatusChange('in_process')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-alcabama-light-grey hover:border-alcabama-black hover:bg-alcabama-light-grey/5 transition-all group"
                >
                  <div className="w-4 h-4 bg-white border border-alcabama-light-grey rounded-full" />
                  <span className="text-sm font-medium text-alcabama-dark-grey group-hover:text-alcabama-black">En proceso</span>
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
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Contraseña"
                    className="w-full px-4 py-3 rounded-xl border border-alcabama-light-grey focus:outline-none focus:ring-2 focus:ring-alcabama-pink/50 transition-all"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && confirmStatusChange()}
                  />
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
