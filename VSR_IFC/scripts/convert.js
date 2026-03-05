import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { IfcImporter } from '@thatopen/fragments';
import * as WEBIFC from 'web-ifc';
import * as THREE from 'three';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up the importer
const importer = new IfcImporter();

// Configure WASM path for web-ifc
// In Node, we point to the directory containing the wasm file
importer.wasm = {
    path: path.resolve(__dirname, '../node_modules/web-ifc/') + '/', 
    absolute: true
};

// Inject the library to avoid internal fetch attempts if possible, 
// though IfcImporter might still try to load wasm.
// Note: IfcImporter usually handles browser context. In Node, web-ifc loads WASM from disk natively.
// We hope IfcImporter respects the Node environment of web-ifc.

const modelsDir = path.resolve('public/models');
const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.ifc'));

async function convert() {
    console.log('Starting conversion...');
    
    for (const file of files) {
        const inputPath = path.join(modelsDir, file);
        const fragPath = inputPath.replace('.ifc', '.frag');
        const jsonPath = inputPath.replace('.ifc', '.json');
        
        // Convert to .frag if needed
        if (!fs.existsSync(fragPath)) {
            console.log(`Converting ${file} to .frag...`);
            try {
                const buffer = fs.readFileSync(inputPath);
                const data = new Uint8Array(buffer);
                
                const result = await importer.process({
                    bytes: data,
                    progressCallback: (progress) => {
                        // process.stdout.write(`\rProgress: ${Math.round(progress)}%`);
                    }
                });
                
                console.log(`Generated fragment size: ${result.length} bytes`);

                fs.writeFileSync(fragPath, result);
                console.log(`Saved ${path.basename(fragPath)}`);
            } catch (err) {
                console.error(`Error converting ${file} to .frag:`, err);
            }
        } else {
            console.log(`Skipping .frag for ${file} (already exists)`);
        }

        // Convert to .json (properties) if needed
        if (!fs.existsSync(jsonPath)) {
            console.log(`Extracting properties for ${file} to .json...`);
            try {
                const buffer = fs.readFileSync(inputPath);
                const data = new Uint8Array(buffer);
                
                const ifcApi = new WEBIFC.IfcAPI();
                // In Node.js, web-ifc usually locates the wasm automatically
                // ifcApi.SetWasmPath(path.resolve(__dirname, '../node_modules/web-ifc/') + '/');
                await ifcApi.Init();
                
                const modelID = ifcApi.OpenModel(data);
                const lines = ifcApi.GetAllLines(modelID);
                const properties = {};
                
                for (let i = 0; i < lines.size(); i++) {
                    const id = lines.get(i);
                    try {
                        properties[id] = ifcApi.GetLine(modelID, id);
                    } catch (e) {
                        console.warn(`Error reading line ${id}:`, e);
                    }
                }
                
                fs.writeFileSync(jsonPath, JSON.stringify(properties, null, 2));
                console.log(`Saved ${path.basename(jsonPath)}`);
                
                ifcApi.CloseModel(modelID);
            } catch (err) {
                console.error(`Error extracting properties for ${file}:`, err);
            }
        } else {
            console.log(`Skipping .json for ${file} (already exists)`);
        }
    }
    
    console.log('Conversion complete.');
    process.exit(0);
}

convert();
