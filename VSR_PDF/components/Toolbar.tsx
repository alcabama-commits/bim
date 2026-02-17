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
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
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
  onFileChange,
}) => {
  return (
    <header className="h-12 bg-[#000000] border-b border-[#605E62] px-4 flex items-center justify-between z-30 shadow-md">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-drafting-compass text-[#D3045C]"></i>
          <span className="text-sm font-bold tracking-tighter uppercase">ArchView <span className="text-[#D3045C] text-[10px] ml-1">BIM PRO v2.3</span></span>
        </div>
        {file && <div className="h-4 w-px bg-[#605E62] mx-2"></div>}
        {file && <span className="text-[10px] text-[#A49FA6] font-mono truncate max-w-[120px]">{file.name}</span>}
      </div>

      <div className="flex items-center gap-1">
        <div className="flex bg-[#605E62]/30 rounded p-0.5 border border-[#605E62] mr-4">
          <button onClick={() => onToolChange('hand')} className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'hand' ? 'bg-[#D3045C] shadow-inner' : 'hover:bg-[#605E62]'}`} title="Mano (Pan)">
            <i className="fa-solid fa-hand-pointer text-xs"></i>
          </button>
          <button onClick={() => onToolChange('measure')} className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'measure' ? 'bg-[#D3045C] shadow-inner' : 'hover:bg-[#605E62]'}`} title="Medir">
            <i className="fa-solid fa-ruler text-xs"></i>
          </button>
          <button onClick={() => onToolChange('calibrate')} className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'calibrate' ? 'bg-[#D3045C] shadow-inner text-white' : 'hover:bg-[#605E62]'}`} title="Calibrar Escala">
            <i className="fa-solid fa-arrows-left-right-to-line text-xs"></i>
          </button>
        </div>

        <div className="flex items-center gap-2 mr-4">
          <button onClick={() => onZoom(-0.2)} className="w-6 h-6 flex items-center justify-center hover:bg-[#605E62] rounded transition"><i className="fa-solid fa-minus text-[10px]"></i></button>
          <span className="text-[10px] font-mono w-12 text-center text-[#A49FA6]">{Math.round(scale * 100)}%</span>
          <button onClick={() => onZoom(0.2)} className="w-6 h-6 flex items-center justify-center hover:bg-[#605E62] rounded transition"><i className="fa-solid fa-plus text-[10px]"></i></button>
        </div>

        <button onClick={onRotate} className="w-8 h-8 hover:bg-[#605E62] rounded transition" title="Rotar"><i className="fa-solid fa-rotate-right text-xs"></i></button>
        <button onClick={onShowGridToggle} className={`w-8 h-8 rounded transition ${showGrid ? 'text-[#D3045C] bg-[#D3045C]/10' : 'text-[#827E84] hover:bg-[#605E62]'}`} title="Grid"><i className="fa-solid fa-border-none text-xs"></i></button>
        <button onClick={onBlueprintToggle} className={`w-8 h-8 rounded transition ${isBlueprint ? 'text-[#D3045C] bg-[#D3045C]/10' : 'text-[#827E84] hover:bg-[#605E62]'}`} title="Modo Blueprint"><i className="fa-solid fa-eye-slash text-xs"></i></button>
      </div>

      <div className="flex items-center gap-3">
        <label className="cursor-pointer bg-[#D3045C] hover:bg-[#D3045C]/90 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition active:scale-95 flex items-center gap-2">
          <i className="fa-solid fa-upload"></i>
          <span className="hidden sm:inline">Nuevo Archivo</span>
          <input type="file" className="hidden" accept=".pdf" onChange={onFileChange} />
        </label>
      </div>
    </header>
  );
};

export default Toolbar;