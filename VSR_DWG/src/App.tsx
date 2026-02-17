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
        <div className="flex flex-col items-center justify-center h-full bg-slate-900 text-red-400 p-8 text-center">
          <i className="fa-solid fa-bug text-4xl mb-4"></i>
          <h2 className="text-xl font-bold mb-2">Algo salió mal en el visor</h2>
          <p className="text-sm bg-slate-950 p-4 rounded border border-red-900/50 font-mono mb-4 max-w-2xl break-all">
            {this.state.error?.message}
          </p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-white text-sm"
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

  // Load files on mount
  React.useEffect(() => {
    loadRepoFiles()
  }, [])

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
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col overflow-hidden relative`}>
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
                        <i className={`fa-regular fa-file-lines text-xs ${selectedRepoFile?.filename === rf.filename ? 'text-indigo-400' : 'text-slate-500 group-hover:text-yellow-500'}`}></i>
                        <span className={`text-xs font-bold truncate ${selectedRepoFile?.filename === rf.filename ? 'text-indigo-100' : 'text-slate-300 group-hover:text-white'}`}>
                          {rf.name}
                        </span>
                      </div>
                      {rf.description && (
                        <span className="text-[10px] text-slate-500 line-clamp-1 ml-5">
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

        <div className="p-2 border-t border-slate-800 bg-slate-900/50">
          <label className="cursor-pointer bg-yellow-600 hover:bg-yellow-500 text-slate-950 px-3 py-2 rounded-lg text-[10px] font-black uppercase transition active:scale-95 flex items-center justify-center gap-2 w-full">
            <i className="fa-solid fa-upload"></i>
            <span>Subir Archivo</span>
            <input type="file" className="hidden" accept=".dxf,.dwg" onChange={handleFileChange} />
          </label>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-30 shadow-md">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-white transition mr-2"
                title="Mostrar Galería"
              >
                <i className="fa-solid fa-bars"></i>
              </button>
            )}
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-ruler-combined text-yellow-500"></i>
              <span className="text-sm font-bold tracking-tighter uppercase">
                ArchView <span className="text-yellow-500 text-[10px] ml-1">DWG/DXF</span>
              </span>
            </div>
            {file && <div className="h-4 w-px bg-slate-700 mx-2"></div>}
            {file && <span className="text-[10px] text-slate-400 font-mono truncate max-w-[160px]">{file.name}</span>}
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
                onClick={() => setActiveTool('area')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'area' ? 'bg-indigo-600 shadow-inner' : 'hover:bg-slate-700'}`}
                title="Área"
              >
                <i className="fa-solid fa-draw-polygon text-xs"></i>
              </button>
              <button 
                onClick={() => setActiveTool('dimension')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'dimension' ? 'bg-indigo-600 shadow-inner' : 'hover:bg-slate-700'}`}
                title="Cotas"
              >
                <i className="fa-solid fa-ruler-combined text-xs"></i>
              </button>
              <button 
                onClick={() => setActiveTool('calibrate')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'calibrate' ? 'bg-yellow-600 shadow-inner text-slate-950' : 'hover:bg-slate-700'}`}
                title="Calibrar Escala"
              >
                <i className="fa-solid fa-arrows-left-right-to-line text-xs"></i>
              </button>
            </div>

            <button onClick={() => setShowGrid(!showGrid)} className={`w-8 h-8 rounded transition ${showGrid ? 'text-yellow-500 bg-yellow-500/10' : 'text-slate-500 hover:bg-slate-800'}`} title="Grid"><i className="fa-solid fa-border-none text-xs"></i></button>
            <button onClick={() => setIsBlueprint(!isBlueprint)} className={`w-8 h-8 rounded transition ${isBlueprint ? 'text-yellow-500 bg-yellow-500/10' : 'text-slate-500 hover:bg-slate-800'}`} title="Modo Blueprint"><i className="fa-solid fa-eye-slash text-xs"></i></button>
            
            <div className="hidden md:flex items-center gap-2 ml-4 px-2 py-1 rounded bg-slate-800 border border-slate-700">
              <span className="text-[10px] text-slate-400">Snap:</span>
              <label className="flex items-center gap-1 text-[10px]">
                <input type="checkbox" checked={snapSettings.enableEndpoint} onChange={(e) => setSnapSettings(s => ({ ...s, enableEndpoint: e.target.checked }))} />
                <span>Endpoint</span>
              </label>
              <label className="flex items-center gap-1 text-[10px]">
                <input type="checkbox" checked={snapSettings.enableMidpoint} onChange={(e) => setSnapSettings(s => ({ ...s, enableMidpoint: e.target.checked }))} />
                <span>Midpoint</span>
              </label>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400">Umbral</span>
                <input
                  type="range"
                  min={6}
                  max={32}
                  value={snapSettings.thresholdPx}
                  onChange={(e) => setSnapSettings(s => ({ ...s, thresholdPx: parseInt(e.target.value) }))}
                />
                <span className="text-[10px] text-slate-300 w-6 text-center">{snapSettings.thresholdPx}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Gallery button removed, upload moved to sidebar */}
          </div>
        </header>

        {/* Modal removed */}

        {isDownloading ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 m-8 rounded-3xl border border-slate-800">
            <div className="w-16 h-16 border-4 border-yellow-500/30 border-t-yellow-500 animate-spin rounded-full mb-6"></div>
            <span className="text-yellow-500 font-mono text-sm tracking-widest uppercase animate-pulse">Descargando archivo...</span>
          </div>
        ) : downloadError ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 border-2 border-red-900/50 m-8 rounded-3xl">
            <div className="text-center space-y-4 max-w-sm p-8">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                <i className="fa-solid fa-triangle-exclamation text-3xl text-red-500"></i>
              </div>
              <h3 className="text-xl font-bold text-red-400 uppercase tracking-tight">Error de Carga</h3>
              <p className="text-slate-400 text-sm">{downloadError}</p>
              <button 
                onClick={() => setDownloadError(null)}
                className="inline-block cursor-pointer bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-xl font-bold transition-all border border-slate-700"
              >
                Volver
              </button>
            </div>
          </div>
        ) : !file ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 border-2 border-dashed border-slate-800 m-8 rounded-3xl">
            <div className="text-center space-y-4 max-w-sm p-8">
              <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-yellow-500/20">
                <i className="fa-solid fa-cloud-arrow-up text-3xl text-yellow-500 animate-pulse"></i>
              </div>
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Cargar Plano CAD</h3>
              <p className="text-slate-400 text-sm">Selecciona un archivo DXF. Si tienes DWG, conviértelo a DXF para visualizarlo.</p>
              <label className="inline-block cursor-pointer bg-yellow-500 hover:bg-yellow-400 text-slate-950 px-8 py-3 rounded-xl font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-yellow-500/10">
                Seleccionar Archivo DXF/DWG
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".dxf,.dwg" 
                  onChange={handleFileChange} 
                />
              </label>
            </div>
          </div>
        ) : (
          <ErrorBoundary>
            <DwgRenderer 
              file={file}
              tool={activeTool}
              showGrid={showGrid}
              isBlueprint={isBlueprint}
              calibration={calibration}
              onCalibrationComplete={onCalibrationComplete}
              onDocInfo={(info) => setDocInfo(info)}
              snapSettings={snapSettings}
            />
          </ErrorBoundary>
        )}

        {docInfo && (
          <div className="absolute bottom-6 left-6 bg-slate-900/90 backdrop-blur border border-slate-700 px-4 py-2 rounded-xl z-40 shadow-2xl">
            <span className="text-[11px] text-slate-300">{docInfo}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
