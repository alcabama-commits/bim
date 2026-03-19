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
  if (!res.ok) throw new Error(`No se pudo descargar el worker de fragments (${res.status})`);
  const workerBlob = await res.blob();
  const workerFile = new File([workerBlob], 'worker.mjs', { type: 'text/javascript' });
  return URL.createObjectURL(workerFile);
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

const HIDROSANITARIO_KEYS = [
  'AREA INTEGRADO',
  'CLASIFICACION',
  'LONGITUD INTEGRADO',
  'MATERIAL INTEGRADO',
  'NIVEL INTEGRADO',
  'NOMBRE INTEGRADO',
  'VOLUMEN INTEGRADO',
  'Tamaño',
];

function normalizePropKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function pickHidrosanitarioFields(entity: any) {
  if (!entity || typeof entity !== 'object') return null;

  const direct: Record<string, any> = entity;
  const psets: Record<string, any> | null =
    direct.psets && typeof direct.psets === 'object' ? direct.psets : null;

  const directIndex = new Map<string, string>();
  for (const k of Object.keys(direct)) directIndex.set(normalizePropKey(k), k);

  const psetPropIndex = new Map<string, { psetName: string; propName: string }>();
  if (psets) {
    for (const [psetName, props] of Object.entries(psets)) {
      if (!props || typeof props !== 'object') continue;
      for (const propName of Object.keys(props as any)) {
        const nk = normalizePropKey(propName);
        if (!psetPropIndex.has(nk)) psetPropIndex.set(nk, { psetName, propName });
      }
    }
  }

  const out: Record<string, any> = {};
  for (const wantedKey of HIDROSANITARIO_KEYS) {
    const normalizedWanted = normalizePropKey(wantedKey);
    const directKey = directIndex.get(normalizedWanted);
    if (directKey) {
      const val = direct[directKey];
      if (val !== undefined && val !== null) out[wantedKey] = val;
      continue;
    }
    const psetMatch = psetPropIndex.get(normalizedWanted);
    if (psetMatch) {
      const val = (psets as any)[psetMatch.psetName]?.[psetMatch.propName];
      if (val !== undefined && val !== null) out[wantedKey] = val;
    }
  }

  return Object.keys(out).length > 0 ? out : null;
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
    hidrosanitario: boolean;
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
      if (!idsVec) throw new Error('GetAllLines no está disponible en esta versión de WebIFC');
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

      if (options.hidrosanitario) {
        const filtered = pickHidrosanitarioFields(entity);
        if (!filtered) return;
        pushEntity(id, filtered);
        return;
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
    message: 'Listo para convertir tu archivo IFC.'
  });

  const [jsonMode, setJsonMode] = useState<JsonMode>('products');
  const [prettyJson, setPrettyJson] = useState<boolean>(true);
  const [includePsets, setIncludePsets] = useState<boolean>(true);
  const [includeSpatial, setIncludeSpatial] = useState<boolean>(true);
  const [optimizeAll, setOptimizeAll] = useState<boolean>(true);
  const [minimalEntity, setMinimalEntity] = useState<boolean>(false);
  const [hidrosanitario, setHidrosanitario] = useState<boolean>(false);

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
        message: 'Selecciona un archivo .ifc válido.'
      });
      return;
    }

    setState({
      status: 'loading',
      message: 'Leyendo archivo...',
      fileName: file.name.replace('.ifc', ''),
      progress: 2,
      errorDetails: undefined
    });

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          if (!buffer) throw new Error('No se pudo leer el contenido del archivo');

          setState(prev => ({
            ...prev,
            status: 'converting',
            message: 'Inicializando motor...',
            progress: clampProgress(prev.progress ?? 0)
          }));

          if (!initPromiseRef.current) throw new Error('El convertidor aún no está inicializado');
          await initPromiseRef.current;

          const fragments = fragmentsRef.current;
          const loader = loaderRef.current;
          if (!fragments || !loader) throw new Error('El motor del convertidor no está listo');

          const baseName = file.name.replace(/\.ifc$/i, '');
          const bytes = new Uint8Array(buffer);

          setState(prev => ({ ...prev, message: 'Convirtiendo IFC a FRAG...', progress: 10 }));

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
                      ? 'Convirtiendo (atributos)...'
                      : data.process === 'relations'
                        ? 'Convirtiendo (relaciones)...'
                        : 'Convirtiendo (geometría)...'
                }));
              }
            }
          } as any);

          setState(prev => ({ ...prev, message: 'Exportando .FRAG...', progress: 94 }));
          const fragBuffer = await model.getBuffer(false);
          const fragBlob = new Blob([new Uint8Array(fragBuffer)], { type: 'application/octet-stream' });

          setState(prev => ({ ...prev, message: 'Generando .JSON...', progress: 96 }));

          const jsonBlob = await extractPropertiesJsonBlob(bytes, jsonMode, {
            prettyJson,
            includePsets: hidrosanitario ? true : includePsets,
            optimizeAll,
            includeSpatialInProducts: includeSpatial,
            minimalEntity,
            hidrosanitario,
            onProgress: (p) => {
              const overall = 96 + (p / 100) * 4;
              setState(prev => ({
                ...prev,
                message: 'Generando .JSON...',
                progress: clampProgress(overall)
              }));
            }
          });

          setState(prev => ({
            ...prev,
            status: 'success',
            message: '¡Conversión completada!',
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
            message: 'La conversión falló.',
            errorDetails: toErrorString(error)
          }));
        }
      };

      reader.onerror = () => {
        setState({
          status: 'error',
          message: 'Error al leer el archivo.',
          errorDetails: toErrorString(reader.error)
        });
      };

      reader.readAsArrayBuffer(file);

    } catch (error) {
      setState({
        status: 'error',
        message: 'La conversión falló.',
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
            <h1 className="text-3xl font-bold tracking-tight uppercase">IFC a FRAG</h1>
          </div>
          <p className="font-serif italic text-sm opacity-60">
            Utilidad de conversión BIM de alto rendimiento para visualización web.
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
                  <h2 className="text-lg font-bold uppercase">Subir IFC</h2>
                  <p className="text-xs opacity-50 font-mono">Arrastra y suelta o haz clic para seleccionar</p>
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
                <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Estado del sistema</span>
                <Terminal className="w-3 h-3 opacity-30" />
              </div>

              <div className="mb-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Detalle JSON</span>
                  <select
                    value={jsonMode}
                    onChange={(e) => setJsonMode(e.target.value as JsonMode)}
                    className="h-8 border border-[#141414] px-2 text-[10px] font-mono bg-white"
                    disabled={state.status === 'loading' || state.status === 'converting'}
                  >
                    <option value="products">Productos</option>
                    <option value="all">Todo</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">JSON formateado</span>
                  <button
                    type="button"
                    onClick={() => setPrettyJson((v) => !v)}
                    className="h-8 border border-[#141414] px-2 text-[10px] font-mono bg-white"
                    disabled={state.status === 'loading' || state.status === 'converting'}
                  >
                    {prettyJson ? 'SÍ' : 'NO'}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Incluir Psets</span>
                  <button
                    type="button"
                    onClick={() => setIncludePsets((v) => !v)}
                    className="h-8 border border-[#141414] px-2 text-[10px] font-mono bg-white"
                    disabled={state.status === 'loading' || state.status === 'converting'}
                  >
                    {includePsets ? 'SÍ' : 'NO'}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Incluir espacial</span>
                  <button
                    type="button"
                    onClick={() => setIncludeSpatial((v) => !v)}
                    className="h-8 border border-[#141414] px-2 text-[10px] font-mono bg-white"
                    disabled={state.status === 'loading' || state.status === 'converting'}
                  >
                    {includeSpatial ? 'SÍ' : 'NO'}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Optimizar Todo</span>
                  <button
                    type="button"
                    onClick={() => setOptimizeAll((v) => !v)}
                    className="h-8 border border-[#141414] px-2 text-[10px] font-mono bg-white"
                    disabled={state.status === 'loading' || state.status === 'converting'}
                  >
                    {optimizeAll ? 'SÍ' : 'NO'}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Entidad mínima</span>
                  <button
                    type="button"
                    onClick={() => setMinimalEntity((v) => !v)}
                    className="h-8 border border-[#141414] px-2 text-[10px] font-mono bg-white"
                    disabled={state.status === 'loading' || state.status === 'converting'}
                  >
                    {minimalEntity ? 'SÍ' : 'NO'}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Hidrosanitario</span>
                  <button
                    type="button"
                    onClick={() =>
                      setHidrosanitario((v) => {
                        const next = !v;
                        if (next) setIncludePsets(true);
                        return next;
                      })
                    }
                    className="h-8 border border-[#141414] px-2 text-[10px] font-mono bg-white"
                    disabled={state.status === 'loading' || state.status === 'converting'}
                  >
                    {hidrosanitario ? 'SÍ' : 'NO'}
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
                        <span>PROGRESO</span>
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
                    <p className="text-[10px] font-mono opacity-50">ARCHIVO: {state.fileName}.ifc</p>
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
                <span className="text-[10px] font-mono uppercase tracking-widest">Archivos de salida</span>
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
                          <p className="text-xs font-bold uppercase">Datos de geometría</p>
                          <p className="text-[10px] opacity-60 font-mono">.FRAG (malla optimizada)</p>
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
                          <p className="text-xs font-bold uppercase">Datos de propiedades</p>
                          <p className="text-[10px] opacity-60 font-mono">.JSON (metadatos BIM)</p>
                        </div>
                      </div>
                      <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                    </button>

                    <div className="mt-8 pt-6 border-t border-[#E4E3E0]/20">
                      <p className="text-[10px] font-mono opacity-40 leading-relaxed">
                        Los archivos están listos para integrar. Usa el .frag para render 3D y el .json para gestión de propiedades en tu visor BIM.
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex-grow flex flex-col items-center justify-center text-center opacity-20 py-12">
                    <Database className="w-12 h-12 mb-4" />
                    <p className="text-xs font-mono uppercase">Esperando archivo...</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </main>

        {/* Footer Info */}
        <footer className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-[10px] font-mono opacity-40 border-t border-[#141414] pt-8">
          <div>
            <p className="font-bold uppercase mb-2">Tecnología</p>
            <p>Impulsado por That Open Engine y Web-IFC. Optimizado para visualización BIM web de alto rendimiento.</p>
          </div>
          <div>
            <p className="font-bold uppercase mb-2">Detalles del formato</p>
            <p>.FRAG es un formato binario que guarda la geometría como fragmentos, permitiendo cargar modelos grandes con un uso mínimo de memoria.</p>
          </div>
          <div>
            <p className="font-bold uppercase mb-2">Extracción de datos</p>
            <p>Las propiedades se extraen directamente del esquema IFC y se mapean a una estructura JSON compatible con visores BIM estándar.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
