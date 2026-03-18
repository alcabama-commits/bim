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

function getIfcValue(val: any) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && 'value' in val) return (val as any).value;
  return val;
}

function getIfcString(line: any, propName: string) {
  if (!line || !line[propName]) return null;
  return getIfcValue(line[propName]);
}

function shouldKeepType(typeName: string, optimizeAll: boolean) {
  if (!optimizeAll) return true;
  const EXCLUDE_TYPES_PATTERN =
    /POINT|DIRECTION|PLACEMENT|SHAPE|SOLID|FACE|LOOP|VERTEX|EDGE|CURVE|SURFACE|VECTOR|STYLE|COLOR|COLOUR|CONTEXT|REPRESENTATION|UNIT|MEASURE|DIMENSION/;
  const FORCE_KEEP_PATTERN = /PROPERTY|REL|QUANTITY|MATERIAL|TYPE|STYLE|PRESENTATION/;

  const upperType = typeName.toUpperCase();
  if (FORCE_KEEP_PATTERN.test(upperType)) return true;
  if (
    upperType.includes('PROJECT') ||
    upperType.includes('SITE') ||
    upperType.includes('BUILDING') ||
    upperType.includes('STOREY')
  ) {
    return true;
  }

  return !EXCLUDE_TYPES_PATTERN.test(upperType);
}

async function buildRelDefinesByPropertiesMap(ifcApi: WEBIFC.IfcAPI, modelID: number) {
  const relMap = new Map<number, number[]>();
  const relLines = ifcApi.GetLineIDsWithType(modelID, WEBIFC.IFCRELDEFINESBYPROPERTIES);
  const count = relLines.size();
  for (let i = 0; i < count; i++) {
    const id = relLines.get(i);
    try {
      const rel = ifcApi.GetLine(modelID, id, false);
      if (!rel || !rel.RelatedObjects || !rel.RelatingPropertyDefinition) continue;

      const psetId = getIfcValue(rel.RelatingPropertyDefinition);
      if (typeof psetId !== 'number') continue;

      for (const related of rel.RelatedObjects) {
        const objId = getIfcValue(related);
        if (typeof objId !== 'number') continue;
        const list = relMap.get(objId);
        if (list) list.push(psetId);
        else relMap.set(objId, [psetId]);
      }
    } catch {
    }
  }
  if ((relLines as any).delete) (relLines as any).delete();
  return relMap;
}

async function extractPropertiesJsonBlob(
  bytes: Uint8Array,
  mode: JsonMode,
  options: {
    prettyJson: boolean;
    includePsets: boolean;
    optimizeAll: boolean;
    includeSpatialInProducts: boolean;
    minimalEntity: boolean;
    onProgress?: (value: number) => void;
  }
) {
  const ifcApi = new WEBIFC.IfcAPI();
  ifcApi.SetWasmPath(WEB_IFC_WASM_PATH, true);
  await ifcApi.Init();

  const modelID = ifcApi.OpenModel(bytes);
  const relMap = options.includePsets ? await buildRelDefinesByPropertiesMap(ifcApi, modelID) : null;
  const parts: string[] = [];
  const pretty = options.prettyJson;
  let isFirst = true;

  try {
    parts.push(pretty ? '{\n' : '{');

    let idsVec: any | null = null;
    let idsList: number[] | null = null;
    let total = 0;

    if (mode === 'all') {
      idsVec = (ifcApi as any).GetAllLines?.(modelID);
      if (!idsVec) throw new Error('GetAllLines is not available in this WebIFC build');
      total = idsVec.size();
    } else {
      const ids = new Set<number>();
      const addFrom = (vec: any) => {
        const c = vec.size();
        for (let i = 0; i < c; i++) ids.add(vec.get(i));
        if (vec.delete) vec.delete();
      };

      addFrom(ifcApi.GetLineIDsWithType(modelID, WEBIFC.IFCPRODUCT, true));
      if (options.includeSpatialInProducts) {
        addFrom(ifcApi.GetLineIDsWithType(modelID, WEBIFC.IFCPROJECT, true));
        addFrom(ifcApi.GetLineIDsWithType(modelID, WEBIFC.IFCSITE, true));
        addFrom(ifcApi.GetLineIDsWithType(modelID, WEBIFC.IFCBUILDING, true));
        addFrom(ifcApi.GetLineIDsWithType(modelID, WEBIFC.IFCBUILDINGSTOREY, true));
      }

      idsList = Array.from(ids);
      total = idsList.length;
    }

    const pushEntity = (id: number, entity: Record<string, any>) => {
      const key = JSON.stringify(String(id));
      const value = JSON.stringify(entity, null, pretty ? 2 : undefined);
      if (pretty) {
        parts.push(isFirst ? `  ${key}: ${value}` : `,\n  ${key}: ${value}`);
      } else {
        parts.push(isFirst ? `${key}:${value}` : `,${key}:${value}`);
      }
      isFirst = false;
    };

    const extractAndPush = (id: number) => {
      const line = ifcApi.GetLine(modelID, id, false);
      if (!line) return;

      const typeCode = (line as any).type;
      if (typeof typeCode !== 'number') return;
      const typeName = ifcApi.GetNameFromTypeCode(typeCode);
      if (!typeName) return;
      if (mode === 'all' && !shouldKeepType(typeName, options.optimizeAll)) return;

      const baseEntity = options.minimalEntity ? pickEntityFields(line) : { ...line };
      const entity: Record<string, any> = { ...baseEntity };
      entity.typeCode = typeCode;
      entity.type = typeName;
      entity.ifcType = typeName;

      if (relMap?.has(id)) {
        const psetIds = relMap.get(id) ?? [];
        const psets: Record<string, Record<string, any>> = {};
        for (const psetId of psetIds) {
          try {
            const pset = ifcApi.GetLine(modelID, psetId, false);
            if (!pset) continue;
            const psetName = getIfcString(pset, 'Name') || `Pset_${psetId}`;
            const props: Record<string, any> = {};
            if (pset.HasProperties) {
              for (const propRef of pset.HasProperties) {
                const propId = getIfcValue(propRef);
                if (typeof propId !== 'number') continue;
                const prop = ifcApi.GetLine(modelID, propId, false);
                if (prop && prop.Name && prop.NominalValue) {
                  const propName = getIfcString(prop, 'Name');
                  if (!propName) continue;
                  props[propName] = getIfcValue(prop.NominalValue);
                }
              }
            }
            psets[String(psetName)] = props;
          } catch {
          }
        }
        entity.psets = psets;
      }

      pushEntity(id, entity);
    };

    if (mode === 'all') {
      for (let i = 0; i < total; i++) {
        const id = idsVec.get(i);
        try {
          extractAndPush(id);
        } catch {
        }
        if (options.onProgress && i % 250 === 0) options.onProgress(clampProgress((i / Math.max(1, total)) * 100));
      }
      if (idsVec.delete) idsVec.delete();
    } else if (idsList) {
      for (let i = 0; i < total; i++) {
        const id = idsList[i];
        try {
          extractAndPush(id);
        } catch {
        }
        if (options.onProgress && i % 250 === 0) options.onProgress(clampProgress((i / Math.max(1, total)) * 100));
      }
    }

    parts.push(pretty ? '\n}\n' : '}');
  } finally {
    ifcApi.CloseModel(modelID);
  }

  return new Blob(parts, { type: 'application/json' });
}

