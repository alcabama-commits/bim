import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const drawingsDir = path.join(__dirname, '../public/Drawing');
const outputFile = path.join(drawingsDir, 'list.json');

// Ensure directory exists
if (!fs.existsSync(drawingsDir)) {
  console.error('Directory not found:', drawingsDir);
  process.exit(1);
}

// Get all files
const files = fs.readdirSync(drawingsDir);

// Filter for .dxf and .dwg
const drawingFiles = files.filter(file => {
  const ext = path.extname(file).toLowerCase();
  return ext === '.dxf' || ext === '.dwg';
});

// Get existing list if available to preserve descriptions
let existingData = {};
if (fs.existsSync(outputFile)) {
  try {
    const content = fs.readFileSync(outputFile, 'utf-8');
    const json = JSON.parse(content);
    json.forEach(item => {
      existingData[item.filename] = item;
    });
  } catch (e) {
    console.warn('Could not read existing list.json, starting fresh.');
  }
}

// Create list
const galleryList = drawingFiles.map(filename => {
  // Use existing data if available
  if (existingData[filename]) {
    return existingData[filename];
  }

  // Otherwise create new entry
  const name = path.basename(filename, path.extname(filename))
    .replace(/[-_]/g, ' ') // Replace hyphens/underscores with spaces
    .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize first letters

  return {
    name: name,
    filename: filename,
    description: `Archivo ${path.extname(filename).toUpperCase().substring(1)} detectado autom\u00e1ticamente`
  };
});

// Write to list.json
fs.writeFileSync(outputFile, JSON.stringify(galleryList, null, 2));

console.log(`Gallery updated! Found ${galleryList.length} files.`);
console.log('List saved to:', outputFile);
