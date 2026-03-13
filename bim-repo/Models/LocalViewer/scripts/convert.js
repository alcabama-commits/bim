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
        const outputPath = inputPath.replace('.ifc', '.frag');
        
        if (fs.existsSync(outputPath)) {
            console.log(`Skipping ${file} (already converted)`);
            continue;
        }

        console.log(`Converting ${file}...`);
        
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

            fs.writeFileSync(outputPath, result);
            console.log(`\nSaved ${path.basename(outputPath)}`);
            
            // Explicitly dispose to free memory
            // importer.dispose(); // IfcImporter might not have dispose, but we should check API
            
        } catch (err) {
            console.error(`\nError converting ${file}:`, err);
        }
    }
    
    console.log('Conversion complete.');
    process.exit(0);
}

convert();