export default function App() {
  const [state, setState] = useState<ConversionState>({
    status: 'idle',
    message: 'Ready to convert your IFC file.'
  });

  const [jsonMode, setJsonMode] = useState<JsonMode>('products');
  const [prettyJson, setPrettyJson] = useState<boolean>(true);
  const [includePsets, setIncludePsets] = useState<boolean>(true);
  const [includeSpatial, setIncludeSpatial] = useState<boolean>(true);
  const [optimizeAll, setOptimizeAll] = useState<boolean>(true);
  const [minimalEntity, setMinimalEntity] = useState<boolean>(false);

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

          const jsonBlob = await extractPropertiesJsonBlob(bytes, jsonMode, {
            prettyJson,
            includePsets,
            optimizeAll,
            includeSpatialInProducts: includeSpatial,
            minimalEntity,
            onProgress: (p) => {
              const overall = 96 + (p / 100) * 4;
              setState(prev => ({
                ...prev,
                message: 'Building .JSON...',
                progress: clampProgress(overall)
              }));
            }
          });

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

              <div className="mb-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">JSON Detail</span>
                  <select
                    value={jsonMode}
                    onChange={(e) => setJsonMode(e.target.value as JsonMode)}
                    className="h-8 border border-[#141414] px-2 text-[10px] font-mono bg-white"
                    disabled={state.status === 'loading' || state.status === 'converting'}
                  >
                    <option value="products">Products</option>
                    <option value="all">All</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Pretty JSON</span>
                  <button
                    type="button"
                    onClick={() => setPrettyJson((v) => !v)}
                    className="h-8 border border-[#141414] px-2 text-[10px] font-mono bg-white"
                    disabled={state.status === 'loading' || state.status === 'converting'}
                  >
                    {prettyJson ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Include Psets</span>
                  <button
                    type="button"
                    onClick={() => setIncludePsets((v) => !v)}
                    className="h-8 border border-[#141414] px-2 text-[10px] font-mono bg-white"
                    disabled={state.status === 'loading' || state.status === 'converting'}
                  >
                    {includePsets ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Include Spatial</span>
                  <button
                    type="button"
                    onClick={() => setIncludeSpatial((v) => !v)}
                    className="h-8 border border-[#141414] px-2 text-[10px] font-mono bg-white"
                    disabled={state.status === 'loading' || state.status === 'converting'}
                  >
                    {includeSpatial ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Optimize All</span>
                  <button
                    type="button"
                    onClick={() => setOptimizeAll((v) => !v)}
                    className="h-8 border border-[#141414] px-2 text-[10px] font-mono bg-white"
                    disabled={state.status === 'loading' || state.status === 'converting'}
                  >
                    {optimizeAll ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Minimal Entity</span>
                  <button
                    type="button"
                    onClick={() => setMinimalEntity((v) => !v)}
                    className="h-8 border border-[#141414] px-2 text-[10px] font-mono bg-white"
                    disabled={state.status === 'loading' || state.status === 'converting'}
                  >
                    {minimalEntity ? 'ON' : 'OFF'}
                  </button>
                </div>
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
