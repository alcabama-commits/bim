import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

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

// Plugin to auto-generate viewpoints index (VIEWS/index.json)
const viewpointsGenerator = () => {
  return {
    name: 'generate-viewpoints-index',
    buildStart() {
      generateViewpointsIndex();
    },
    configureServer(server) {
      // Server Middleware
      server.middlewares.use('/api/save-viewpoint', async (req, res, next) => {
        if (req.method === 'POST') {
          try {
            const chunks = [];
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', () => {
              try {
                const body = JSON.parse(Buffer.concat(chunks).toString());
                const { userId, viewpoint } = body;

                if (!userId || !viewpoint) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Missing userId or viewpoint data' }));
                  return;
                }

                // Sanitize userId to be safe for file system
                const safeUserId = userId.replace(/[^a-zA-Z0-9@._-]/g, '_');
                const userDir = path.resolve(__dirname, 'public/VIEWS', safeUserId);

                // 2. Verify/Create user folder
                if (!fs.existsSync(userDir)) {
                  fs.mkdirSync(userDir, { recursive: true });
                  console.log(`[Server] Created directory: ${userDir}`);
                }

                // 3. Store JSON
                const filePath = path.join(userDir, `${viewpoint.id}.json`);
                fs.writeFileSync(filePath, JSON.stringify(viewpoint, null, 2));
                
                console.log(`[Server] Saved viewpoint to: ${filePath}`);
                
                // Trigger index regeneration
                generateViewpointsIndex();

                // Automate Git Sync (Add, Commit, Push)
                // Run in the project root or specific folder
                const projectRoot = __dirname; 
                console.log('[Server] Starting background Git sync...');
                
                const execPromise = (cmd, options) => {
                  return new Promise((resolve, reject) => {
                    exec(cmd, options, (err, stdout, stderr) => {
                      if (err) {
                        console.error(`[Server] Error executing: ${cmd}`, stderr);
                        reject(err);
                      } else {
                        console.log(`[Server] Success: ${cmd}`);
                        resolve(stdout);
                      }
                    });
                  });
                };

                try {
                    await execPromise('git add .', { cwd: projectRoot });
                    try {
                        await execPromise(`git commit -m "feat: auto-save view ${viewpoint.id}"`, { cwd: projectRoot });
                    } catch (e) {
                         // Ignore commit error if nothing to commit, but proceed to push
                         console.log('[Server] Git commit might be empty, proceeding...');
                    }
                    await execPromise('git push origin main', { cwd: projectRoot });
                    console.log('[Server] Successfully pushed to GitHub!');

                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true, path: filePath, git: 'synced' }));
                } catch (gitErr) {
                    console.error('[Server] Git Sync Failed:', gitErr);
                    // We still return 200 because the file WAS saved locally, but we warn about git
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true, path: filePath, git: 'failed', error: gitErr.message }));
                }
              } catch (e) {
                console.error('[Server] Error parsing JSON:', e);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Invalid JSON body' }));
              }
            });
          } catch (err) {
            console.error('[Server] Error saving viewpoint:', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        } else {
          next();
        }
      });

      const viewsPath = path.resolve(__dirname, 'public/VIEWS');
      server.watcher.add(viewsPath);
      
      server.watcher.on('add', (file) => {
        if (file.includes('VIEWS') && file.endsWith('.json') && !file.endsWith('index.json')) {
            console.log(`Viewpoint added: ${file}`);
            generateViewpointsIndex();
        }
      });
      server.watcher.on('unlink', (file) => {
        if (file.includes('VIEWS') && file.endsWith('.json')) {
            console.log(`Viewpoint removed: ${file}`);
            generateViewpointsIndex();
        }
      });
      server.watcher.on('change', (file) => {
        if (file.includes('VIEWS') && file.endsWith('.json') && !file.endsWith('index.json')) {
             console.log(`Viewpoint changed: ${file}`);
             generateViewpointsIndex();
        }
      });
    }
  };
};

function generateViewpointsIndex() {
  const viewsDir = path.resolve(__dirname, 'public/VIEWS');
  const outputFile = path.resolve(__dirname, 'public/VIEWS/index.json');
  
  if (!fs.existsSync(viewsDir)) return;

  try {
    const viewpoints = [];

    // Helper to scan directories recursively
    function scanDirectory(dir) {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            
            if (item.isDirectory()) {
                scanDirectory(fullPath);
            } else if (item.isFile() && item.name.toLowerCase().endsWith('.json') && item.name !== 'index.json') {
                try {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    const data = JSON.parse(content);
                    
                    // Relative path from public root
                    const relativePath = path.relative(path.resolve(__dirname, 'public'), fullPath).replace(/\\/g, '/');

                    // Only include metadata in the index to keep it light
                    viewpoints.push({
                      id: data.id,
                      title: data.title,
                      description: data.description,
                      category: data.category,
                      userId: data.userId,
                      date: data.date,
                      file: relativePath // e.g. "VIEWS/user@email.com/view1.json"
                    });
                } catch (e) {
                    console.warn(`[Viewpoints Generator] Skipping invalid JSON: ${fullPath}`);
                }
            }
        }
    }

    scanDirectory(viewsDir);

    fs.writeFileSync(outputFile, JSON.stringify(viewpoints, null, 2));
    console.log(`[Viewpoints Generator] Updated VIEWS/index.json with ${viewpoints.length} views.`);
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
