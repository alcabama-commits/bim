
import React, { useState, useCallback } from 'react';
import PdfRenderer from './components/PdfRenderer';
import AiSidebar from './components/AiSidebar';
import { Calibration, Tool } from './types';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(0.8);
  const [rotation, setRotation] = useState(0);
  const [documentText, setDocumentText] = useState("");
  
  const [activeTool, setActiveTool] = useState<Tool>('hand');
  const [showGrid, setShowGrid] = useState(false);
  const [isBlueprint, setIsBlueprint] = useState(false);
  const [calibration, setCalibration] = useState<Calibration | null>(null);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setCurrentPage(1);
    setCalibration(null);
    setDocumentText("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFileSelect(selectedFile);
  };

  const onDocumentLoad = useCallback((pages: number, text: string) => {
    setTotalPages(pages);
    setDocumentText(text);
  }, []);

  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleZoom = (delta: number) => setScale(prev => Math.max(0.1, Math.min(10, prev + delta)));

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-30 shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-drafting-compass text-yellow-500"></i>
              <span className="text-sm font-bold tracking-tighter uppercase">ArchView <span className="text-yellow-500 text-[10px] ml-1">BIM PRO</span></span>
            </div>
            {file && <div className="h-4 w-px bg-slate-700 mx-2"></div>}
            {file && <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">{file.name}</span>}
          </div>

          <div className="flex items-center gap-1">
            <div className="flex bg-slate-800 rounded p-0.5 border border-slate-700 mr-4">
              <button 
                onClick={() => setActiveTool('hand')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'hand' ? 'bg-indigo-600 shadow-inner' : 'hover:bg-slate-700'}`}
                title="Mano (Pan)"
              >
                <i className="fa-solid fa-hand-pointer text-xs"></i>
              </button>
              <button 
                onClick={() => setActiveTool('measure')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'measure' ? 'bg-indigo-600 shadow-inner' : 'hover:bg-slate-700'}`}
                title="Medir"
              >
                <i className="fa-solid fa-ruler text-xs"></i>
              </button>
              <button 
                onClick={() => setActiveTool('calibrate')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'calibrate' ? 'bg-yellow-600 shadow-inner text-slate-950' : 'hover:bg-slate-700'}`}
                title="Calibrar Escala"
              >
                <i className="fa-solid fa-arrows-left-right-to-line text-xs"></i>
              </button>
            </div>

            <div className="flex items-center gap-2 mr-4">
              <button onClick={() => handleZoom(-0.2)} className="w-6 h-6 flex items-center justify-center hover:bg-slate-800 rounded transition"><i className="fa-solid fa-minus text-[10px]"></i></button>
              <span className="text-[10px] font-mono w-12 text-center text-slate-400">{Math.round(scale * 100)}%</span>
              <button onClick={() => handleZoom(0.2)} className="w-6 h-6 flex items-center justify-center hover:bg-slate-800 rounded transition"><i className="fa-solid fa-plus text-[10px]"></i></button>
            </div>

            <button onClick={handleRotate} className="w-8 h-8 hover:bg-slate-800 rounded transition" title="Rotar"><i className="fa-solid fa-rotate-right text-xs"></i></button>
            <button onClick={() => setShowGrid(!showGrid)} className={`w-8 h-8 rounded transition ${showGrid ? 'text-yellow-500 bg-yellow-500/10' : 'text-slate-500 hover:bg-slate-800'}`} title="Grid"><i className="fa-solid fa-border-none text-xs"></i></button>
            <button onClick={() => setIsBlueprint(!isBlueprint)} className={`w-8 h-8 rounded transition ${isBlueprint ? 'text-yellow-500 bg-yellow-500/10' : 'text-slate-500 hover:bg-slate-800'}`} title="Modo Blueprint"><i className="fa-solid fa-eye-slash text-xs"></i></button>
            <button 
              onClick={() => setShowAiSidebar(!showAiSidebar)} 
              className={`w-8 h-8 rounded transition ${showAiSidebar ? 'text-indigo-500 bg-indigo-500/10' : 'text-slate-500 hover:bg-slate-800'}`} 
              title="Asistente IA"
            >
              <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="cursor-pointer bg-yellow-600 hover:bg-yellow-500 text-slate-950 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition active:scale-95 flex items-center gap-2">
              <i className="fa-solid fa-upload"></i>
              <span className="hidden sm:inline">Nuevo Archivo</span>
              <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
            </label>
          </div>
        </header>

        {file && (
          <div className="absolute bottom-6 left-6 bg-slate-900/90 backdrop-blur border border-slate-700 px-4 py-2 rounded-xl flex items-center gap-6 z-40 shadow-2xl">
            <div className="flex items-center gap-3 border-r border-slate-700 pr-4">
              <button onClick={() => currentPage > 1 && setCurrentPage(p => p - 1)} disabled={currentPage <= 1} className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-800 disabled:opacity-20 transition">
                <i className="fa-solid fa-chevron-left text-xs"></i>
              </button>
              <span className="text-[10px] font-bold text-slate-300 min-w-[80px] text-center uppercase tracking-widest">PLANO {currentPage} / {totalPages}</span>
              <button onClick={() => currentPage < totalPages && setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages} className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-800 disabled:opacity-20 transition">
                <i className="fa-solid fa-chevron-right text-xs"></i>
              </button>
            </div>
            {calibration ? (
              <div className="flex items-center gap-2 text-yellow-500 text-[10px] font-black animate-pulse">
                <i className="fa-solid fa-check-circle"></i> ESCALA CALIBRADA
              </div>
            ) : (
              <div className="text-slate-500 text-[9px] font-bold uppercase">Escala no definida</div>
            )}
          </div>
        )}

        <main className="flex-1 relative overflow-hidden flex flex-col">
          <PdfRenderer 
            file={file} 
            currentPage={currentPage} 
            scale={scale} 
            rotation={rotation}
            tool={activeTool}
            showGrid={showGrid}
            isBlueprint={isBlueprint}
            calibration={calibration}
            onCalibrationComplete={setCalibration}
            onDocumentLoad={onDocumentLoad}
            onFileSelect={handleFileSelect}
            // Pass the tool setter as onToolChange prop
            onToolChange={setActiveTool}
          />
        </main>
      </div>

      {showAiSidebar && (
        <AiSidebar 
          isPdfLoaded={!!file} 
          documentText={documentText}
          onClose={() => setShowAiSidebar(false)}
        />
      )}
    </div>
  );
};

export default App;