import React, { useState, useCallback } from 'react'
import { Calibration, Tool, SnapSettings } from './types'
import DwgRenderer from './components/DwgRenderer'

interface RepoFile {
  name: string
  filename: string
  description?: string
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
  const [showRepoModal, setShowRepoModal] = useState(false)
  const [isLoadingRepo, setIsLoadingRepo] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setCalibration(null)
      setDocInfo('')
    }
  }

  const loadRepoFiles = async () => {
    setIsLoadingRepo(true)
    setShowRepoModal(true)
    try {
      const baseUrl = (import.meta as any).env?.BASE_URL || './'
      const res = await fetch(`${baseUrl}drawings/list.json?t=${Date.now()}`)
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
      setIsLoadingRepo(true)
      const baseUrl = (import.meta as any).env?.BASE_URL || './'
      const url = `${baseUrl}drawings/${rf.filename}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Error al descargar archivo')
      const blob = await res.blob()
      const newFile = new File([blob], rf.filename, { type: 'application/dxf' })
      setFile(newFile)
      setCalibration(null)
      setDocInfo('')
      setShowRepoModal(false)
    } catch (err) {
      alert('Error al cargar el archivo del repositorio')
      console.error(err)
    } finally {
      setIsLoadingRepo(false)
    }
  }

  const onCalibrationComplete = useCallback((c: Calibration) => {
    setCalibration(c)
    setActiveTool('measure')
  }, [])

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden select-none">
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-30 shadow-md">
          <div className="flex items-center gap-4">
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
            <button
              onClick={loadRepoFiles}
              className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition active:scale-95 border border-slate-700 flex items-center gap-2"
              title="Abrir desde Repositorio"
            >
              <i className="fa-solid fa-folder-open"></i>
              <span className="hidden sm:inline">Galería</span>
            </button>
            <label className="cursor-pointer bg-yellow-600 hover:bg-yellow-500 text-slate-950 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition active:scale-95 flex items-center gap-2">
              <i className="fa-solid fa-upload"></i>
              <span className="hidden sm:inline">Nuevo Archivo</span>
              <input type="file" className="hidden" accept=".dxf,.dwg" onChange={handleFileChange} />
            </label>
          </div>
        </header>

        {showRepoModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <i className="fa-solid fa-folder-open text-yellow-500"></i>
                  Galería de Planos
                </h3>
                <button 
                  onClick={() => setShowRepoModal(false)}
                  className="w-8 h-8 rounded hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto flex-1">
                {isLoadingRepo && repoFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <i className="fa-solid fa-circle-notch fa-spin text-2xl mb-2"></i>
                    <span className="text-xs uppercase tracking-widest">Cargando lista...</span>
                  </div>
                ) : repoFiles.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <i className="fa-regular fa-folder-open text-4xl mb-3 opacity-50"></i>
                    <p>No hay archivos disponibles en la galería.</p>
                    <p className="text-xs mt-2 text-slate-600">Sube archivos a /public/drawings y actualiza list.json</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {repoFiles.map((rf, i) => (
                      <button
                        key={i}
                        onClick={() => selectRepoFile(rf)}
                        className="flex flex-col items-start p-3 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-yellow-500/50 transition group text-left"
                      >
                        <div className="flex items-center gap-2 mb-1 w-full">
                          <i className="fa-regular fa-file-lines text-yellow-500 group-hover:scale-110 transition"></i>
                          <span className="font-bold text-sm truncate flex-1">{rf.name}</span>
                        </div>
                        {rf.description && (
                          <p className="text-xs text-slate-400 line-clamp-2">{rf.description}</p>
                        )}
                        <span className="text-[10px] text-slate-500 font-mono mt-2">{rf.filename}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl">
                <p className="text-[10px] text-slate-500 text-center">
                  Selecciona un archivo para abrirlo inmediatamente.
                </p>
              </div>
            </div>
          </div>
        )}

        {!file ? (
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
