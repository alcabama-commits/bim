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
      const name = file.replace(/\.frag$/i, '').replace(/_/g, ' ');
      return {
        name: name,
        path: `models/${file}`,
        folder: 'Auto'
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
  resolve: {
    alias: {
      'three': path.resolve(__dirname, './node_modules/three')
    }
  },
  base: './',
  build: {
    target: 'esnext',
    outDir: '../docs/VSR_IFC',
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
