import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modelsDir = path.join(__dirname, '../public/models');
const outputFile = path.join(__dirname, '../public/models.json');

// Ensure models directory exists
if (!fs.existsSync(modelsDir)) {
    console.error('Models directory not found:', modelsDir);
    process.exit(1);
}

// Get all .ifc files
const files = fs.readdirSync(modelsDir).filter(file => file.toLowerCase().endsWith('.ifc'));

// Create JSON structure
const models = files.map(file => ({
    name: file.replace(/_/g, ' ').replace('.ifc', ''), // Prettify name
    path: `./models/${file}`
}));

// Write to models.json
fs.writeFileSync(outputFile, JSON.stringify(models, null, 2));

console.log(`Generated models.json with ${models.length} models.`);
