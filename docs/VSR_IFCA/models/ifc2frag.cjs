const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {
    input: undefined,
    outDir: process.cwd(),
    force: false,
    json: 'products',
    includeTypeName: true,
    vsrIfcDir: undefined,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input') args.input = argv[++i];
    else if (a === '--outDir') args.outDir = path.resolve(argv[++i]);
    else if (a === '--force') args.force = true;
    else if (a === '--json') args.json = (argv[++i] || '').toLowerCase();
    else if (a === '--no-typeName') args.includeTypeName = false;
    else if (a === '--vsrIfcDir') args.vsrIfcDir = path.resolve(argv[++i]);
  }

  return args;
}

function assertFileExists(p) {
  if (!p || !fs.existsSync(p)) throw new Error(`File not found: ${p}`);
}

function findRepoRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'VSR_IFC', 'node_modules');
    if (fs.existsSync(candidate)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Could not locate repo root containing VSR_IFC/node_modules');
}

function resolveVsrIfcDir({ vsrIfcDir }) {
  if (vsrIfcDir) {
    assertFileExists(path.join(vsrIfcDir, 'package.json'));
    return vsrIfcDir;
  }
  const repoRoot = findRepoRoot(__dirname);
  return path.join(repoRoot, 'VSR_IFC');
}

function pickEntityFields(entity) {
  if (!entity || typeof entity !== 'object') return entity;
  const keep = {};
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
    const v = entity[k];
    if (v !== undefined && v !== null) keep[k] = v;
  }
  return keep;
}

async function generatePropertiesJson(WEBIFC, ifcBytes, outputJsonPath, { mode, includeTypeName, wasmDir }) {
  const ifcApi = new WEBIFC.IfcAPI();
  ifcApi.SetWasmPath(wasmDir + path.sep, true);
  await ifcApi.Init();

  const modelID = ifcApi.OpenModel(ifcBytes);
  const out = fs.createWriteStream(outputJsonPath, { encoding: 'utf8' });
  out.write('{');

  let wroteAny = false;

  if (mode === 'all') {
    const maxId = ifcApi.GetMaxExpressID(modelID);
    for (let id = 1; id <= maxId; id++) {
      try {
        const line = ifcApi.GetLine(modelID, id, false);
        if (!line) continue;
        const entity = pickEntityFields(line);
        if (includeTypeName && typeof line.type === 'number') {
          entity.ifcType = ifcApi.GetNameFromTypeCode(line.type);
        }
        const json = JSON.stringify(entity);
        if (wroteAny) out.write(',');
        out.write(`"${id}":${json}`);
        wroteAny = true;
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
        if (includeTypeName && typeof line.type === 'number') {
          entity.ifcType = ifcApi.GetNameFromTypeCode(line.type);
        }
        const json = JSON.stringify(entity);
        if (wroteAny) out.write(',');
        out.write(`"${id}":${json}`);
        wroteAny = true;
      } catch {
      }
    }
  }

  out.write('}');
  await new Promise((resolve) => out.end(resolve));
  ifcApi.CloseModel(modelID);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.log('Uso: node ifc2frag.cjs --input <archivo.ifc> [--outDir <carpeta>] [--force] [--json products|all] [--no-typeName] [--vsrIfcDir <ruta/VSR_IFC>]');
    process.exit(1);
  }

  const inputIfcPath = path.isAbsolute(args.input) ? args.input : path.resolve(process.cwd(), args.input);
  assertFileExists(inputIfcPath);

  if (!fs.existsSync(args.outDir)) fs.mkdirSync(args.outDir, { recursive: true });

  const vsrIfcDir = resolveVsrIfcDir({ vsrIfcDir: args.vsrIfcDir });
  const nodeModules = path.join(vsrIfcDir, 'node_modules');
  const wasmDir = path.join(nodeModules, 'web-ifc');

  const { IfcImporter } = require(path.join(nodeModules, '@thatopen', 'fragments', 'dist', 'index.cjs'));
  const WEBIFC = require(path.join(nodeModules, 'web-ifc', 'web-ifc-api-node.js'));

  const base = path.basename(inputIfcPath, path.extname(inputIfcPath));
  const outFragPath = path.join(args.outDir, `${base}.frag`);
  const outJsonPath = path.join(args.outDir, `${base}.json`);

  if (!args.force && fs.existsSync(outFragPath) && fs.existsSync(outJsonPath)) {
    console.log(`Ya existen: ${path.basename(outFragPath)} y ${path.basename(outJsonPath)} (usa --force para sobrescribir)`);
    return;
  }

  const buffer = fs.readFileSync(inputIfcPath);
  const bytes = new Uint8Array(buffer);

  const importer = new IfcImporter();
  importer.wasm = { path: wasmDir + path.sep, absolute: true };

  console.log(`[IFC2FRAG] IFC: ${inputIfcPath}`);
  console.log(`[IFC2FRAG] OUT: ${args.outDir}`);
  console.log(`[IFC2FRAG] JSON: ${args.json}`);

  console.log(`[IFC2FRAG] Generando ${path.basename(outFragPath)}...`);
  const fragBytes = await importer.process({ bytes, progressCallback: () => {} });
  fs.writeFileSync(outFragPath, Buffer.from(fragBytes));

  console.log(`[IFC2FRAG] Generando ${path.basename(outJsonPath)}...`);
  await generatePropertiesJson(WEBIFC, bytes, outJsonPath, {
    mode: args.json === 'all' ? 'all' : 'products',
    includeTypeName: args.includeTypeName,
    wasmDir,
  });

  const fragSize = fs.statSync(outFragPath).size;
  const jsonSize = fs.statSync(outJsonPath).size;
  console.log(`[IFC2FRAG] OK. FRAG ${(fragSize / 1024 / 1024).toFixed(2)} MB | JSON ${(jsonSize / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
