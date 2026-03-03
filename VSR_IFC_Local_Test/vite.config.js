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
        if (file.includes('models') && file.endsWith('.frag')) {
            console.log(`File added: ${file}`);
            generateModels();
        }
      });
      server.watcher.on('unlink', (file) => {
        if (file.includes('models') && file.endsWith('.frag')) {
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
    const files = fs.readdirSync(modelsDir).filter(file => file.toLowerCase().endsWith('.frag'));
    
    const models = files.map(file => {
      // Basic cleanup for name: remove extension, replace _ with space
      // You can customize this name generation logic
      const name = file.replace(/\.frag$/i, '').replace(/_/g, ' ');
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

// Plugin to auto-generate viewpoints index (VISTAS/index.json)
const viewpointsGenerator = () => {
  return {
    name: 'generate-viewpoints-index',
    buildStart() {
      generateViewpointsIndex();
    },
    configureServer(server) {
      const vistasPath = path.resolve(__dirname, 'public/VISTAS');
      server.watcher.add(vistasPath);
      
      server.watcher.on('add', (file) => {
        if (file.includes('VISTAS') && file.endsWith('.json') && !file.endsWith('index.json')) {
            console.log(`Viewpoint added: ${file}`);
            generateViewpointsIndex();
        }
      });
      server.watcher.on('unlink', (file) => {
        if (file.includes('VISTAS') && file.endsWith('.json')) {
            console.log(`Viewpoint removed: ${file}`);
            generateViewpointsIndex();
        }
      });
      server.watcher.on('change', (file) => {
        if (file.includes('VISTAS') && file.endsWith('.json') && !file.endsWith('index.json')) {
             console.log(`Viewpoint changed: ${file}`);
             generateViewpointsIndex();
        }
      });
    }
  };
};

function generateViewpointsIndex() {
  const vistasDir = path.resolve(__dirname, 'public/VISTAS');
  const outputFile = path.resolve(__dirname, 'public/VISTAS/index.json');
  
  if (!fs.existsSync(vistasDir)) return;

  try {
    const files = fs.readdirSync(vistasDir).filter(file => file.toLowerCase().endsWith('.json') && file !== 'index.json');
    
    const viewpoints = [];
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(vistasDir, file), 'utf-8');
        const data = JSON.parse(content);
        // Only include metadata in the index to keep it light
        viewpoints.push({
          id: data.id,
          title: data.title,
          description: data.description,
          category: data.category,
          userId: data.userId,
          date: data.date,
          file: `VISTAS/${file}`
        });
      } catch (e) {
        console.warn(`[Viewpoints Generator] Skipping invalid JSON: ${file}`);
      }
    }

    fs.writeFileSync(outputFile, JSON.stringify(viewpoints, null, 2));
    console.log(`[Viewpoints Generator] Updated VISTAS/index.json with ${viewpoints.length} views.`);
  } catch (err) {
    console.error('[Viewpoints Generator] Error generating index.json:', err);
  }
}

export default defineConfig({
  plugins: [modelsGenerator(), viewpointsGenerator()],
  base: './', // Ensures relative paths for GitHub Pages
  build: {
    target: 'esnext', // Enable top-level await
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
