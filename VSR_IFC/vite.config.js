import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Plugin to auto-generate models.json
const modelsGenerator = () => {
  return {
    name: 'generate-models-json',
    buildStart() {
      generateModels();
    },
    configureServer(server) {
      // Watch for changes in public/models
      const modelsPath = path.resolve(__dirname, 'public/models');
      server.watcher.add(modelsPath);
      
      server.watcher.on('add', (file) => {
        if (file.includes('models') && file.endsWith('.ifc')) {
            console.log(`File added: ${file}`);
            generateModels();
        }
      });
      server.watcher.on('unlink', (file) => {
        if (file.includes('models') && file.endsWith('.ifc')) {
            console.log(`File removed: ${file}`);
            generateModels();
        }
      });
    }
  };
};

function generateModels() {
  const modelsDir = path.resolve(__dirname, 'public/models');
  const outputFile = path.resolve(__dirname, 'public/models.json');
  
  if (!fs.existsSync(modelsDir)) return;

  try {
    const files = fs.readdirSync(modelsDir).filter(file => file.toLowerCase().endsWith('.ifc'));
    
    const models = files.map(file => {
      // Basic cleanup for name: remove extension, replace _ with space
      // You can customize this name generation logic
      const name = file.replace(/\.ifc$/i, '').replace(/_/g, ' ');
      return {
        name: name,
        path: `models/${file}`,
        folder: 'Auto' // Frontend logic (getSpecialtyFromIfcPath) handles the actual grouping
      };
    });

    fs.writeFileSync(outputFile, JSON.stringify(models, null, 2));
    console.log(`[Models Generator] Updated models.json with ${models.length} files.`);
  } catch (err) {
    console.error('[Models Generator] Error generating models.json:', err);
  }
}

export default defineConfig({
  plugins: [modelsGenerator()],
  base: './', // Ensures relative paths for GitHub Pages
  build: {
    outDir: '../docs/VSR_IFC', // Deploys to docs/VSR_IFC for GitHub Pages
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    open: true
  }
});
