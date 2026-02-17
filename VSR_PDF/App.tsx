
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
    <div className="flex h-screen w-full bg-[#000000] text-[#FFFFFF] overflow-hidden select-none">
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="h-12 bg-[#605E62] border-b border-[#827E84] px-4 flex items-center justify-between z-30 shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-drafting-compass text-[#D3045C]"></i>
              <span className="text-sm font-bold tracking-tighter uppercase">ArchView <span className="text-[#D3045C] text-[10px] ml-1">BIM PRO</span></span>
            </div>
            {file && <div className="h-4 w-px bg-[#827E84] mx-2"></div>}
            {file && <span className="text-[10px] text-[#A49FA6] font-mono truncate max-w-[120px]">{file.name}</span>}
          </div>

          <div className="flex items-center gap-1">
            <div className="flex bg-[#827E84] rounded p-0.5 border border-[#A49FA6] mr-4">
              <button 
                onClick={() => setActiveTool('hand')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'hand' ? 'bg-[#D3045C] shadow-inner' : 'hover:bg-[#605E62]'}`}
                title="Mano (Pan)"
              >
                <i className="fa-solid fa-hand-pointer text-xs"></i>
              </button>
              <button 
                onClick={() => setActiveTool('measure')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'measure' ? 'bg-[#D3045C] shadow-inner' : 'hover:bg-[#605E62]'}`}
                title="Medir"
              >
                <i className="fa-solid fa-ruler text-xs"></i>
              </button>
              <button 
                onClick={() => setActiveTool('calibrate')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'calibrate' ? 'bg-[#D3045C] shadow-inner text-[#FFFFFF]' : 'hover:bg-[#605E62]'}`}
                title="Calibrar Escala"
              >
                <i className="fa-solid fa-arrows-left-right-to-line text-xs"></i>
              </button>
            </div>

            <div className="flex items-center gap-2 mr-4">
              <button onClick={() => handleZoom(-0.2)} className="w-6 h-6 flex items-center justify-center hover:bg-[#605E62] rounded transition"><i className="fa-solid fa-minus text-[10px]"></i></button>
              <span className="text-[10px] font-mono w-12 text-center text-[#A49FA6]">{Math.round(scale * 100)}%</span>
              <button onClick={() => handleZoom(0.2)} className="w-6 h-6 flex items-center justify-center hover:bg-[#605E62] rounded transition"><i className="fa-solid fa-plus text-[10px]"></i></button>
            </div>

            <button onClick={handleRotate} className="w-8 h-8 hover:bg-[#605E62] rounded transition" title="Rotar"><i className="fa-solid fa-rotate-right text-xs"></i></button>
            <button onClick={() => setShowGrid(!showGrid)} className={`w-8 h-8 rounded transition ${showGrid ? 'text-[#D3045C] bg-[rgba(211,4,92,0.1)]' : 'text-[#827E84] hover:bg-[#605E62]'}`} title="Grid"><i className="fa-solid fa-border-none text-xs"></i></button>
            <button onClick={() => setIsBlueprint(!isBlueprint)} className={`w-8 h-8 rounded transition ${isBlueprint ? 'text-[#D3045C] bg-[rgba(211,4,92,0.1)]' : 'text-[#827E84] hover:bg-[#605E62]'}`} title="Modo Blueprint"><i className="fa-solid fa-eye-slash text-xs"></i></button>
          </div>

          <div className="flex items-center gap-3">
            <label className="cursor-pointer bg-[#D3045C] hover:bg-[#D3045C] text-[#FFFFFF] px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition active:scale-95 flex items-center gap-2">
              <i className="fa-solid fa-upload"></i>
              <span className="hidden sm:inline">Nuevo Archivo</span>
              <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
            </label>
          </div>
        </header>

        {file && (
          <div className="absolute bottom-6 left-6 bg-[rgba(0,0,0,0.9)] backdrop-blur border border-[#827E84] px-4 py-2 rounded-xl flex items-center gap-6 z-40 shadow-2xl">
            <div className="flex items-center gap-3 border-r border-[#827E84] pr-4">
              <button onClick={() => currentPage > 1 && setCurrentPage(p => p - 1)} disabled={currentPage <= 1} className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#605E62] disabled:opacity-20 transition">
                <i className="fa-solid fa-chevron-left text-xs"></i>
              </button>
              <span className="text-[10px] font-bold text-[#C5C0C8] min-w-[80px] text-center uppercase tracking-widest">PLANO {currentPage} / {totalPages}</span>
              <button onClick={() => currentPage < totalPages && setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages} className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#605E62] disabled:opacity-20 transition">
                <i className="fa-solid fa-chevron-right text-xs"></i>
              </button>
            </div>
            {calibration ? (
              <div className="flex items-center gap-2 text-[#D3045C] text-[10px] font-black animate-pulse">
                <i className="fa-solid fa-check-circle"></i> ESCALA CALIBRADA
              </div>
            ) : (
              <div className="text-[#827E84] text-[9px] font-bold uppercase">Escala no definida</div>
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

      <AiSidebar 
        isPdfLoaded={!!file} 
        documentText={documentText}
      />
    </div>
  );
};

export default App;
