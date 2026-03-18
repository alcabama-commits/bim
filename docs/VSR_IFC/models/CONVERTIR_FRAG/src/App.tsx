import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as FRAGS from '@thatopen/fragments';
import * as WEBIFC from 'web-ifc';
import { 
  FileUp, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Box, 
  Database,
  FileJson,
  Terminal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface ConversionState {
  status: 'idle' | 'loading' | 'converting' | 'success' | 'error';
  message: string;
  fragBlob?: Blob;
  jsonBlob?: Blob;
  fileName?: string;
  progress?: number;
  errorDetails?: string;
}

type JsonMode = 'products' | 'all';

const WEB_IFC_WASM_PATH = 'https://unpkg.com/web-ifc@0.0.77/';
const FRAGMENTS_WORKER_URL = 'https://thatopen.github.io/engine_fragment/resources/worker.mjs';

function toErrorString(error: unknown) {
  if (error instanceof Error) return error.stack || error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function getFragmentsWorkerUrl() {
  const res = await fetch(FRAGMENTS_WORKER_URL);
  if (!res.ok) throw new Error(`Failed to download fragments worker (${res.status})`);
  const workerBlob = await res.blob();
  const workerFile = new File([workerBlob], 'worker.mjs', { type: 'text/javascript' });
  return URL.createObjectURL(workerFile);
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function pickEntityFields(entity: any) {
  if (!entity || typeof entity !== 'object') return entity;
  const keep: Record<string, any> = {};
  const keys = [
    'expressID',
    'type',
    'GlobalId',
    'Name',
    'LongName',
    'ObjectType',
    'Tag',
    'Description',
    'PredefinedType',
  ];
  for (const k of keys) {
    const v = (entity as any)[k];
    if (v !== undefined && v !== null) keep[k] = v;
  }
  return keep;
}

async function extractPropertiesJson(bytes: Uint8Array, mode: JsonMode) {
  const ifcApi = new WEBIFC.IfcAPI();
  ifcApi.SetWasmPath(WEB_IFC_WASM_PATH, true);
  await ifcApi.Init();

  const modelID = ifcApi.OpenModel(bytes);
  const out: Record<string, any> = {};

  try {
    if (mode === 'all') {
      const maxId = ifcApi.GetMaxExpressID(modelID);
      for (let id = 1; id <= maxId; id++) {
        try {
          const line = ifcApi.GetLine(modelID, id, false);
          if (!line) continue;
          const entity: Record<string, any> = { ...line };
          if (typeof (line as any).type === 'number') entity.ifcType = ifcApi.GetNameFromTypeCode((line as any).type);
          out[String(id)] = entity;
        } catch {
        }
      }
    } else {
      const ids = ifcApi.GetLineIDsWithType(modelID, WEBIFC.IFCPRODUCT, true);
      const count = ids.size();
      for (let i = 0; i < count; i++) {
        const id = ids.get(i);
        try {
          const line = ifcApi.GetLine(modelID, id, false);
          if (!line) continue;
          const entity = pickEntityFields(line);
          if (typeof (line as any).type === 'number') {
            entity.ifcType = ifcApi.GetNameFromTypeCode((line as any).type);
          }
          out[String(id)] = entity;
        } catch {
        }
      }
      if ((ids as any).delete) (ids as any).delete();
    }
  } finally {
    ifcApi.CloseModel(modelID);
  }

  return out;
}

export default function App() {
  const [state, setState] = useState<ConversionState>({
    status: 'idle',
    message: 'Ready to convert your IFC file.'
  });

  const jsonMode: JsonMode = 'all';

  const componentsRef = useRef<OBC.Components | null>(null);
  const fragmentsRef = useRef<OBC.FragmentsManager | null>(null);
  const loaderRef = useRef<OBC.IfcLoader | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const workerUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const components = new OBC.Components();
    componentsRef.current = components;

    const fragments = components.get(OBC.FragmentsManager);
    fragmentsRef.current = fragments;

    const loader = components.get(OBC.IfcLoader);
    loaderRef.current = loader;

    initPromiseRef.current = (async () => {
      components.init();
      const workerUrl = await getFragmentsWorkerUrl();
      workerUrlRef.current = workerUrl;
      await fragments.init(workerUrl);
      await loader.setup({
        wasm: { path: WEB_IFC_WASM_PATH, absolute: true },
        autoSetWasm: false,
        webIfc: {
          COORDINATE_TO_ORIGIN: true
        }
      });
    })();

    return () => {
      if (workerUrlRef.current) URL.revokeObjectURL(workerUrlRef.current);
      components.dispose();
    };
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.ifc')) {
      setState({
        status: 'error',
        message: 'Please select a valid .ifc file.'
      });
      return;
    }

    setState({
      status: 'loading',
      message: 'Reading file...',
      fileName: file.name.replace('.ifc', ''),
      progress: 2,
      errorDetails: undefined
    });

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          if (!buffer) throw new Error('Failed to read file buffer');

          setState(prev => ({
            ...prev,
            status: 'converting',
            message: 'Initializing engine...',
            progress: clampProgress(prev.progress ?? 0)
          }));

          if (!initPromiseRef.current) throw new Error('Converter is not initialized yet');
          await initPromiseRef.current;

          const fragments = fragmentsRef.current;
          const loader = loaderRef.current;
          if (!fragments || !loader) throw new Error('Converter engine is not ready');

          const baseName = file.name.replace(/\.ifc$/i, '');
          const bytes = new Uint8Array(buffer);

          setState(prev => ({ ...prev, message: 'Converting IFC to Fragments...', progress: 10 }));

          const model = await loader.load(bytes, true, baseName, {
            processData: {
              progressCallback: (progress, data) => {
                const p = clampProgress(progress);
                let overall = 10 + (p / 100) * 70;
                if (data.process === 'attributes') overall = 80 + (p / 100) * 7;
                if (data.process === 'relations') overall = 87 + (p / 100) * 6;
                if (data.process === 'conversion') overall = 10 + (p / 100) * 10;
                setState(prev => ({
                  ...prev,
                  progress: clampProgress(overall),
                  message:
                    data.process === 'attributes'
                      ? 'Converting (attributes)...'
                      : data.process === 'relations'
                        ? 'Converting (relations)...'
                        : 'Converting (geometry)...'
                }));
              }
            }
          } as any);

          setState(prev => ({ ...prev, message: 'Exporting .FRAG...', progress: 94 }));
          const fragBuffer = await model.getBuffer(false);
          const fragBlob = new Blob([new Uint8Array(fragBuffer)], { type: 'application/octet-stream' });

          setState(prev => ({ ...prev, message: 'Building .JSON...', progress: 96 }));

          const properties = await extractPropertiesJson(bytes, jsonMode);
          const jsonBlob = new Blob([JSON.stringify(properties, null, 2)], { type: 'application/json' });

          setState(prev => ({
            ...prev,
            status: 'success',
            message: 'Conversion complete!',
            progress: 100,
            fragBlob,
            jsonBlob,
            errorDetails: undefined
          }));

          await model.dispose();
        } catch (error) {
          setState(prev => ({
            ...prev,
            status: 'error',
            message: 'Conversion failed.',
            errorDetails: toErrorString(error)
          }));
        }
      };

      reader.onerror = () => {
        setState({
          status: 'error',
          message: 'Error reading file.',
          errorDetails: toErrorString(reader.error)
        });
      };

      reader.readAsArrayBuffer(file);

    } catch (error) {
      setState({
        status: 'error',
        message: 'Conversion failed.',
        errorDetails: toErrorString(error)
      });
    }
  };

  const downloadFile = (blob: Blob, ext: string) => {
    if (!state.fileName) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.fileName}${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-12 border-b border-[#141414] pb-6">
          <div className="flex items-center gap-3 mb-2">
            <Box className="w-8 h-8" />
            <h1 className="text-3xl font-bold tracking-tight uppercase">IFC to FRAG</h1>
          </div>
          <p className="font-serif italic text-sm opacity-60">
            High-performance BIM conversion utility for web visualization.
          </p>
        </header>

        {/* Main Interface */}
        <main className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Upload Section */}
          <section className="space-y-6">
            <div className="border border-[#141414] p-8 bg-white/50 relative overflow-hidden group">
              <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 border border-dashed border-[#141414] flex items-center justify-center group-hover:bg-[#141414] group-hover:text-[#E4E3E0] transition-colors duration-300">
                  <FileUp className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-lg font-bold uppercase">Upload IFC</h2>
                  <p className="text-xs opacity-50 font-mono">Drag & drop or click to select</p>
                </div>
                <input 
                  type="file" 
                  accept=".ifc" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={state.status === 'loading' || state.status === 'converting'}
                />
              </div>
              {/* Decorative grid lines */}
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-5">
                <div className="w-full h-full grid grid-cols-4 grid-rows-4">
                  {[...Array(16)].map((_, i) => (
                    <div key={i} className="border border-[#141414]" />
                  ))}
                </div>
              </div>
            </div>

            {/* Status Panel */}
            <div className="border border-[#141414] p-6 bg-white">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">System Status</span>
                <Terminal className="w-3 h-3 opacity-30" />
              </div>
              
              <div className="flex items-start gap-3">
                {state.status === 'loading' || state.status === 'converting' ? (
                  <Loader2 className="w-5 h-5 animate-spin mt-0.5" />
                ) : state.status === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                ) : state.status === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5" />
                ) : (
                  <div className="w-5 h-5 border border-[#141414] mt-0.5" />
                )}
                
                <div className="space-y-1">
                  <p className="text-sm font-medium">{state.message}</p>
                  {(state.status === 'loading' || state.status === 'converting') && typeof state.progress === 'number' && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] font-mono opacity-60 mb-1">
                        <span>PROGRESS</span>
                        <span>{Math.round(state.progress)}%</span>
                      </div>
                      <div className="w-full h-2 border border-[#141414]">
                        <div
                          className="h-full bg-[#141414]"
                          style={{ width: `${Math.max(0, Math.min(100, state.progress))}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {state.fileName && (
                    <p className="text-[10px] font-mono opacity-50">FILE: {state.fileName}.ifc</p>
                  )}
                  {state.status === 'error' && state.errorDetails && (
                    <pre className="mt-3 text-[10px] font-mono opacity-70 whitespace-pre-wrap break-words max-h-40 overflow-auto border border-[#141414] p-2">
                      {state.errorDetails}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Output Section */}
          <section className="space-y-6">
            <div className="border border-[#141414] p-6 bg-[#141414] text-[#E4E3E0] h-full flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <span className="text-[10px] font-mono uppercase tracking-widest">Output Assets</span>
                <Database className="w-4 h-4" />
              </div>

              <AnimatePresence mode="wait">
                {state.status === 'success' ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 flex-grow"
                  >
                    {/* Frag Download */}
                    <button 
                      onClick={() => downloadFile(state.fragBlob!, '.frag')}
                      className="w-full border border-[#E4E3E0] p-4 flex items-center justify-between hover:bg-[#E4E3E0] hover:text-[#141414] transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Box className="w-5 h-5" />
                        <div className="text-left">
                          <p className="text-xs font-bold uppercase">Geometry Data</p>
                          <p className="text-[10px] opacity-60 font-mono">.FRAG (Optimized Mesh)</p>
                        </div>
                      </div>
                      <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                    </button>

                    {/* JSON Download */}
                    <button 
                      onClick={() => downloadFile(state.jsonBlob!, '.json')}
                      className="w-full border border-[#E4E3E0] p-4 flex items-center justify-between hover:bg-[#E4E3E0] hover:text-[#141414] transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <FileJson className="w-5 h-5" />
                        <div className="text-left">
                          <p className="text-xs font-bold uppercase">Properties Data</p>
                          <p className="text-[10px] opacity-60 font-mono">.JSON (BIM Metadata)</p>
                        </div>
                      </div>
                      <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                    </button>

                    <div className="mt-8 pt-6 border-t border-[#E4E3E0]/20">
                      <p className="text-[10px] font-mono opacity-40 leading-relaxed">
                        Assets are ready for integration. Use the .frag file for 3D rendering and the .json file for property management in your BIM viewer.
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex-grow flex flex-col items-center justify-center text-center opacity-20 py-12">
                    <Database className="w-12 h-12 mb-4" />
                    <p className="text-xs font-mono uppercase">Waiting for input...</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </main>

        {/* Footer Info */}
        <footer className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-[10px] font-mono opacity-40 border-t border-[#141414] pt-8">
          <div>
            <p className="font-bold uppercase mb-2">Technology</p>
            <p>Powered by That Open Engine & Web-IFC. Optimized for high-performance web-based BIM visualization.</p>
          </div>
          <div>
            <p className="font-bold uppercase mb-2">Format Details</p>
            <p>.FRAG is a binary format that stores geometry as fragments, allowing for massive model loading with minimal memory footprint.</p>
          </div>
          <div>
            <p className="font-bold uppercase mb-2">Data Extraction</p>
            <p>Properties are extracted directly from the IFC schema and mapped to a JSON structure compatible with standard BIM viewers.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
