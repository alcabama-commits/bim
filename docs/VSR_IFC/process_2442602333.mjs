
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// Use require for web-ifc to ensure we get the Node.js version
const require = createRequire(import.meta.url);
const WebIFC = require('../../Models/LocalViewer/node_modules/web-ifc');

// Use import for @thatopen/fragments (ESM)
import { IfcImporter } from '../../Models/LocalViewer/node_modules/@thatopen/fragments/dist/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const inputFilePath = path.resolve(__dirname, 'models/2442602333.ifc');
const outputDir = path.dirname(inputFilePath);
const fragOutputPath = path.join(outputDir, '2442602333.frag');
const jsonOutputPath = path.join(outputDir, '2442602333.json');

// WASM Path
const wasmPath = path.resolve(__dirname, '../../Models/LocalViewer/node_modules/web-ifc/');

// Check if input exists
if (!fs.existsSync(inputFilePath)) {
    console.error(`Input file not found: ${inputFilePath}`);
    process.exit(1);
}

async function processFile() {
    console.log(`Processing ${inputFilePath}...`);

    try {
        const buffer = fs.readFileSync(inputFilePath);
        const data = new Uint8Array(buffer);

        // 1. Convert to FRAG
        console.log('Initializing IfcImporter...');
        const importer = new IfcImporter();
        
        importer.wasm = {
            path: wasmPath + '/',
            absolute: true
        };
        
        if (importer.settings) {
            importer.settings.webIfc = {
                COORDINATE_TO_ORIGIN: true,
                USE_FAST_BOOLS: false
            };
        } else {
            console.warn('importer.settings is undefined. Skipping webIfc settings configuration.');
        }

        console.log('Converting to FRAG...');
        const fragResult = await importer.process({
            bytes: data,
            progressCallback: (p) => process.stdout.write(`\rProgress: ${Math.round(p)}%`)
        });
        console.log('\nSaving FRAG file...');
        fs.writeFileSync(fragOutputPath, fragResult);
        console.log(`Saved: ${fragOutputPath}`);

        // 2. Extract ALL Properties to JSON
        console.log('Extracting properties...');
        const ifcApi = new WebIFC.IfcAPI();
        // Try without explicit SetWasmPath first, or use relative if needed
        // ifcApi.SetWasmPath(wasmPath + '/'); 
        await ifcApi.Init();
        
        const modelID = ifcApi.OpenModel(data, { COORDINATE_TO_ORIGIN: true });
        
        // Helper to get raw value
        const getValue = (val) => {
            if (val === null || val === undefined) return null;
            if (val.value !== undefined) return val.value;
            return val;
        };

        const getString = (line, propName) => {
            if (!line || !line[propName]) return null;
            return getValue(line[propName]);
        };

        // Index Relationships (RelDefinesByProperties)
        console.log('Indexing relationships...');
        const relMap = new Map(); 
        const relLines = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCRELDEFINESBYPROPERTIES);
        for (let i = 0; i < relLines.size(); i++) {
            const id = relLines.get(i);
            const rel = ifcApi.GetLine(modelID, id);
            if (!rel || !rel.RelatedObjects || !rel.RelatingPropertyDefinition) continue;
            
            const psetId = rel.RelatingPropertyDefinition.value;
            for (const related of rel.RelatedObjects) {
                const objId = related.value;
                if (!relMap.has(objId)) relMap.set(objId, []);
                relMap.get(objId).push(psetId);
            }
        }

        // Iterate ALL lines
        console.log('Iterating all lines...');
        const allLines = {};
        const vector = ifcApi.GetAllLines(modelID);
        const size = vector.size();
        console.log(`Total IFC lines: ${size}`);

        for (let i = 0; i < size; i++) {
            const id = vector.get(i);
            const line = ifcApi.GetLine(modelID, id);
            if (!line) continue;

            // Create a clean object
            const entity = { ...line };
            
            // Add resolved properties (psets) if available
            if (relMap.has(id)) {
                const psetIds = relMap.get(id);
                entity.psets = {};
                
                for (const psetId of psetIds) {
                    const pset = ifcApi.GetLine(modelID, psetId);
                    if (!pset) continue;
                    const psetName = getString(pset, 'Name') || `Pset_${psetId}`;
                    
                    if (!entity.psets[psetName]) entity.psets[psetName] = {};
                    
                    if (pset.HasProperties) {
                        for (const propRef of pset.HasProperties) {
                            const propId = propRef.value;
                            const prop = ifcApi.GetLine(modelID, propId);
                            if (prop && prop.Name && prop.NominalValue) {
                                const propName = getString(prop, 'Name');
                                const propVal = getValue(prop.NominalValue);
                                entity.psets[psetName][propName] = propVal;
                            }
                        }
                    }
                }
            }
            
            allLines[id] = entity;
            
            if (i % 1000 === 0) process.stdout.write(`\rLines processed: ${i}/${size}`);
        }
        console.log('\nProcessing complete.');

        console.log('Saving JSON file...');
        fs.writeFileSync(jsonOutputPath, JSON.stringify(allLines, null, 2));
        console.log(`Saved: ${jsonOutputPath}`);

        ifcApi.CloseModel(modelID);
        // importer.dispose(); // Check if dispose exists or is needed
        
        console.log('Done.');
        process.exit(0);

    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

processFile();
