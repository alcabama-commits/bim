
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const WebIFC = require('../VSR_IFC/node_modules/web-ifc');
const { IfcImporter } = require('../VSR_IFC/node_modules/@thatopen/fragments');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modelsDir = __dirname;
// const outputDir = path.join(modelsDir, 'FRAG');
const outputDir = path.resolve(__dirname, '../docs/VSR_IFC/models');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.ifc'));

// Geometry/Definition types to exclude from properties JSON to reduce noise
const EXCLUDE_TYPES_PATTERN = /POINT|DIRECTION|PLACEMENT|SHAPE|SOLID|FACE|LOOP|VERTEX|EDGE|CURVE|SURFACE|VECTOR|STYLE|COLOR|COLOUR|CONTEXT|REPRESENTATION|UNIT|MEASURE|DIMENSION/;
// Ensure we KEEP relationships, properties, products, spatial structure
const KEEP_TYPES_PATTERN = /PROJECT|SITE|BUILDING|STOREY|SPACE|WALL|SLAB|WINDOW|DOOR|BEAM|COLUMN|MEMBER|PLATE|ROOF|STAIR|RAMP|RAILING|CURTAIN|COVERING|FURNISHING|ELEMENT|FLOW|DISTRIBUTION|PROXY|REL|PROPERTY|QUANTITY|MATERIAL|GROUP|SYSTEM|ZONE|TYPE/;

async function convertAndOptimize() {
    console.log(`Found ${files.length} IFC models to process.`);
    
    // Initialize WebIFC
    const ifcApi = new WebIFC.IfcAPI();
    await ifcApi.Init();
    console.log('WebIFC initialized.');
    
    // Initialize Importer (moved to loop)
    // const importer = new IfcImporter();
    // Configure WASM path for Importer
    // We copied the wasm to the current directory to avoid path issues
    // const wasmDir = __dirname;
    // importer.wasm = { path: wasmDir + '/', absolute: true };
    
    let processedCount = 0;

    // Initialize Importer ONCE
    const importer = new IfcImporter();
    const wasmPath = path.resolve(__dirname, '../VSR_IFC/node_modules/web-ifc/');
    importer.wasm = { path: wasmPath + '/', absolute: true };
    
    // Default settings (match original script)
    // importer.settings = ...
    
    for (const file of files) {
        // Re-initialize Importer for each file to ensure clean state -> NO, reuse it
        // const importer = new IfcImporter(); ...
        
        const inputPath = path.join(modelsDir, file);
        const fragOutputName = file.replace('.ifc', '.frag');
        const jsonOutputName = file.replace('.ifc', '.json');
        const fragPath = path.join(outputDir, fragOutputName);
        const jsonPath = path.join(outputDir, jsonOutputName);
        
        // Clean old files
        if (fs.existsSync(fragPath)) fs.unlinkSync(fragPath);
        if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);

        console.log(`\nProcessing ${file}...`);

        try {
            const buffer = fs.readFileSync(inputPath);
            const data = new Uint8Array(buffer);
            
            // 1. Generate Optimized JSON (Resolved Properties)
            console.log(`  -> Generating Optimized JSON...`);
            let modelID;
            try {
                modelID = ifcApi.OpenModel(data);
            } catch (e) {
                console.error("WebIFC OpenModel failed:", e);
                throw e;
            }
            
            // Helper to get raw value
            const getValue = (val) => {
                if (val === null || val === undefined) return null;
                if (val.value !== undefined) return val.value;
                return val;
            };

            // Helper to get string properties
            const getString = (line, propName) => {
                if (!line || !line[propName]) return null;
                return getValue(line[propName]);
            };

            // Index Relationships
            const relMap = new Map(); // Object ID -> [Pset IDs]
            
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

            const optimizedLines = {};
            let totalLines = 0;
            let keptLines = 0;
            
            // Iterate all lines
            const vector = ifcApi.GetAllLines(modelID);
            const size = vector.size();
            
            console.log(`  -> Total IFC lines: ${size}`);
            let debugCounts = { WALL: 0, BEAM: 0, PROP: 0, REL: 0 };
            
            for (let i = 0; i < size; i++) {
                const id = vector.get(i);
                const line = ifcApi.GetLine(modelID, id);
                if (!line) continue;
                
                totalLines++;
                
                const typeName = ifcApi.GetNameFromTypeCode(line.type);
                if (!typeName) continue;
                
                const upperType = typeName.toUpperCase();
                
                // EXCLUDE geometry types only
                let keep = true;
                if (EXCLUDE_TYPES_PATTERN.test(upperType)) {
                    keep = false;
                }
                
                // FORCE KEEP for specific types that might be matched by exclude pattern or missed
                if (upperType.includes('PROPERTY') || 
                    upperType.includes('REL') || 
                    upperType.includes('QUANTITY') ||
                    upperType.includes('MATERIAL') ||
                    upperType.includes('TYPE') ||
                    upperType.includes('STYLE') || 
                    upperType.includes('PRESENTATION')) {
                    keep = true;
                }
                
                if (keep) {
                    // Start with full entity data to preserve relationships (RelatedObjects, HasProperties, etc.)
                    const entity = { ...line };
                    
                    // Add resolved properties for convenience (custom viewers)
                    // We don't overwrite standard fields to avoid breaking standard viewers
                    if (relMap.has(id)) {
                        const psetIds = relMap.get(id);
                        entity.psets = {};
                        
                        for (const psetId of psetIds) {
                            const pset = ifcApi.GetLine(modelID, psetId);
                            if (!pset) continue;
                            const psetName = getString(pset, 'Name') || `Pset_${psetId}`;
                            
                            entity.psets[psetName] = {};
                            
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

                    optimizedLines[id] = entity;
                    keptLines++;
                    
                    if (upperType.includes('WALL')) debugCounts.WALL++;
                    if (upperType.includes('BEAM')) debugCounts.BEAM++;
                }
            }
            
            console.log(`  -> Debug Counts (Saved): Walls=${debugCounts.WALL}, Beams=${debugCounts.BEAM}`);
            
            if (vector.delete) vector.delete();
            
            const jsonContent = JSON.stringify(optimizedLines, null, 2);
            fs.writeFileSync(jsonPath, jsonContent);
            
            console.log(`  -> Saved .json (${(jsonContent.length / 1024 / 1024).toFixed(2)} MB)`);
            console.log(`  -> Optimization: Reduced from ${totalLines} to ${keptLines} items.`);
            
            ifcApi.CloseModel(modelID);
            
            // 2. Generate FRAG
            console.log(`  -> Generating Fragment...`);
            
            // Pass object with bytes property as required by IfcImporter
            // Using the pattern from VSR_IFC/scripts/convert.js
            const fragBinary = await importer.process({ 
                bytes: data,
                absolute: true 
            });
            
            fs.writeFileSync(fragPath, fragBinary);
            console.log(`  -> Saved .frag (${(fragBinary.length / 1024 / 1024).toFixed(2)} MB)`);
            
            processedCount++;

        } catch (err) {
            console.error(`Error processing ${file}:`, err);
        }
    }
    
    console.log(`\nConversion & Optimization complete. Processed ${processedCount} files.`);
}

convertAndOptimize().catch(err => {
    console.error("Fatal error:", err);
});
