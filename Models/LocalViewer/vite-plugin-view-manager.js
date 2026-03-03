
import fs from 'fs';
import path from 'path';

export default function viewManagerPlugin() {
  return {
    name: 'vite-plugin-view-manager',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url.startsWith('/api/views')) {
          const viewsDir = path.resolve(process.cwd(), 'public/VIEWS');

          // Ensure base views directory exists
          if (!fs.existsSync(viewsDir)) {
            fs.mkdirSync(viewsDir, { recursive: true });
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                const { user, name, viewData } = data;

                if (!user || !name || !viewData) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Missing user, name, or viewData' }));
                  return;
                }

                // Sanitize user and view name to be safe for file system
                const safeUser = user.replace(/[^a-zA-Z0-9@._-]/g, '_');
                const safeName = name.replace(/[^a-zA-Z0-9@._-]/g, '_');

                const userDir = path.join(viewsDir, safeUser);

                // Check/Create User Directory
                if (!fs.existsSync(userDir)) {
                  fs.mkdirSync(userDir, { recursive: true });
                  console.log(`[ViewManager] Created directory for user: ${safeUser}`);
                }

                const filePath = path.join(userDir, `${safeName}.json`);
                fs.writeFileSync(filePath, JSON.stringify(viewData, null, 2));
                
                console.log(`[ViewManager] Saved view: ${filePath}`);
                
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, path: filePath }));
              } catch (err) {
                console.error('[ViewManager] Error saving view:', err);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Internal Server Error' }));
              }
            });
            return;
          }

          if (req.method === 'GET') {
            const urlParts = req.url.split('/');
            // /api/views/<user>
            const rawUser = urlParts[3]; 

            if (rawUser) {
                const user = decodeURIComponent(rawUser);
                const safeUser = user.replace(/[^a-zA-Z0-9@._-]/g, '_');
                const userDir = path.join(viewsDir, safeUser);
                
                if (fs.existsSync(userDir)) {
                    const files = fs.readdirSync(userDir).filter(f => f.endsWith('.json'));
                    const views = files.map(f => {
                        const content = fs.readFileSync(path.join(userDir, f), 'utf-8');
                        try {
                            const json = JSON.parse(content);
                            return { name: f.replace('.json', ''), data: json };
                        } catch (e) {
                            return null;
                        }
                    }).filter(v => v !== null);
                    
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(views));
                } else {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify([]));
                }
            } else {
                 res.statusCode = 400;
                 res.end(JSON.stringify({ error: 'User required' }));
            }
            return;
          }
          
          if (req.method === 'DELETE') {
             // Optional: Add delete logic
             // /api/views/<user>/<viewName>
          }
        }
        next();
      });
    }
  };
}
