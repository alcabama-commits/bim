
import React, { useState, useCallback, useEffect } from 'react';
import PdfRenderer from './components/PdfRenderer';
import AiSidebar from './components/AiSidebar';
import Toolbar from './components/Toolbar';
import { Calibration, Tool } from './types';

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
          <div className="pointer-events-none fixed left-3 bottom-3 opacity-70">
            <img 
              src={theme === 'dark' ? 'https://i.postimg.cc/yY0XpLzW/LOGO_BIM_BLANCO_ICO.png' : 'https://i.postimg.cc/jdyQ3Mr2/LOGO_BIM_NEGRO_ICO.png'} 
              alt="BIM" 
              className="h-8"
              draggable={false}
            />
          </div>
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
