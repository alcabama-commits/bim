import React, { useState, useCallback } from 'react'
import { Calibration, Tool } from './types'
import DwgRenderer from './components/DwgRenderer'

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [activeTool, setActiveTool] = useState<Tool>('hand')
  const [showGrid, setShowGrid] = useState(false)
  const [isBlueprint, setIsBlueprint] = useState(false)
  const [calibration, setCalibration] = useState<Calibration | null>(null)
  const [docInfo, setDocInfo] = useState<string>('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setCalibration(null)
      setDocInfo('')
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
                onClick={() => setActiveTool('calibrate')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'calibrate' ? 'bg-yellow-600 shadow-inner text-slate-950' : 'hover:bg-slate-700'}`}
                title="Calibrar Escala"
              >
                <i className="fa-solid fa-arrows-left-right-to-line text-xs"></i>
              </button>
            </div>

            <button onClick={() => setShowGrid(!showGrid)} className={`w-8 h-8 rounded transition ${showGrid ? 'text-yellow-500 bg-yellow-500/10' : 'text-slate-500 hover:bg-slate-800'}`} title="Grid"><i className="fa-solid fa-border-none text-xs"></i></button>
            <button onClick={() => setIsBlueprint(!isBlueprint)} className={`w-8 h-8 rounded transition ${isBlueprint ? 'text-yellow-500 bg-yellow-500/10' : 'text-slate-500 hover:bg-slate-800'}`} title="Modo Blueprint"><i className="fa-solid fa-eye-slash text-xs"></i></button>
          </div>

          <div className="flex items-center gap-3">
            <label className="cursor-pointer bg-yellow-600 hover:bg-yellow-500 text-slate-950 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition active:scale-95 flex items-center gap-2">
              <i className="fa-solid fa-upload"></i>
              <span className="hidden sm:inline">Nuevo Archivo</span>
              <input type="file" className="hidden" accept=".dxf,.dwg" onChange={handleFileChange} />
            </label>
          </div>
        </header>

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
