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

// Helper to get all files recursively
const getFiles = (dir, rootDir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath, rootDir));
    } else {
      const ext = path.extname(file).toLowerCase();
      if (ext === '.dxf' || ext === '.dwg') {
        // Calculate relative path from drawingsDir (e.g., "1/file.dxf")
        // Use forward slashes for web compatibility
        const relativePath = path.relative(rootDir, fullPath).split(path.sep).join('/');
        results.push({
            fullPath,
            relativePath,
            filename: file,
            dirName: path.dirname(relativePath) // "1" or "."
        });
      }
    }
  });
  return results;
};

const allFiles = getFiles(drawingsDir, drawingsDir);

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
const galleryList = allFiles.map(fileInfo => {
  const { relativePath, filename, dirName } = fileInfo;

  // Use existing data if available (matching by the full relative path)
  if (existingData[relativePath]) {
    // Ensure the folder property is updated if the file moved (though user said "any folder")
    // If we want to strictly enforce the directory structure as the folder name:
    const folderName = dirName === '.' ? 'General' : dirName;
    return {
        ...existingData[relativePath],
        folder: folderName // Update folder just in case
    };
  }

  // Otherwise create new entry
  const name = path.basename(filename, path.extname(filename))
    .replace(/[-_]/g, ' ') // Replace hyphens/underscores with spaces
    .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize first letters

  const folder = dirName === '.' ? 'General' : dirName;

  return {
    name: name,
    filename: relativePath, // Store relative path as filename identifier
    folder: folder,
    description: `Archivo ${path.extname(filename).toUpperCase().substring(1)} detectado automáticamente`
  };
});

// Write to list.json
fs.writeFileSync(outputFile, JSON.stringify(galleryList, null, 2));

console.log(`Gallery updated! Found ${galleryList.length} files.`);
console.log('List saved to:', outputFile);
