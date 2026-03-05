import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as WEBIFC from 'web-ifc';
import * as Fragments from '@thatopen/fragments';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target file
const targetDir = path.resolve('C:/Users/camilo.martinez/Documents/GitHub/bim/docs/VSR_IFC/models');
const targetFile = '2442602.ifc';
const inputPath = path.join(targetDir, targetFile);

if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
}

const fragPath = inputPath.replace('.ifc', '.frag');
const jsonPath = inputPath.replace('.ifc', '.json');

async function convert() {
    console.log(`Starting conversion for ${targetFile}...`);

    // 1. Convert to .frag
    console.log('Generating .frag file...');
    try {
        const buffer = fs.readFileSync(inputPath);
        const data = new Uint8Array(buffer);
        
        const importer = new Fragments.IfcImporter();
        // importer.settings might be undefined in some versions, or read-only
        if (!importer.settings) {
            importer.settings = {};
        }
        importer.settings.webIfc = {
            COORDINATE_TO_ORIGIN: true,
            USE_FAST_BOOLS: false
        };
        
        // Locate WASM
        importer.wasm = {
            path: path.resolve(__dirname, '../node_modules/web-ifc/') + '/',
            absolute: true
        };

        const fragBinary = await importer.process({
            bytes: data,
            absolute: true
        });
        fs.writeFileSync(fragPath, fragBinary);
        console.log(`Saved ${path.basename(fragPath)} (${(fragBinary.length / 1024 / 1024).toFixed(2)} MB)`);
    } catch (err) {
        console.error('Error generating .frag:', err);
    }

    // 2. Extract Properties to .json
    console.log('Extracting properties to .json...');
    try {
        const ifcApi = new WEBIFC.IfcAPI();
        // In Node.js, web-ifc usually locates the wasm automatically
        // ifcApi.SetWasmPath(path.resolve(__dirname, '../node_modules/web-ifc/') + '/');
        await ifcApi.Init();
        
        const buffer = fs.readFileSync(inputPath);
        const data = new Uint8Array(buffer);
        const modelID = ifcApi.OpenModel(data);
        
        const lines = ifcApi.GetAllLines(modelID);
        const properties = {};
        
        // Iterate through all lines to get properties
        // This mimics the logic in convert.js
        for (let i = 1; i <= lines.size(); i++) {
             try {
                const id = lines.get(i);
                if (id) {
                     properties[id] = ifcApi.GetLine(modelID, id);
                }
             } catch (e) {
                 // Ignore errors for specific lines
             }
        }
        
        // Also try to get all lines if iterator fails or just use GetLine for known IDs?
        // Better approach: Iterate all entities
        // GetAllLines returns a vector of IDs.
        
        // Let's use a simpler approach if the above loop is tricky with IDs
        // Actually, GetAllLines returns a specific Handle, we need to loop properly.
        // Web-IFC API: GetAllLines(modelID) returns a vector.
        
        /* 
           Correct way to iterate:
           const lines = ifcApi.GetAllLines(modelID);
           for(let i = 0; i < lines.size(); i++) {
               const id = lines.get(i);
               properties[id] = ifcApi.GetLine(modelID, id);
           }
        */

       // Reset properties and do it correctly
       const allProps = {};
       const allLines = ifcApi.GetAllLines(modelID);
       for (let i = 0; i < allLines.size(); i++) {
           const id = allLines.get(i);
           try {
               allProps[id] = ifcApi.GetLine(modelID, id);
           } catch (e) {
               console.warn(`Failed to read line ${id}`);
           }
       }

        fs.writeFileSync(jsonPath, JSON.stringify(allProps, null, 2));
        console.log(`Saved ${path.basename(jsonPath)}`);
        
        ifcApi.CloseModel(modelID);
    } catch (err) {
        console.error('Error extracting properties:', err);
    }

    console.log('Done!');
}

convert();
