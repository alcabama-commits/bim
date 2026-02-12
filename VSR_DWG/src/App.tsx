import React, { useState, useCallback, Component, ErrorInfo } from 'react'
import { Calibration, Tool, SnapSettings } from './types'
import DwgRenderer from './components/DwgRenderer'

// Error Boundary Component
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('DwgRenderer crashed:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-alcabama p-8 text-center">
          <i className="fa-solid fa-bug text-4xl mb-4"></i>
          <h2 className="text-xl font-bold mb-2">Algo salió mal en el visor</h2>
          <p className="text-sm bg-white p-4 rounded border border-red-200 text-gray-700 font-mono mb-4 max-w-2xl break-all shadow-sm">
            {this.state.error?.message}
          </p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-alcabama hover:bg-pink-700 rounded text-white text-sm transition-colors"
          >
            Intentar recargar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

interface RepoFile {
  name: string
  filename: string
  description?: string
  folder?: string
}

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [activeTool, setActiveTool] = useState<Tool>('hand')
  const [showGrid, setShowGrid] = useState(false)
  const [isBlueprint, setIsBlueprint] = useState(false)
  const [calibration, setCalibration] = useState<Calibration | null>(null)
  const [docInfo, setDocInfo] = useState<string>('')
  const [snapSettings, setSnapSettings] = useState<SnapSettings>({
    enableEndpoint: true,
    enableMidpoint: true,
    thresholdPx: 18
  })
  
  // Repository files state
  const [repoFiles, setRepoFiles] = useState<RepoFile[]>([])
  const [selectedRepoFile, setSelectedRepoFile] = useState<RepoFile | null>(null)
  const [isLoadingRepo, setIsLoadingRepo] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({})
  const [isDarkMode, setIsDarkMode] = useState(true)

  // Load files on mount
  React.useEffect(() => {
    loadRepoFiles()
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  const toggleTheme = () => setIsDarkMode(!isDarkMode)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setCalibration(null)
      setDocInfo('')
      setDownloadError(null)
    }
  }

  const loadRepoFiles = async () => {
    setIsLoadingRepo(true)
    try {
      const baseUrl = (import.meta as any).env?.BASE_URL || './'
      const res = await fetch(`${baseUrl}Drawing/list.json?t=${Date.now()}`)
      if (!res.ok) throw new Error('No se pudo cargar la lista de archivos')
      const data = await res.json()
      setRepoFiles(data)
    } catch (err) {
      console.error(err)
      setRepoFiles([])
    } finally {
      setIsLoadingRepo(false)
    }
  }

  const selectRepoFile = async (rf: RepoFile) => {
    try {
      setIsDownloading(true)
      setDownloadError(null)
      const baseUrl = (import.meta as any).env?.BASE_URL || './'
      // Encode path parts to handle spaces, but keep slashes
      const encodedPath = rf.filename.split('/').map(part => encodeURIComponent(part)).join('/')
      const url = `${baseUrl}Drawing/${encodedPath}`
      
      console.log('Downloading file from:', url)
      
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Error al descargar archivo (${res.status})`)
      const blob = await res.blob()
      
      if (blob.size === 0) throw new Error('El archivo está vacío')

      // Use only the basename for the File object to avoid issues with slashes in name
      const simpleName = rf.filename.split('/').pop() || rf.filename
      const newFile = new File([blob], simpleName, { type: 'application/dxf' })
      
      setFile(newFile)
      setCalibration(null)
      setDocInfo('')
      setSelectedRepoFile(rf)
    } catch (err) {
      console.error(err)
      setDownloadError((err as Error).message || 'Error al cargar el archivo')
      setFile(null)
    } finally {
      setIsDownloading(false)
    }
  }

  const toggleFolder = (folder: string) => {
    setCollapsedFolders(prev => ({
      ...prev,
      [folder]: !prev[folder]
    }))
  }

  const onCalibrationComplete = useCallback((c: Calibration) => {
    setCalibration(c)
    setActiveTool('measure')
  }, [])

  return (
    <div className="flex h-screen w-full bg-gray-50 dark:bg-slate-950 text-gray-800 dark:text-slate-200 overflow-hidden select-none font-sans">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 transition-all duration-300 flex flex-col overflow-hidden relative shadow-sm z-20`}>
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100 dark:border-slate-800 shrink-0">
          <span className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">Galería</span>
          <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-alcabama transition-colors">
            <i className="fa-solid fa-chevron-left"></i>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
          {isLoadingRepo && repoFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <i className="fa-solid fa-circle-notch fa-spin text-xl mb-2 text-alcabama"></i>
              <span className="text-[10px]">Cargando...</span>
            </div>
          ) : repoFiles.length === 0 ? (
            <div className="text-center py-8 text-gray-400 px-2">
              <p className="text-xs">No hay archivos</p>
            </div>
          ) : (
            Object.entries(repoFiles.reduce((acc, f) => {
              const k = f.folder || 'General'
              if (!acc[k]) acc[k] = []
              acc[k].push(f)
              return acc
            }, {} as Record<string, RepoFile[]>)).map(([folder, files]) => (
              <div key={folder} className="mb-4">
                <button 
                  onClick={() => toggleFolder(folder)}
                  className="w-full text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-2 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 py-1 z-10 border-b border-gray-100 dark:border-slate-800 hover:text-alcabama transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <i className={`fa-regular ${collapsedFolders[folder] ? 'fa-folder' : 'fa-folder-open'} text-gray-400`}></i>
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
                          ? 'bg-alcabama/5 border-alcabama/30 dark:bg-alcabama/10 dark:border-alcabama/50' 
                          : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-alcabama/30'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <i className={`fa-regular fa-file-lines text-xs ${selectedRepoFile?.filename === rf.filename ? 'text-alcabama' : 'text-gray-400 group-hover:text-alcabama'}`}></i>
                        <span className={`text-xs font-medium truncate ${selectedRepoFile?.filename === rf.filename ? 'text-alcabama' : 'text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white'}`}>
                          {rf.name}
                        </span>
                      </div>
                      {rf.description && (
                        <span className="text-[10px] text-gray-400 line-clamp-1 ml-5">
                          {rf.description}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex flex-col gap-4">
          <label className="cursor-pointer bg-alcabama hover:bg-pink-700 text-white px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition active:scale-95 flex items-center justify-center gap-2 w-full shadow-sm">
            <i className="fa-solid fa-upload"></i>
            <span>Subir Archivo</span>
            <input type="file" className="hidden" accept=".dxf,.dwg" onChange={handleFileChange} />
          </label>
          
          <div className="flex justify-center mt-2">
             <img 
               src={isDarkMode ? "https://i.postimg.cc/ZnmQywXc/LOGO-BIM-BLANCO.png" : "https://i.postimg.cc/fRJ4M9Mp/LOGO-BIM.png"}
               alt="BIM Department" 
               className="h-12 object-contain opacity-80 hover:opacity-100 transition-opacity"
             />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full relative bg-gray-100 dark:bg-slate-950">
        <header className="h-14 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 flex items-center justify-between z-30 shadow-sm">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-alcabama transition mr-2"
                title="Mostrar Galería"
              >
                <i className="fa-solid fa-bars"></i>
              </button>
            )}
            <div className="flex items-center gap-2">
              <img 
                src={isDarkMode ? "https://i.postimg.cc/0yDgcyBp/Logo-transparente_blanco.png" : "https://i.postimg.cc/GmWLmfZZ/Logo-transparente_negro.png"}
                alt="Alcabama" 
                className="h-8 object-contain"
              />
            </div>
            {file && <div className="h-6 w-px bg-gray-200 dark:bg-slate-700 mx-2"></div>}
            {file && <span className="text-xs text-gray-500 dark:text-slate-400 font-mono truncate max-w-[200px]">{file.name}</span>}
          </div>

          <div className="flex items-center gap-1">
            <div className="flex bg-gray-100 dark:bg-slate-800 rounded p-1 border border-gray-200 dark:border-slate-700 mr-4">
              <button 
                onClick={() => setActiveTool('hand')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'hand' ? 'bg-white dark:bg-slate-700 text-alcabama shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200'}`}
                title="Mano (Pan)"
              >
                <i className="fa-solid fa-hand-pointer text-xs"></i>
              </button>
              <button 
                onClick={() => setActiveTool('measure')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'measure' ? 'bg-white dark:bg-slate-700 text-alcabama shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200'}`}
                title="Medir"
              >
                <i className="fa-solid fa-ruler text-xs"></i>
              </button>
              <button 
                onClick={() => setActiveTool('area')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'area' ? 'bg-white dark:bg-slate-700 text-alcabama shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200'}`}
                title="Área"
              >
                <i className="fa-solid fa-draw-polygon text-xs"></i>
              </button>
              <button 
                onClick={() => setActiveTool('dimension')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'dimension' ? 'bg-white dark:bg-slate-700 text-alcabama shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200'}`}
                title="Cotas"
              >
                <i className="fa-solid fa-ruler-combined text-xs"></i>
              </button>
              <button 
                onClick={() => setActiveTool('calibrate')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'calibrate' ? 'bg-alcabama text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200'}`}
                title="Calibrar Escala"
              >
                <i className="fa-solid fa-arrows-left-right-to-line text-xs"></i>
              </button>
            </div>

            <button onClick={toggleTheme} className="w-8 h-8 rounded transition text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-alcabama" title={isDarkMode ? "Modo Claro" : "Modo Oscuro"}>
              <i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'} text-xs`}></i>
            </button>
            <button onClick={() => setShowGrid(!showGrid)} className={`w-8 h-8 rounded transition ${showGrid ? 'text-alcabama bg-alcabama/10' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`} title="Grid"><i className="fa-solid fa-border-none text-xs"></i></button>
            <button onClick={() => setIsBlueprint(!isBlueprint)} className={`w-8 h-8 rounded transition ${isBlueprint ? 'text-alcabama bg-alcabama/10' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`} title="Modo Blueprint"><i className="fa-solid fa-eye-slash text-xs"></i></button>
            
            <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1.5 rounded bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
              <span className="text-[10px] text-gray-400 font-medium">SNAP</span>
              <label className="flex items-center gap-1.5 text-[10px] text-gray-600 dark:text-slate-300 cursor-pointer hover:text-alcabama transition-colors">
                <input type="checkbox" className="accent-alcabama" checked={snapSettings.enableEndpoint} onChange={(e) => setSnapSettings(s => ({ ...s, enableEndpoint: e.target.checked }))} />
                <span>End</span>
              </label>
              <label className="flex items-center gap-1.5 text-[10px] text-gray-600 dark:text-slate-300 cursor-pointer hover:text-alcabama transition-colors">
                <input type="checkbox" className="accent-alcabama" checked={snapSettings.enableMidpoint} onChange={(e) => setSnapSettings(s => ({ ...s, enableMidpoint: e.target.checked }))} />
                <span>Mid</span>
              </label>
            </div>
          </div>
        </header>

        <main className="flex-1 relative overflow-hidden bg-white dark:bg-slate-950">
          {file ? (
            <ErrorBoundary>
              <DwgRenderer 
                file={file}
                tool={activeTool}
                showGrid={showGrid}
                isBlueprint={isBlueprint}
                calibration={calibration}
                onCalibrationComplete={onCalibrationComplete}
                onDocInfo={setDocInfo}
                snapSettings={snapSettings}
                isDarkMode={isDarkMode}
              />
              {/* Overlay Controls / Info */}
              <div className="absolute bottom-4 left-4 pointer-events-none flex flex-col gap-2">
                 {docInfo && (
                   <div className="bg-white/90 backdrop-blur border border-gray-200 p-2 rounded shadow-lg text-[10px] text-gray-600 font-mono pointer-events-auto">
                     {docInfo}
                   </div>
                 )}
                 {calibration && (
                    <div className="bg-alcabama/90 backdrop-blur text-white px-3 py-1 rounded-full shadow-lg text-[10px] font-bold flex items-center gap-2 pointer-events-auto">
                      <i className="fa-solid fa-check"></i>
                      <span>Escala: {calibration.realValue}m = {calibration.world.toFixed(0)}px</span>
                    </div>
                 )}
              </div>
              
              {/* Loading Overlay */}
              {isDownloading && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-50 flex items-center justify-center">
                  <div className="bg-white p-6 rounded-xl shadow-xl border border-gray-100 flex flex-col items-center">
                    <i className="fa-solid fa-cloud-arrow-down text-3xl text-alcabama mb-3 animate-bounce"></i>
                    <h3 className="text-gray-800 font-bold">Descargando archivo...</h3>
                  </div>
                </div>
              )}

              {/* Error Overlay */}
              {downloadError && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
                   <div className="bg-white p-6 rounded-xl shadow-xl border border-red-100 flex flex-col items-center max-w-sm text-center">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                      <i className="fa-solid fa-triangle-exclamation text-red-500 text-xl"></i>
                    </div>
                    <h3 className="text-gray-800 font-bold mb-1">Error de Carga</h3>
                    <p className="text-sm text-gray-500 mb-4">{downloadError}</p>
                    <button 
                      onClick={() => setDownloadError(null)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              )}

            </ErrorBoundary>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
              <div className="w-24 h-24 rounded-full bg-gray-50 flex items-center justify-center mb-4 border border-gray-100">
                <i className="fa-solid fa-folder-open text-4xl text-gray-200"></i>
              </div>
              <p className="text-lg font-medium text-gray-400">Selecciona un archivo para ver</p>
              <p className="text-sm text-gray-300 mt-2">Formatos soportados: .dxf, .dwg</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
