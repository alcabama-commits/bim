
import React, { useState, useCallback, useEffect } from 'react';
import PdfRenderer from './components/PdfRenderer';
import AiSidebar from './components/AiSidebar';
import { Calibration, Tool } from './types';

interface RepoFile {
  name: string
  filename: string
  description?: string
  folder?: string
}

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
  const [showAiSidebar, setShowAiSidebar] = useState(false);
  const [calibration, setCalibration] = useState<Calibration | null>(null);

  // Repository files state
  const [repoFiles, setRepoFiles] = useState<RepoFile[]>([]);
  const [selectedRepoFile, setSelectedRepoFile] = useState<RepoFile | null>(null);
  const [isLoadingRepo, setIsLoadingRepo] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  // Load files on mount
  useEffect(() => {
    loadRepoFiles();
  }, []);

  const loadRepoFiles = async () => {
    setIsLoadingRepo(true);
    try {
      const baseUrl = (import.meta as any).env?.BASE_URL || './';
      const res = await fetch(`${baseUrl}Drawing/list.json?t=${Date.now()}`);
      if (!res.ok) throw new Error('No se pudo cargar la lista de archivos');
      const data = await res.json();
      setRepoFiles(data);
    } catch (err) {
      console.error(err);
      setRepoFiles([]);
    } finally {
      setIsLoadingRepo(false);
    }
  };

  const selectRepoFile = async (rf: RepoFile) => {
    try {
      setIsDownloading(true);
      setDownloadError(null);
      const baseUrl = (import.meta as any).env?.BASE_URL || './';
      // Encode path parts to handle spaces, but keep slashes
      const encodedPath = rf.filename.split('/').map(part => encodeURIComponent(part)).join('/');
      const url = `${baseUrl}Drawing/${encodedPath}`;
      
      console.log('Downloading file from:', url);
      
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Error al descargar archivo (${res.status})`);
      const blob = await res.blob();
      
      if (blob.size === 0) throw new Error('El archivo está vacío');

      // Use only the basename for the File object to avoid issues with slashes in name
      const simpleName = rf.filename.split('/').pop() || rf.filename;
      const newFile = new File([blob], simpleName, { type: 'application/pdf' });
      
      handleFileSelect(newFile);
      setSelectedRepoFile(rf);
    } catch (err) {
      console.error(err);
      setDownloadError((err as Error).message || 'Error al cargar el archivo');
      setFile(null);
    } finally {
      setIsDownloading(false);
    }
  };

  const toggleFolder = (folder: string) => {
    setCollapsedFolders(prev => ({
      ...prev,
      [folder]: !prev[folder]
    }));
  };

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setCurrentPage(1);
    setCalibration(null);
    setDocumentText("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
      setSelectedRepoFile(null);
    }
  };

  const onDocumentLoad = useCallback((pages: number, text: string) => {
    setTotalPages(pages);
    setDocumentText(text);
  }, []);

  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleZoom = (delta: number) => setScale(prev => Math.max(0.1, Math.min(10, prev + delta)));

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Sidebar de Archivos */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col overflow-hidden relative z-20`}>
        <div className="h-12 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
          <span className="text-sm font-bold uppercase tracking-wider text-slate-400">Galería</span>
          <button onClick={() => setIsSidebarOpen(false)} className="text-slate-500 hover:text-white">
            <i className="fa-solid fa-chevron-left"></i>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {isLoadingRepo && repoFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <i className="fa-solid fa-circle-notch fa-spin text-xl mb-2"></i>
              <span className="text-[10px]">Cargando...</span>
            </div>
          ) : repoFiles.length === 0 ? (
            <div className="text-center py-8 text-slate-500 px-2">
              <p className="text-xs">No hay archivos disponibles</p>
            </div>
          ) : (
            Object.entries(repoFiles.reduce((acc, f) => {
              const k = f.folder || 'General';
              if (!acc[k]) acc[k] = [];
              acc[k].push(f);
              return acc;
            }, {} as Record<string, RepoFile[]>)).map(([folder, files]) => (
              <div key={folder} className="mb-4">
                <button 
                  onClick={() => toggleFolder(folder)}
                  className="w-full text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2 flex items-center justify-between sticky top-0 bg-slate-900 py-1 z-10 border-b border-slate-800/50 hover:text-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <i className={`fa-regular ${collapsedFolders[folder] ? 'fa-folder' : 'fa-folder-open'} text-slate-600`}></i>
                    {folder}
                  </div>
                  <i className={`fa-solid fa-chevron-down transition-transform text-[10px] ${collapsedFolders[folder] ? '-rotate-90' : 'rotate-0'}`}></i>
                </button>
                
                <div className={`space-y-1 overflow-hidden transition-all duration-300 ${collapsedFolders[folder] ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'}`}>
                  {files.map((rf, i) => (
                    <button
                      key={i}
                      onClick={() => selectRepoFile(rf)}
                      className={`w-full text-left p-2.5 rounded-lg border transition group flex flex-col gap-1
                        ${selectedRepoFile?.filename === rf.filename 
                          ? 'bg-indigo-600/20 border-indigo-500/50' 
                          : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-yellow-500/50'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <i className={`fa-regular fa-file-pdf text-xs ${selectedRepoFile?.filename === rf.filename ? 'text-indigo-400' : 'text-slate-500 group-hover:text-yellow-500'}`}></i>
                        <span className={`text-xs font-medium truncate ${selectedRepoFile?.filename === rf.filename ? 'text-indigo-300' : 'text-slate-300 group-hover:text-slate-200'}`}>
                          {rf.name}
                        </span>
                      </div>
                      {rf.description && <span className="text-[10px] text-slate-500 truncate pl-5 block">{rf.description}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-30 shadow-md">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="text-slate-500 hover:text-white mr-2">
                <i className="fa-solid fa-bars"></i>
              </button>
            )}
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