/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  FILE_TYPES, 
  BIMFormState,
  PROJECTS,
  BRANDING,
  ProjectConfig,
  UNIDADES_ESTRUCTURALES,
  ESPECIALIDADES
} from './constants';
import { 
  Send, 
  Trash2, 
  FileText, 
  Target, 
  Layers, 
  MessageSquare, 
  CheckCircle2,
  ChevronDown,
  Building2,
  Plus,
  Settings,
  Image as ImageIcon,
  LayoutGrid,
  Pencil,
  Trash2 as TrashIcon,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const LOGGED_USER = "imagina3ddesign@gmail.com";

export default function App() {
  const [activeTab, setActiveTab] = useState<'PUBLICAR' | 'CONFIG'>('PUBLICAR');
  const [selectedProject, setSelectedProject] = useState<ProjectConfig>(PROJECTS[0]); 
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Project Config Form State
  const [configProjects, setConfigProjects] = useState<ProjectConfig[]>(PROJECTS);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({
    name: '',
    logo: '',
    company: 'Artis' as 'Artis' | 'Alcabama',
    unidades: UNIDADES_ESTRUCTURALES.join(', ')
  });

  const currentBranding = BRANDING[selectedProject.company];

  const [form, setForm] = useState<BIMFormState>({
    tipoRequest: 'PUBLICAR',
    responsable: LOGGED_USER,
    proposito: '',
    especialidad: '',
    observaciones: '',
    unidades: UNIDADES_ESTRUCTURALES.reduce((acc, unit) => ({
      ...acc,
      [unit]: {
        RVT: false,
        DWG: false,
        PDF: false,
        DOC: false,
        IFC: false,
        TRB: false,
      }
    }), {})
  });

  const [isSubmitted, setIsSubmitted] = useState(false);

  // Helper to get responsives/units for current project or default
  const getProjectUnits = (project: ProjectConfig) => {
    if (project.unidades) return project.unidades;
    return UNIDADES_ESTRUCTURALES;
  };

  const currentUnits = getProjectUnits(selectedProject);

  const handleUnitToggle = (unit: string, fileType: typeof FILE_TYPES[number]) => {
    setForm(prev => ({
      ...prev,
      unidades: {
        ...prev.unidades,
        [unit]: {
          ...prev.unidades[unit],
          [fileType]: !prev.unidades[unit][fileType]
        }
      }
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', form);
    setIsSubmitted(true);
    setTimeout(() => setIsSubmitted(false), 3000);
  };

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    
    const projectData: ProjectConfig = {
      id: editingProjectId || Math.random().toString(36).substr(2, 9),
      name: newProject.name,
      logo: newProject.logo || 'https://via.placeholder.com/150',
      company: newProject.company,
      unidades: newProject.unidades.split(',').map(s => s.trim()).filter(Boolean)
    };

    if (editingProjectId) {
      setConfigProjects(prev => prev.map(p => p.id === editingProjectId ? projectData : p));
      if (selectedProject.id === editingProjectId) {
        setSelectedProject(projectData);
      }
      setEditingProjectId(null);
    } else {
      setConfigProjects(prev => [...prev, projectData]);
    }

    setNewProject({ 
      name: '', 
      logo: '', 
      company: 'Artis',
      unidades: UNIDADES_ESTRUCTURALES.join(', ') 
    });
  };

  const handleEditClick = (project: ProjectConfig) => {
    setEditingProjectId(project.id);
    setNewProject({
      name: project.name,
      logo: project.logo,
      company: project.company,
      unidades: (project.unidades || UNIDADES_ESTRUCTURALES).join(', ')
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteProject = (id: string) => {
    if (confirm('¿Está seguro de eliminar este proyecto?')) {
      setConfigProjects(prev => prev.filter(p => p.id !== id));
      if (selectedProject.id === id && configProjects.length > 1) {
        setSelectedProject(configProjects.find(p => p.id !== id) || configProjects[0]);
      }
    }
  };

  const handleCancelClick = () => {
    setEditingProjectId(null);
    setNewProject({ 
      name: '', 
      logo: '', 
      company: 'Artis',
      unidades: UNIDADES_ESTRUCTURALES.join(', ') 
    });
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F]">
      {/* Header */}
      <header className="bg-white sticky top-0 z-50 shadow-sm border-b" style={{ borderColor: `${currentBranding.colors.primary}20` }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <img 
              src={currentBranding.logo} 
              alt={`${currentBranding.name} Logo`} 
              className="h-8 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
            
            <nav className="hidden md:flex items-center bg-[#F5F5F7] p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('PUBLICAR')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'PUBLICAR' 
                    ? 'bg-white shadow-sm' 
                    : 'text-[#827E84] hover:bg-white/50'
                }`}
                style={{ color: activeTab === 'PUBLICAR' ? currentBranding.colors.primary : undefined }}
              >
                PUBLICACIONES
              </button>
              <button
                onClick={() => setActiveTab('CONFIG')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'CONFIG' 
                    ? 'bg-white shadow-sm' 
                    : 'text-[#827E84] hover:bg-white/50'
                }`}
                style={{ color: activeTab === 'CONFIG' ? currentBranding.colors.primary : undefined }}
              >
                PROYECTOS
              </button>
            </nav>
          </div>

          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 p-2 rounded-xl hover:bg-[#F5F5F7] transition-all duration-200 group"
            >
              <img 
                src={selectedProject.logo} 
                alt={selectedProject.name} 
                className="h-10 w-auto object-contain rounded"
                referrerPolicy="no-referrer"
              />
              <ChevronDown 
                size={18} 
                className={`text-[#A49FA6] transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`} 
              />
            </button>

            <AnimatePresence>
              {isMenuOpen && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsMenuOpen(false)}
                    className="fixed inset-0 z-40"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-[#C5C0C8]/30 overflow-hidden z-50"
                  >
                    <div className="p-3 bg-[#F5F5F7]/50 border-b border-[#C5C0C8]/20">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#827E84]">
                        Seleccionar Proyecto
                      </span>
                    </div>
                    <div className="p-2 max-h-[400px] overflow-y-auto">
                      {configProjects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => {
                            setSelectedProject(project);
                            setIsMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 border border-transparent ${
                            selectedProject.id === project.id 
                              ? 'bg-opacity-5' 
                              : 'hover:bg-[#F5F5F7]'
                          }`}
                          style={{ 
                            backgroundColor: selectedProject.id === project.id ? BRANDING[project.company].colors.primary + '10' : undefined,
                            borderColor: selectedProject.id === project.id ? BRANDING[project.company].colors.primary + '20' : undefined
                          }}
                        >
                          <div className="w-12 h-12 flex items-center justify-center bg-white rounded-lg border border-[#C5C0C8]/20 p-1">
                            <img 
                              src={project.logo} 
                              alt={project.name} 
                              className="max-w-full max-h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="flex flex-col items-start leading-tight">
                            <span className="text-sm font-bold" style={{ color: selectedProject.id === project.id ? BRANDING[project.company].colors.primary : '#605E62' }}>
                              {project.name}
                            </span>
                            <span className="text-[9px] font-bold uppercase tracking-tighter opacity-60">
                              {project.company}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'PUBLICAR' ? (
            <motion.div
              key="publish"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: General Info */}
                <div className="lg:col-span-7 space-y-6">
                  <section className="bg-white rounded-2xl p-8 shadow-sm border border-[#C5C0C8]/30">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2" style={{ color: currentBranding.colors.primary }}>
                      <FileText size={20} style={{ color: currentBranding.colors.accent }} />
                      Datos Generales ({selectedProject.name})
                    </h2>

                    <div className="space-y-6">
                      {/* Tipo de Solicitud */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#827E84] mb-2">
                          Tipo de Solicitud
                        </label>
                        <div className="flex gap-4">
                          {['PUBLICAR', 'ELIMINAR'].map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setForm(prev => ({ ...prev, tipoRequest: type as any }))}
                              className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all duration-200 font-semibold flex items-center justify-center gap-2`}
                              style={{ 
                                borderColor: form.tipoRequest === type ? currentBranding.colors.primary : '#C5C0C8',
                                backgroundColor: form.tipoRequest === type ? currentBranding.colors.primary + '05' : 'transparent',
                                color: form.tipoRequest === type ? currentBranding.colors.primary : '#605E62'
                              }}
                            >
                              {type === 'PUBLICAR' ? <Send size={18} /> : <Trash2 size={18} />}
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Propósito */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#827E84] mb-2">
                          Propósito de la solicitud
                        </label>
                        <div className="relative">
                          <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A49FA6]" size={18} />
                          <select
                            required
                            value={form.proposito}
                            onChange={(e) => setForm(prev => ({ ...prev, proposito: e.target.value as any }))}
                            className="w-full pl-12 pr-10 py-3 bg-[#F5F5F7] border border-[#C5C0C8] rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-[#003E52]/20 focus:border-[#003E52] transition-all"
                          >
                            <option value="">Seleccione el propósito</option>
                            <option value="ENTREGA PROYECTO">ENTREGA PROYECTO</option>
                            <option value="ACTUALIZACIÓN O CAMBIO">ACTUALIZACIÓN O CAMBIO</option>
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A49FA6] pointer-events-none" size={18} />
                        </div>
                      </div>

                      {/* Especialidad */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#827E84] mb-2">
                          Especialidad
                        </label>
                        <div className="relative">
                          <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A49FA6]" size={18} />
                          <select
                            required
                            value={form.especialidad}
                            onChange={(e) => setForm(prev => ({ ...prev, especialidad: e.target.value }))}
                            className="w-full pl-12 pr-10 py-3 bg-[#F5F5F7] border border-[#C5C0C8] rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-[#003E52]/20 focus:border-[#003E52] transition-all"
                          >
                            <option value="">Seleccione especialidad</option>
                            {ESPECIALIDADES.map(esp => (
                              <option key={esp} value={esp}>{esp}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A49FA6] pointer-events-none" size={18} />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Observaciones */}
                  <section className="bg-white rounded-2xl p-8 shadow-sm border border-[#C5C0C8]/30">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2" style={{ color: currentBranding.colors.primary }}>
                      <MessageSquare size={20} style={{ color: currentBranding.colors.accent }} />
                      Observaciones
                    </h2>
                    <div className="relative">
                      <textarea
                        value={form.observaciones}
                        onChange={(e) => setForm(prev => ({ ...prev, observaciones: e.target.value.slice(0, 5000) }))}
                        placeholder="Escriba aquí sus observaciones adicionales..."
                        className="w-full h-40 p-4 bg-[#F5F5F7] border border-[#C5C0C8] rounded-xl focus:outline-none focus:ring-2 transition-all resize-none"
                      />
                      <div className="absolute bottom-3 right-4 text-[10px] font-mono text-[#A49FA6]">
                        {form.observaciones.length} / 5000
                      </div>
                    </div>
                  </section>
                </div>

                {/* Right Column: Structural Units */}
                <div className="lg:col-span-5">
                  <section className="bg-white rounded-2xl p-8 shadow-sm border border-[#C5C0C8]/30 h-full flex flex-col">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2" style={{ color: currentBranding.colors.primary }}>
                      <Building2 size={20} style={{ color: currentBranding.colors.accent }} />
                      Unidades Estructurales
                    </h2>
                    
                    <div className="space-y-4 flex-1">
                      {currentUnits.map((unit) => (
                        <div key={unit} className="p-4 rounded-xl bg-[#F5F5F7] border border-[#C5C0C8]/50">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[#605E62] mb-3">
                            {unit}
                          </h3>
                          <div className="grid grid-cols-3 gap-2">
                            {FILE_TYPES.map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => handleUnitToggle(unit, type)}
                                className={`py-2 px-1 rounded-lg text-[10px] font-bold border transition-all duration-200 ${
                                  form.unidades[unit]?.[type]
                                    ? 'shadow-sm text-white'
                                    : 'bg-white border-[#C5C0C8] text-[#827E84] hover:border-[#827E84]'
                                }`}
                                style={{
                                  backgroundColor: form.unidades[unit]?.[type] ? currentBranding.colors.primary : undefined,
                                  borderColor: form.unidades[unit]?.[type] ? currentBranding.colors.primary : undefined,
                                }}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-[#C5C0C8]">
                      <button
                        type="submit"
                        disabled={isSubmitted}
                        className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all duration-300 flex items-center justify-center gap-2 shadow-opacity-20`}
                        style={{ 
                          backgroundColor: isSubmitted ? '#10b981' : currentBranding.colors.primary,
                          boxShadow: `0 10px 15px -3px ${isSubmitted ? '#10b98140' : currentBranding.colors.primary + '40'}`
                        }}
                      >
                        <AnimatePresence mode="wait">
                          {isSubmitted ? (
                            <motion.div
                              key="success"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="flex items-center gap-2"
                            >
                              <CheckCircle2 size={20} />
                              ¡SOLICITUD ENVIADA!
                            </motion.div>
                          ) : (
                            <motion.div
                              key="submit"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="flex items-center gap-2"
                            >
                              <Send size={20} />
                              ENVIAR SOLICITUD
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>
                      <p className="text-center text-[10px] text-[#A49FA6] mt-4 uppercase tracking-widest font-medium">
                        {currentBranding.name} • Gestión BIM
                      </p>
                    </div>
                  </section>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="config"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto"
            >
              <section className="bg-white rounded-2xl p-8 shadow-sm border border-[#C5C0C8]/30">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-bold flex items-center gap-3" style={{ color: currentBranding.colors.primary }}>
                    <Settings size={24} style={{ color: currentBranding.colors.accent }} />
                    {editingProjectId ? 'Editar Proyecto' : 'Configuración de Proyectos'}
                  </h2>
                </div>

                <form onSubmit={handleSaveProject} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Basic Info */}
                    <div className="space-y-6">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#827E84] mb-2">
                          Empresa / Branding
                        </label>
                        <div className="flex gap-4">
                          {(['Artis', 'Alcabama'] as const).map((brand) => (
                            <button
                              key={brand}
                              type="button"
                              onClick={() => setNewProject(prev => ({ ...prev, company: brand }))}
                              className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-bold text-xs`}
                              style={{ 
                                borderColor: newProject.company === brand ? BRANDING[brand].colors.primary : '#C5C0C8',
                                backgroundColor: newProject.company === brand ? BRANDING[brand].colors.primary + '08' : 'transparent',
                                color: newProject.company === brand ? BRANDING[brand].colors.primary : '#827E84'
                              }}
                            >
                              <Briefcase size={16} />
                              {brand.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#827E84] mb-2">
                          Nombre del Proyecto
                        </label>
                        <div className="relative">
                          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A49FA6]" size={18} />
                          <input
                            required
                            type="text"
                            placeholder="Ej: Artis Trevoly"
                            value={newProject.name}
                            onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full pl-12 pr-4 py-3 bg-[#F5F5F7] border border-[#C5C0C8] rounded-xl focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all shadow-inner"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#827E84] mb-2">
                          URL del Logo
                        </label>
                        <div className="relative">
                          <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A49FA6]" size={18} />
                          <input
                            type="url"
                            placeholder="https://i.postimg.cc/..."
                            value={newProject.logo}
                            onChange={(e) => setNewProject(prev => ({ ...prev, logo: e.target.value }))}
                            className="w-full pl-12 pr-4 py-3 bg-[#F5F5F7] border border-[#C5C0C8] rounded-xl focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all shadow-inner"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="bg-[#F5F5F7] rounded-3xl p-8 flex flex-col items-center justify-center border-2 border-dashed border-[#C5C0C8] transition-all">
                      {newProject.logo ? (
                        <div className="relative group">
                          <img src={newProject.logo} alt="Preview" className="max-h-32 object-contain rounded-xl shadow-lg bg-white p-2" />
                        </div>
                      ) : (
                        <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center text-[#C5C0C8] shadow-sm">
                          <ImageIcon size={40} />
                        </div>
                      )}
                      <div className="mt-4 text-center">
                        <p className="text-xs font-black uppercase tracking-widest" style={{ color: BRANDING[newProject.company].colors.primary }}>
                          {newProject.name || 'Vista Previa'}
                        </p>
                        <span className="text-[9px] font-bold text-[#A49FA6] uppercase tracking-tighter">
                          Branding: {newProject.company}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Units */}
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#827E84]">
                          Unidades Estructurales (Separadas por coma)
                        </label>
                        <span className="text-[10px] text-[#A49FA6]">Total: {newProject.unidades.split(',').filter(Boolean).length}</span>
                      </div>
                      <div className="relative">
                        <LayoutGrid className="absolute left-4 top-4 text-[#A49FA6]" size={18} />
                        <textarea
                          value={newProject.unidades}
                          onChange={(e) => setNewProject(prev => ({ ...prev, unidades: e.target.value }))}
                          className="w-full pl-12 pr-4 py-4 bg-[#F5F5F7] border border-[#C5C0C8] rounded-xl focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all h-28 resize-none shadow-inner leading-relaxed"
                          placeholder="Torre 1, Torre 2, Sótano..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4 border-t border-[#C5C0C8]">
                    <button
                      type="submit"
                      className="flex-1 py-4 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                      style={{ 
                        backgroundColor: currentBranding.colors.primary,
                        boxShadow: `0 10px 20px -5px ${currentBranding.colors.primary}40`
                      }}
                    >
                      {editingProjectId ? <Pencil size={20} /> : <Plus size={20} />}
                      {editingProjectId ? 'GUARDAR CAMBIOS' : 'CREAR PROYECTO'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelClick}
                      className="px-8 py-4 border-2 border-[#C5C0C8] text-[#605E62] font-bold rounded-xl hover:bg-[#F5F5F7] transition-all"
                    >
                      {editingProjectId ? 'SALIR' : 'LIMPIAR'}
                    </button>
                  </div>
                </form>
              </section>

              {/* Projects List with Edit/Delete */}
              <div className="mt-12 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-[#827E84] flex items-center gap-2">
                  <LayoutGrid size={16} />
                  Proyectos Existentes ({configProjects.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {configProjects.map((p) => (
                    <div 
                      key={p.id} 
                      className={`group bg-white p-4 rounded-2xl border flex items-center justify-between transition-all hover:shadow-md ${editingProjectId === p.id ? 'ring-2 ring-opacity-50' : ''}`}
                      style={{ 
                        borderColor: '#C5C0C830',
                        ringColor: editingProjectId === p.id ? BRANDING[p.company].colors.primary : undefined
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-[#F5F5F7] rounded-xl p-2 flex items-center justify-center border border-[#C5C0C820]">
                          <img src={p.logo} alt={p.name} className="max-w-full max-h-full object-contain" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-[#0D0D0D]">{p.name}</span>
                          <span className="text-[10px] font-black uppercase tracking-tighter" style={{ color: BRANDING[p.company].colors.primary }}>
                            {p.company}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEditClick(p)}
                          className="p-2 hover:bg-[#F5F5F7] text-[#827E84] hover:text-[#0D0D0D] rounded-lg transition-all"
                          title="Editar"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteProject(p.id)}
                          className="p-2 hover:bg-red-50 text-[#827E84] hover:text-red-500 rounded-lg transition-all"
                          title="Eliminar"
                        >
                          <TrashIcon size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Branding */}
      <footer className="py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-6 opacity-40 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-700">
          <img 
            src={currentBranding.logo} 
            alt={`${currentBranding.name} Footer`} 
            className="h-6 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
          <div className="text-[10px] tracking-[0.5em] font-black uppercase text-center" style={{ color: currentBranding.colors.primary }}>
            Sistema de Gestión BIM • {currentBranding.name}
          </div>
        </div>
      </footer>
    </div>
  );
}
