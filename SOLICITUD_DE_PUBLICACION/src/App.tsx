/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Send, 
  Trash2, 
  FileText, 
  User, 
  Target, 
  Layers, 
  MessageSquare, 
  CheckCircle2,
  ChevronDown,
  Building2,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RESPONSABLES, 
  ESPECIALIDADES, 
  UNIDADES_ESTRUCTURALES, 
  FILE_TYPES, 
  BIMFormState,
  PROJECTS
} from './constants';

const COLORS = {
  white: '#FFFFFF',
  lightGrey: '#C5C0C8',
  black: '#000000',
  grey: '#A49FA6',
  darkGrey: '#827E84',
  deepGrey: '#605E62',
  primary: '#D3045C', // Alcabama Pink/Magenta
};

export default function App() {
  const [selectedProject, setSelectedProject] = useState(PROJECTS[0]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [form, setForm] = useState<BIMFormState>({
    tipoRequest: 'PUBLICAR',
    responsable: '',
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isSubmitted) return;

    setIsSubmitting(true);
    setSubmittedCode(null);

    const dataToSend = {
      ...form,
      projectName: selectedProject.name,
    };

    // TODO: Reemplace esta URL con la URL de su aplicación web de Apps Script implementada.
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzc__BbNV9_h3epWvBNnLtC_jq3rkHiBBx_Qdmtryl1c3fSIGTae_OAIZCc7aFE2okM/exec";

    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(dataToSend),
        mode: 'no-cors', // Importante: previene errores de CORS con implementaciones simples de Apps Script.
      });

      setIsSubmitted(true);
      const fetchLatestCode = (projectName: string) =>
        new Promise<string | null>((resolve, reject) => {
          const callback = `__latestCode_${Date.now()}_${Math.random().toString(16).slice(2)}`;
          const cleanup = (script?: HTMLScriptElement, timeoutId?: number) => {
            try {
              if (timeoutId) window.clearTimeout(timeoutId);
            } catch {
            }
            try {
              if (script && script.parentNode) script.parentNode.removeChild(script);
            } catch {
            }
            try {
              delete (window as any)[callback];
            } catch {
              (window as any)[callback] = undefined;
            }
          };

          const sep = SCRIPT_URL.includes('?') ? '&' : '?';
          const src = `${SCRIPT_URL}${sep}action=latestCode&projectName=${encodeURIComponent(projectName)}&callback=${encodeURIComponent(callback)}`;
          const script = document.createElement('script');
          const timeoutId = window.setTimeout(() => {
            cleanup(script, timeoutId);
            reject(new Error('Timeout'));
          }, 5000);

          (window as any)[callback] = (payload: any) => {
            const codigo = payload && payload.codigo ? String(payload.codigo) : null;
            cleanup(script, timeoutId);
            resolve(codigo);
          };

          script.async = true;
          script.src = src;
          script.onerror = () => {
            cleanup(script, timeoutId);
            reject(new Error('Error loading script'));
          };

          document.body.appendChild(script);
        });

      void fetchLatestCode(selectedProject.name)
        .then((codigo) => setSubmittedCode(codigo))
        .catch(() => {});

      window.setTimeout(() => {
        setIsSubmitted(false);
        setSubmittedCode(null);
      }, 3000);

    } catch (error) {
      console.error('Error al enviar el formulario:', error);
      alert('Hubo un error al enviar la solicitud. Por favor, intente de nuevo o contacte a soporte.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F]">
      {/* Header */}
      <header className="bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <img 
              src="https://i.postimg.cc/GmWLmfZZ/Logo-transparente_negro.png" 
              alt="Alcabama Logo" 
              className="h-7 w-auto"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-2 p-2 rounded-xl hover:bg-[#F5F5F7] transition-all duration-200 group"
            >
              <img 
                src={selectedProject.logo} 
                alt={selectedProject.name} 
                className="h-10 w-auto object-contain"
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
                    className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-[#C5C0C8]/30 overflow-hidden z-50"
                  >
                    <div className="p-3 bg-[#F5F5F7]/50 border-b border-[#C5C0C8]/20">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#827E84]">
                        Seleccionar Proyecto
                      </span>
                    </div>
                    <div className="p-2 max-h-[400px] overflow-y-auto">
                      {PROJECTS.map((project) => (
                        <button
                          key={project.name}
                          onClick={() => {
                            setSelectedProject(project);
                            setIsMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 ${
                            selectedProject.name === project.name 
                              ? 'bg-[#D3045C]/5 border border-[#D3045C]/20' 
                              : 'hover:bg-[#F5F5F7]'
                          }`}
                        >
                          <div className="w-12 h-12 flex items-center justify-center bg-white rounded-lg border border-[#C5C0C8]/20 p-1">
                            <img 
                              src={project.logo} 
                              alt={project.name} 
                              className="max-w-full max-h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="flex flex-col items-start">
                            <span className={`text-sm font-bold ${selectedProject.name === project.name ? 'text-[#D3045C]' : 'text-[#605E62]'}`}>
                              {project.name}
                            </span>
                            {selectedProject.name === project.name && (
                              <span className="text-[10px] text-[#D3045C]/60 font-medium">Seleccionado</span>
                            )}
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
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: General Info */}
          <div className="lg:col-span-7 space-y-6">
            <section className="bg-white rounded-2xl p-8 shadow-sm border border-[#C5C0C8]/30">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-[#D3045C]">
                <FileText size={20} />
                Datos Generales
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
                        className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all duration-200 font-semibold flex items-center justify-center gap-2 ${
                          form.tipoRequest === type 
                            ? `border-[#D3045C] bg-[#D3045C]/5 text-[#D3045C]` 
                            : 'border-[#C5C0C8] text-[#605E62] hover:border-[#827E84]'
                        }`}
                      >
                        {type === 'PUBLICAR' ? <Send size={18} /> : <Trash2 size={18} />}
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Responsable */}
                <div className="relative">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#827E84] mb-2">
                    Responsable
                  </label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A49FA6]" size={18} />
                    <select
                      required
                      value={form.responsable}
                      onChange={(e) => setForm(prev => ({ ...prev, responsable: e.target.value }))}
                      className="w-full pl-12 pr-10 py-3 bg-[#F5F5F7] border border-[#C5C0C8] rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-[#D3045C]/20 focus:border-[#D3045C] transition-all"
                    >
                      <option value="">Seleccione un responsable</option>
                      {RESPONSABLES.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A49FA6] pointer-events-none" size={18} />
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
                      className="w-full pl-12 pr-10 py-3 bg-[#F5F5F7] border border-[#C5C0C8] rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-[#D3045C]/20 focus:border-[#D3045C] transition-all"
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
                      className="w-full pl-12 pr-10 py-3 bg-[#F5F5F7] border border-[#C5C0C8] rounded-xl appearance-none focus:outline-none focus:ring-2 focus:ring-[#D3045C]/20 focus:border-[#D3045C] transition-all"
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
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-[#D3045C]">
                <MessageSquare size={20} />
                Observaciones
              </h2>
              <div className="relative">
                <textarea
                  value={form.observaciones}
                  onChange={(e) => setForm(prev => ({ ...prev, observaciones: e.target.value.slice(0, 5000) }))}
                  placeholder="Escriba aquí sus observaciones adicionales..."
                  className="w-full h-40 p-4 bg-[#F5F5F7] border border-[#C5C0C8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D3045C]/20 focus:border-[#D3045C] transition-all resize-none"
                />
                <div className="absolute bottom-3 right-4 text-[10px] font-mono text-[#A49FA6]">
                  {form.observaciones.length} / 5000
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Structural Units */}
          <div className="lg:col-span-5">
            <section className="bg-white rounded-2xl p-8 shadow-sm border border-[#C5C0C8]/30 h-full">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-[#D3045C]">
                <Building2 size={20} />
                Unidades Estructurales
              </h2>
              
              <div className="space-y-4">
                {UNIDADES_ESTRUCTURALES.map((unit) => (
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
                            form.unidades[unit][type]
                              ? 'bg-[#D3045C] border-[#D3045C] text-white shadow-sm'
                              : 'bg-white border-[#C5C0C8] text-[#827E84] hover:border-[#827E84]'
                          }`}
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
                  disabled={isSubmitting || isSubmitted}
                  className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                    isSubmitted 
                      ? 'bg-emerald-500 shadow-emerald-500/20' 
                      : isSubmitting ? 'bg-gray-500 cursor-not-allowed' : 'bg-[#D3045C] hover:bg-[#B0034B] active:scale-[0.98] shadow-[#D3045C]/20'
                  }`}
                >
                  <AnimatePresence mode="wait">
                    {isSubmitted ? (
                      <motion.div
                        key="success"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex flex-col items-center gap-1"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={20} />
                          ¡SOLICITUD ENVIADA!
                        </div>
                        {submittedCode && (
                          <div className="text-[10px] font-mono tracking-widest uppercase opacity-90">CÓDIGO: {submittedCode}</div>
                        )}
                      </motion.div>
                    ) : isSubmitting ? (
                      <motion.div
                        key="submitting"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-2"
                      >
                        <Loader2 size={20} className="animate-spin" />
                        ENVIANDO...
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
                  Alcabama S.A. • Gestión BIM
                </p>
              </div>
            </section>
          </div>
        </form>
      </main>

      {/* Footer Branding */}
      <footer className="py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-6 opacity-40 grayscale">
          <img 
            src="https://i.postimg.cc/GmWLmfZZ/Logo-transparente_negro.png" 
            alt="Alcabama Logo Footer" 
            className="h-8 w-auto"
            referrerPolicy="no-referrer"
          />
          <div className="text-[10px] tracking-[0.2em] font-bold text-[#605E62]">
            SISTEMA DE GESTIÓN DE PROYECTOS BIM
          </div>
        </div>
      </footer>
    </div>
  );
}
