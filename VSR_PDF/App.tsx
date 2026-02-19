
import React, { useState, useCallback, useEffect } from 'react';
import PdfRenderer from './components/PdfRenderer';
import Toolbar from './components/Toolbar';
import { Calibration, Tool } from './types';

interface DrawingItem {
  name: string;
  filename: string;
  folder: string;
}

const DRAWING_BASE_URL = 'https://raw.githubusercontent.com/alcabama-commits/bim/main/VSR_PDF/public/Drawing';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(0.8);
  const [rotation, setRotation] = useState(0);
  const [documentText, setDocumentText] = useState("");
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  const [activeTool, setActiveTool] = useState<Tool>('hand');
  const [showGrid, setShowGrid] = useState(false);
  const [isBlueprint, setIsBlueprint] = useState(false);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);
  const [isLoadingDrawing, setIsLoadingDrawing] = useState(false);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setCurrentPage(1);
    setCalibration(null);
    setDocumentText("");
  };

  const onDocumentLoad = useCallback((pages: number, text: string) => {
    setTotalPages(pages);
    setDocumentText(text);
  }, []);

  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleZoom = (delta: number) => setScale(prev => Math.max(0.1, Math.min(10, prev + delta)));

  useEffect(() => {
    console.log(`%c ALCABAMA BIM v2.4 - ${new Date().toLocaleTimeString()} `, "background: #D3045C; color: #fff; font-size: 20px; padding: 10px;");
  }, []);

  useEffect(() => {
    const loadDrawings = async () => {
      try {
        const response = await fetch(`${DRAWING_BASE_URL}/list.json`);
        if (!response.ok) return;
        const data: DrawingItem[] = await response.json();
        setDrawings(data);
      } catch {
      }
    };
    loadDrawings();
  }, []);

  const handleSelectDrawing = async (drawing: DrawingItem) => {
    setIsLoadingDrawing(true);
    try {
      const pdfPath = `${DRAWING_BASE_URL}/${drawing.filename}`;
      const response = await fetch(pdfPath);
      if (!response.ok) return;
      const blob = await response.blob();
      const fileFromServer = new File([blob], `${drawing.name}.pdf`, { type: 'application/pdf' });
      handleFileSelect(fileFromServer);
    } catch {
    } finally {
      setIsLoadingDrawing(false);
    }
  };

  return (
    <div className={`flex h-screen w-full overflow-hidden select-none ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <Toolbar
          file={file}
          activeTool={activeTool}
          scale={scale}
          showGrid={showGrid}
          isBlueprint={isBlueprint}
          onToolChange={setActiveTool}
          onZoom={handleZoom}
          onRotate={handleRotate}
          onShowGridToggle={() => setShowGrid(!showGrid)}
          onBlueprintToggle={() => setIsBlueprint(!isBlueprint)}
          theme={theme}
          onThemeToggle={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
        />

        {file && (
          <div className="absolute bottom-6 left-6 bg-[#000000]/90 backdrop-blur border border-[#605E62] px-4 py-2 rounded-xl flex items-center gap-6 z-40 shadow-2xl">
            <div className="flex items-center gap-3 border-r border-[#605E62] pr-4">
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

        <main className="flex-1 relative overflow-hidden flex">
          <aside className="w-64 bg-[#05050A] border-r border-[#1E1B22] flex-shrink-0 flex flex-col">
            <div className="px-4 py-3 border-b border-[#1E1B22]">
              <h2 className="text-[11px] font-black text-[#C5C0C8] tracking-[0.18em] uppercase">Planos BIM</h2>
              <p className="text-[10px] text-[#827E84] mt-1">Selecciona un plano de la galería.</p>
            </div>
            <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
              {drawings.map(drawing => (
                <button
                  key={`${drawing.folder}-${drawing.filename}`}
                  onClick={() => handleSelectDrawing(drawing)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-medium transition border border-transparent ${
                    file && file.name.startsWith(drawing.name)
                      ? 'bg-[#D3045C]/15 border-[#D3045C]/40 text-white'
                      : 'bg-[#15121A] hover:bg-[#211C2A] text-[#C5C0C8]'
                  }`}
                >
                  <span className="block truncate">{drawing.name}</span>
                  <span className="block text-[9px] text-[#827E84] mt-0.5">Carpeta {drawing.folder}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="flex-1 relative flex flex-col">
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
              onToolChange={setActiveTool}
            />
            <div className="pointer-events-none fixed left-3 bottom-3 opacity-70">
              <img 
                src={theme === 'dark' ? 'https://i.postimg.cc/yY0XpLzW/LOGO_BIM_BLANCO_ICO.png' : 'https://i.postimg.cc/jdyQ3Mr2/LOGO_BIM_NEGRO_ICO.png'} 
                alt="BIM" 
                className="h-8"
                draggable={false}
              />
            </div>
            {isLoadingDrawing && (
              <div className="absolute inset-0 bg-[#000000]/70 flex items-center justify-center z-40">
                <div className="px-4 py-3 rounded-xl bg-[#0B0B0F] border border-[#605E62]/60 shadow-2xl flex items-center gap-3">
                  <div className="w-6 h-6 border-2 border-[#D3045C]/20 border-t-[#D3045C] rounded-full animate-spin" />
                  <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#C5C0C8]">Cargando plano desde galería...</span>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
