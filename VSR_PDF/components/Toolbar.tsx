import React from 'react';
import { Tool } from '../types';

interface ToolbarProps {
  file: File | null;
  activeTool: Tool;
  scale: number;
  showGrid: boolean;
  isBlueprint: boolean;
  onToolChange: (tool: Tool) => void;
  onZoom: (delta: number) => void;
  onRotate: () => void;
  onShowGridToggle: () => void;
  onBlueprintToggle: () => void;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  isSidebarVisible: boolean;
  onToggleSidebar: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  file,
  activeTool,
  scale,
  showGrid,
  isBlueprint,
  onToolChange,
  onZoom,
  onRotate,
  onShowGridToggle,
  onBlueprintToggle,
  theme,
  onThemeToggle,
  isSidebarVisible,
  onToggleSidebar,
}) => {
  return (
    <header className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-30 shadow-md">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <img 
            src={theme === 'dark' ? 'https://i.postimg.cc/0yDgcyBp/Logo-transparente_blanco.png' : 'https://i.postimg.cc/GmWLmfZZ/Logo-transparente_negro.png'} 
            alt="Alcabama" 
            className="h-5 select-none"
            draggable={false}
          />
        </div>
        {file && <div className="h-4 w-px bg-slate-700 mx-2"></div>}
        {file && <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">{file.name}</span>}
      </div>

      <div className="flex items-center gap-1">
        <div className="flex bg-slate-800 rounded p-0.5 border border-slate-700 mr-4">
          <button onClick={() => onToolChange('hand')} className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'hand' ? 'bg-indigo-600 shadow-inner' : 'hover:bg-slate-700'}`} title="Mano (Pan)">
            <i className="fa-solid fa-hand-pointer text-xs"></i>
          </button>
          <button onClick={() => onToolChange('measure')} className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'measure' ? 'bg-indigo-600 shadow-inner' : 'hover:bg-slate-700'}`} title="Medir">
            <i className="fa-solid fa-ruler text-xs"></i>
          </button>
          <button onClick={() => onToolChange('calibrate')} className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'calibrate' ? 'bg-yellow-600 shadow-inner text-slate-950' : 'hover:bg-slate-700'}`} title="Calibrar Escala">
            <i className="fa-solid fa-arrows-left-right-to-line text-xs"></i>
          </button>
        </div>

        <div className="flex items-center gap-2 mr-4">
          <button onClick={() => onZoom(-0.2)} className="w-6 h-6 flex items-center justify-center hover:bg-slate-800 rounded transition"><i className="fa-solid fa-minus text-[10px]"></i></button>
          <span className="text-[10px] font-mono w-12 text-center text-slate-400">{Math.round(scale * 100)}%</span>
          <button onClick={() => onZoom(0.2)} className="w-6 h-6 flex items-center justify-center hover:bg-slate-800 rounded transition"><i className="fa-solid fa-plus text-[10px]"></i></button>
        </div>

        <button onClick={onRotate} className="w-8 h-8 hover:bg-slate-800 rounded transition" title="Rotar"><i className="fa-solid fa-rotate-right text-xs"></i></button>
        <button onClick={onShowGridToggle} className={`w-8 h-8 rounded transition ${showGrid ? 'text-yellow-500 bg-yellow-500/10' : 'text-slate-500 hover:bg-slate-800'}`} title="Grid"><i className="fa-solid fa-border-none text-xs"></i></button>
        <button 
          onClick={onBlueprintToggle} 
          className={`w-8 h-8 rounded transition ${
            isBlueprint ? 'bg-[#D3045C] text-white shadow' : 'text-slate-500 hover:bg-slate-800'
          }`} 
          title="Modo plano (alto contraste)"
        >
          <i className="fa-solid fa-file-lines text-xs"></i>
        </button>
        <button 
          onClick={onToggleSidebar} 
          className={`w-8 h-8 rounded border transition ${
            isSidebarVisible 
              ? 'border-[#D3045C] text-[#D3045C] bg-[#D3045C]/10' 
              : 'border-slate-700 text-slate-500 hover:bg-slate-800'
          }`} 
          title={isSidebarVisible ? 'Ocultar galería de Planos BIM' : 'Mostrar galería de Planos BIM'}
        >
          <i className="fa-solid fa-table-columns text-xs"></i>
        </button>
        <button onClick={onThemeToggle} className={`w-8 h-8 rounded transition ${theme === 'dark' ? 'text-yellow-500 bg-yellow-500/10' : 'text-slate-500 hover:bg-slate-800'}`} title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
          <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} text-xs`}></i>
        </button>
      </div>

      <div className="flex items-center gap-3" />
    </header>
  );
};

export default Toolbar;
