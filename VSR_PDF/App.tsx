
import React, { useState, useCallback } from 'react';
import PdfRenderer from './components/PdfRenderer';
import AiSidebar from './components/AiSidebar';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [documentText, setDocumentText] = useState("");
  
  // Arch Tools States
  const [activeTool, setActiveTool] = useState<'select' | 'hand' | 'measure'>('hand');
  const [showGrid, setShowGrid] = useState(false);
  const [isBlueprint, setIsBlueprint] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setCurrentPage(1);
      setDocumentText("");
    }
  };

  const onDocumentLoad = useCallback((pages: number, text: string) => {
    setTotalPages(pages);
    setDocumentText(text);
  }, []);

  const handlePrevPage = () => currentPage > 1 && setCurrentPage(prev => prev - 1);
  const handleNextPage = () => currentPage < totalPages && setCurrentPage(prev => prev + 1);
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 5));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.2));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  return (
    <div className="flex h-screen w-full bg-slate-900 text-slate-100 overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Main Header */}
        <header className="h-14 bg-slate-800 border-b border-slate-700 px-4 flex items-center justify-between z-20 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-1.5 rounded text-white">
              <i className="fa-solid fa-compass-drafting"></i>
            </div>
            <h1 className="text-lg font-bold hidden md:block">ArchView AI</h1>
            {file && (
              <span className="text-xs bg-slate-700 px-3 py-1 rounded-full text-slate-300 max-w-[150px] truncate">
                {file.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-700 rounded-lg p-1 border border-slate-600 mr-2">
              <button 
                onClick={() => setActiveTool('hand')}
                className={`p-1.5 px-3 rounded text-xs transition ${activeTool === 'hand' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-600'}`}
                title="Mano (Pan)"
              >
                <i className="fa-solid fa-hand"></i>
              </button>
              <button 
                onClick={() => setActiveTool('measure')}
                className={`p-1.5 px-3 rounded text-xs transition ${activeTool === 'measure' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-600'}`}
                title="Regla de medición"
              >
                <i className="fa-solid fa-ruler-combined"></i>
              </button>
            </div>

            <div className="flex items-center gap-1 border-r border-slate-700 pr-2 mr-2">
              <button onClick={handleZoomOut} className="p-2 hover:text-indigo-400 transition" title="Reducir">
                <i className="fa-solid fa-minus text-xs"></i>
              </button>
              <span className="text-[10px] font-mono w-10 text-center">{Math.round(scale * 100)}%</span>
              <button onClick={handleZoomIn} className="p-2 hover:text-indigo-400 transition" title="Aumentar">
                <i className="fa-solid fa-plus text-xs"></i>
              </button>
            </div>

            <button onClick={handleRotate} className="p-2 hover:text-indigo-400 transition" title="Rotar 90°">
              <i className="fa-solid fa-rotate-right"></i>
            </button>
            
            <button 
              onClick={() => setShowGrid(!showGrid)} 
              className={`p-2 transition ${showGrid ? 'text-indigo-400' : 'text-slate-400'}`}
              title="Cuadrícula"
            >
              <i className="fa-solid fa-table-cells"></i>
            </button>

            <button 
              onClick={() => setIsBlueprint(!isBlueprint)} 
              className={`p-2 transition ${isBlueprint ? 'text-indigo-400' : 'text-slate-400'}`}
              title="Modo Blueprint"
            >
              <i className="fa-solid fa-circle-half-stroke"></i>
            </button>
          </div>

          <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded text-sm font-semibold transition active:scale-95 flex items-center gap-2">
            <i className="fa-solid fa-upload"></i>
            <span className="hidden sm:inline">Cargar Plano</span>
            <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
          </label>
        </header>

        {/* Page Navigation Overlay */}
        {file && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur-md border border-slate-700 px-4 py-2 rounded-full flex items-center gap-4 z-20 shadow-2xl">
            <button onClick={handlePrevPage} disabled={currentPage <= 1} className="disabled:opacity-20 hover:text-indigo-400">
              <i className="fa-solid fa-angle-left"></i>
            </button>
            <span className="text-xs font-bold tracking-widest uppercase">
              Plano {currentPage} de {totalPages}
            </span>
            <button onClick={handleNextPage} disabled={currentPage >= totalPages} className="disabled:opacity-20 hover:text-indigo-400">
              <i className="fa-solid fa-angle-right"></i>
            </button>
          </div>
        )}

        <main className="flex-1 relative flex flex-col overflow-hidden bg-slate-900">
          <PdfRenderer 
            file={file} 
            currentPage={currentPage} 
            scale={scale} 
            rotation={rotation}
            tool={activeTool}
            showGrid={showGrid}
            isBlueprint={isBlueprint}
            onDocumentLoad={onDocumentLoad}
            onPageChange={setCurrentPage}
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