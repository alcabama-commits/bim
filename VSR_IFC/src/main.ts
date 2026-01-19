import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import * as BUI from '@thatopen/ui';
import * as CUI from '@thatopen/ui-obc';
import './style.css';

// Global Error Handler for debugging in production
window.onerror = function(message, source, lineno, colno, error) {
    const debugEl = document.getElementById('debug-console');
    if (debugEl) {
        debugEl.style.display = 'block';
        const line = document.createElement('div');
        line.textContent = `CRITICAL ERROR: ${message} at ${source}:${lineno}`;
        line.style.color = '#ff0000';
        line.style.backgroundColor = '#fff0f0';
        line.style.padding = '5px';
        line.style.borderBottom = '1px solid #ffcccc';
        debugEl.appendChild(line);
    }
    console.error('Global Error:', message, error);
};

// --- Global Variables Declaration ---
let components: OBC.Components;
let worlds: OBC.Worlds;
let world: OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>;
let fragments: OBC.FragmentsManager;
let grids: OBC.Grids;
let clipper: OBC.Clipper;
let classifier: OBC.Classifier;
let highlighter: OBF.Highlighter;
let ifcLoader: OBC.IfcLoader;
let fragmentsReady = false;

const baseUrl = import.meta.env.BASE_URL || './';
const loadedModels = new Map<string, any>();

// --- Initialization Logic ---
async function initApp() {
    try {
        console.log('VSR_IFC Version: 1.2.1 - Fixed Initialization Order');
        logToScreen('Starting Application Initialization (v1.2.1)...');

        const container = document.getElementById('viewer-container') as HTMLElement;
        if (!container) throw new Error('Viewer container not found');

        // 1. Initialize Components System
        components = new OBC.Components();
        worlds = components.get(OBC.Worlds);
        
        world = worlds.create<
            OBC.SimpleScene,
            OBC.OrthoPerspectiveCamera,
            OBC.SimpleRenderer
        >();

        world.scene = new OBC.SimpleScene(components);
        world.scene.setup();
        world.scene.three.background = new THREE.Color(0xf5f5f5);

        world.renderer = new OBC.SimpleRenderer(components, container);
        world.camera = new OBC.OrthoPerspectiveCamera(components);

        // components.init(); // MOVED: Initialize after fragments to avoid update loop accessing uninitialized fragments
        
        // 2. Initialize UI (Basic)
        initTheme();
        initSidebar();
        initTabs(); // Ensure tabs are initialized
        initFitModelTool();
        initPropertiesPanel();

        // 3. Initialize Fragments (Async - Critical)
        logToScreen('Initializing Fragments Engine...');
        fragments = components.get(OBC.FragmentsManager);
        
        // @ts-ignore
        await fragments.init(`${baseUrl}fragments/fragments.mjs`);
        fragmentsReady = true;
        logToScreen('Fragments Engine Ready.');

        // NOW start the update loop
        components.init();

        // 4. Initialize Dependent Components
        grids = components.get(OBC.Grids);
        grids.create(world);
        initGridToggle(); // Now grids is ready

        clipper = components.get(OBC.Clipper);
        classifier = components.get(OBC.Classifier);
        highlighter = components.get(OBF.Highlighter);
        ifcLoader = components.get(OBC.IfcLoader);

        // Setup Highlighter
        highlighter.setup({ world });
        highlighter.zoomToSelection = true;

        // Setup IfcLoader
        const wasmPath = `${baseUrl}wasm/`;
        console.log('Setting up IfcLoader with WASM path:', wasmPath);
        ifcLoader.setup({
            wasm: {
                path: wasmPath,
                absolute: true
            }
        });

        // 5. Initialize Dependent UI & Tools
        initProjectionToggle();
        initClipperTool();
        initPropertiesEvents();
        
        // Setup Camera Sync Event (Now safe)
        world.camera.controls.addEventListener('rest', () => {
            if (fragmentsReady && fragments && fragments.core) {
                try {
                    fragments.core.update(true);
                } catch(e) {
                    // Ignore update errors if not ready
                }
            }
        });
        
        // 6. Final UI Setup
        BUI.Manager.init();
        initViewControls(); // Setup view buttons

        // 7. Load Initial Content
        loadModelList();
        
        logToScreen('System Fully Initialized.');
        
    } catch (e) {
        console.error('CRITICAL ERROR DURING INITIALIZATION:', e);
        logToScreen('CRITICAL ERROR DURING INITIALIZATION: ' + e, true);
        alert('Error critico al iniciar la aplicacion. Ver consola para mas detalles.');
    }
}

// Start
initApp();

// --- Helper Functions Definitions ---
// (Moved initViewControls logic into a function to be called in initApp)
function initViewControls() {
    const consoleToggle = document.getElementById('console-toggle');
    if (consoleToggle) {
        consoleToggle.addEventListener('click', () => {
            const consoleEl = document.getElementById('debug-console');
            if (consoleEl) {
                const isVisible = consoleEl.style.display !== 'none';
                consoleEl.style.display = isVisible ? 'none' : 'block';
                consoleToggle.classList.toggle('active', !isVisible);
            }
        });
    }

    const viewDropdownBtn = document.getElementById('view-dropdown-btn');
    const viewDropdownMenu = document.getElementById('view-dropdown-menu');

    if (viewDropdownBtn && viewDropdownMenu) {
        viewDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            viewDropdownMenu.classList.toggle('show');
        });

        document.addEventListener('click', () => {
            viewDropdownMenu.classList.remove('show');
        });
    }

    const viewButtons = document.querySelectorAll('.view-btn');
    viewButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const view = btn.getAttribute('data-view');
            
            if (viewDropdownBtn) {
                const icon = btn.querySelector('i')?.cloneNode(true);
                const text = btn.textContent?.trim();
                const span = viewDropdownBtn.querySelector('span');
                if (span && text) {
                    span.innerHTML = '';
                    if(icon) span.appendChild(icon);
                    span.append(` ${text}`);
                }
            }

            const box = getModelBox();
            const sphere = new THREE.Sphere();
            box.getBoundingSphere(sphere);
            const center = sphere.center;
            const radius = sphere.radius || 20;
            const dist = radius * 2;
            const controls = world.camera.controls;

            switch(view) {
                case 'iso': await controls.setLookAt(center.x + dist, center.y + dist, center.z + dist, center.x, center.y, center.z, true); break;
                case 'top': await controls.setLookAt(center.x, center.y + dist, center.z, center.x, center.y, center.z, true); break;
                case 'front': await controls.setLookAt(center.x, center.y, center.z + dist, center.x, center.y, center.z, true); break;
                case 'right': await controls.setLookAt(center.x + dist, center.y, center.z, center.x, center.y, center.z, true); break;
                case 'back': await controls.setLookAt(center.x, center.y, center.z - dist, center.x, center.y, center.z, true); break;
                case 'left': await controls.setLookAt(center.x - dist, center.y, center.z, center.x, center.y, center.z, true); break;
                case 'bottom': await controls.setLookAt(center.x, center.y - dist, center.z, center.x, center.y, center.z, true); break;
            }
        });
    });
}

// Expose IFC conversion test for debugging
(window as any).testIFC = async () => {
    try {
        logToScreen('Starting IFC conversion test...');
        const ifcLoader = components.get(OBC.IfcLoader);
        
        logToScreen('Fetching temp.ifc...');
        const file = await fetch(`${baseUrl}temp.ifc`);
        if (!file.ok) throw new Error('Failed to fetch temp.ifc');
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        
        logToScreen(`IFC loaded (Size: ${(data.length / 1024 / 1024).toFixed(2)} MB). Processing...`);
        const model = await ifcLoader.load(data, true, 'temp_model');
        
        logToScreen('IFC conversion complete!');
        let meshCount = 0;
        model.object.traverse((child: any) => {
            if (child.isMesh) meshCount++;
        });
        logToScreen(`Converted Model meshes: ${meshCount}`);
        
        world.scene.three.add(model.object);
        logToScreen('Added converted model to scene');
        
        const bbox = new THREE.Box3().setFromObject(model.object);
        const sphere = new THREE.Sphere();
        bbox.getBoundingSphere(sphere);
        world.camera.controls.fitToSphere(sphere, true);
        
    } catch (e) {
        logToScreen(`IFC Test Failed: ${e}`, true);
        console.error(e);
    }
};

// Keep Fragments engine in sync with camera for culling/LOD
world.camera.controls.addEventListener('rest', () => {
    if (fragmentsReady && fragments && fragments.core) { // Add safety check
        try {
            fragments.core.update(true);
        } catch(e) {
            // Ignore update errors if not ready
        }
    }
});

// --- Helper Functions ---
function getSpecialtyFromIfcPath(path: string): string {
    if (!path) return 'General';
    const filename = path.split('/').pop() ?? path;
    const cleanFilename = filename.split('?')[0];
    const baseName = cleanFilename.replace(/\.(ifc|frag)$/i, '');
    const parts = baseName.split('_');
    const raw = (parts[3] ?? '').trim();

    if (!raw) return 'General';

    const normalized = raw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    if (normalized === 'desagues') return 'Desagües';
    return raw;
}

const loadedModels = new Map<string, any>();

function logToScreen(msg: string, isError = false) {
    const debugEl = document.getElementById('debug-console');
    if (debugEl) {
        const line = document.createElement('div');
        line.textContent = `> ${msg}`;
        if (isError) line.style.color = '#ff4444';
        debugEl.appendChild(line);
        debugEl.scrollTop = debugEl.scrollHeight;
    }
    if (isError) console.error(msg);
    else console.log(msg);
}

// Update Classification UI
async function updateClassificationUI() {
    const classificationList = document.getElementById('classification-list');
    if (!classificationList) return;

    console.log('Actualizando UI de clasificación...');
    const systems = classifier.list;
    console.log('Sistemas encontrados:', systems);
    const systemNames = Object.keys(systems);
    
    classificationList.innerHTML = '';

    if (systemNames.length === 0) {
        console.log('No se encontraron sistemas de clasificación.');
        classificationList.innerHTML = '<div style="padding: 10px; color: #888; font-style: italic;">Carga un modelo para ver la clasificación...</div>';
        return;
    }

    for (const systemName of systemNames) {
        const systemGroups = systems[systemName];
        
        const systemDiv = document.createElement('div');
        systemDiv.className = 'folder-group';

        const header = document.createElement('div');
        header.className = 'folder-header';
        header.innerHTML = `<span><i class="fa-solid fa-tags"></i> ${systemName}</span> <i class="fa-solid fa-chevron-down"></i>`;
        
        const itemsList = document.createElement('ul');
        itemsList.className = 'folder-items';
        
        header.addEventListener('click', () => {
            const isCollapsed = itemsList.classList.contains('collapsed');
            if (isCollapsed) {
                itemsList.classList.remove('collapsed');
                const icon = header.querySelector('.fa-chevron-right');
                if(icon) icon.classList.replace('fa-chevron-right', 'fa-chevron-down');
            } else {
                itemsList.classList.add('collapsed');
                const icon = header.querySelector('.fa-chevron-down');
                if(icon) icon.classList.replace('fa-chevron-down', 'fa-chevron-right');
            }
        });

        systemDiv.appendChild(header);
        systemDiv.appendChild(itemsList);
        classificationList.appendChild(systemDiv);

        const groupNames = Object.keys(systemGroups).sort();

        for (const groupName of groupNames) {
             const groupItem = document.createElement('li');
             groupItem.className = 'model-item';
             
             groupItem.style.display = 'flex';
             groupItem.style.justifyContent = 'space-between';
             groupItem.style.alignItems = 'center';
             
             const nameSpan = document.createElement('span');
             nameSpan.innerHTML = `<i class="fa-solid fa-box"></i> ${groupName}`;
             nameSpan.style.cursor = 'pointer';
             nameSpan.style.width = '100%';
             
             nameSpan.addEventListener('click', async (e) => {
                 e.stopPropagation();
                 document.querySelectorAll('.model-item span').forEach(el => (el as HTMLElement).style.fontWeight = 'normal');
                 nameSpan.style.fontWeight = 'bold';

                 const fragmentIdMap = systemGroups[groupName];
                 highlighter.clear('select');
                 highlighter.highlightByID('select', fragmentIdMap);
             });
             
             groupItem.appendChild(nameSpan);
             itemsList.appendChild(groupItem);
        }
    }
}

// --- Model Loading Logic ---

async function loadModel(url: string, path: string) {
    try {
        // Wait for init to complete if it hasn't
        if (!fragmentsReady) {
            console.warn('loadModel called before fragments ready');
            return;
        }

        logToScreen(`Fetching Fragment: ${url}`);
        const file = await fetch(url);
        if (!file.ok) throw new Error(`Failed to fetch ${url}`);

        const buffer = await file.arrayBuffer();
        logToScreen(`Loading Fragments... (Size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);

        const model = await fragments.core.load(buffer, { modelId: path });
        (model as any).name = path.split('/').pop() || 'Model';

        model.useCamera(world.camera.three);
        world.scene.three.add(model.object);

        await fragments.core.update(true);
        loadedModels.set(path, model);
        
        console.log('Clasificando modelo:', model);
        await classifier.byEntity(model);
        await classifier.byPredefinedType(model);
        await updateClassificationUI();
        
        logToScreen('Model loaded successfully as Fragments');

        // Center camera if first model
        if (loadedModels.size === 1) {
             const bbox = new THREE.Box3().setFromObject(model.object);
             const sphere = new THREE.Sphere();
             bbox.getBoundingSphere(sphere);
             if (sphere.radius > 0.1) {
                 world.camera.controls.fitToSphere(sphere, true);
             }
        }
        
        return model;
    } catch (error) {
        logToScreen(`Error loading model: ${error}`, true);
        throw error;
    }
}

// --- Sidebar Logic ---

function initSidebar() {
    try {
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('sidebar-toggle');
        const resizer = document.getElementById('sidebar-resizer');

        if (toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', () => {
                const isClosed = sidebar.classList.toggle('closed');
                document.body.classList.toggle('sidebar-closed', isClosed);
            });
        }

        if (resizer && sidebar) {
            let isResizing = false;
            
            resizer.addEventListener('mousedown', (e) => {
                isResizing = true;
                resizer.classList.add('resizing');
                document.body.style.cursor = 'ew-resize';
                e.preventDefault();
            });
            
            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                const newWidth = e.clientX;
                if (newWidth > 200 && newWidth < 800) {
                    sidebar.style.width = `${newWidth}px`;
                }
            });
            
            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    resizer.classList.remove('resizing');
                    document.body.style.cursor = 'default';
                }
            });
        }
        
        const fileInput = document.getElementById('file-input') as HTMLInputElement;
        if (fileInput) {
            fileInput.addEventListener('change', async (event) => {
                const target = event.target as HTMLInputElement;
                if (target.files && target.files.length > 0) {
                    const overlay = document.getElementById('loading-overlay');
                    if (overlay) overlay.style.display = 'flex';

                    const file = target.files[0];
                    const buffer = await file.arrayBuffer();
                    
                    try {
                        if (!fragmentsReady) {
                             alert('El sistema aún no está listo. Por favor espere.');
                             return;
                        }

                        if (file.name.toLowerCase().endsWith('.frag')) {
                            logToScreen(`Loading fragments: ${file.name}...`);
                            const model = await fragments.core.load(buffer, { modelId: file.name });
                            model.useCamera(world.camera.three);
                            world.scene.three.add(model.object);
                            await fragments.core.update(true);
                            
                            await classifier.byEntity(model);
                            await classifier.byPredefinedType(model);
                            await updateClassificationUI();

                            const bbox = new THREE.Box3().setFromObject(model.object);
                            const sphere = new THREE.Sphere();
                            bbox.getBoundingSphere(sphere);
                            world.camera.controls.fitToSphere(sphere, true);
                        } else {
                            logToScreen(`Loading and converting IFC: ${file.name}...`);
                            const data = new Uint8Array(buffer);
                            const ifcLoader = components.get(OBC.IfcLoader);
                            
                            const model = await ifcLoader.load(data, true, file.name);
                            world.scene.three.add(model.object);
                            
                            await classifier.byEntity(model);
                            await classifier.byPredefinedType(model);
                            await updateClassificationUI();
                            
                            const bbox = new THREE.Box3().setFromObject(model.object);
                            const sphere = new THREE.Sphere();
                            bbox.getBoundingSphere(sphere);
                            world.camera.controls.fitToSphere(sphere, true);
                            
                            // AUTO EXPORT AND DOWNLOAD
                            logToScreen('Exporting to .frag...');
                            try {
                                 // @ts-ignore
                                 const savedData = model._save ? await model._save() : null;
                                 if (savedData) {
                                     const blob = new Blob([savedData as any], { type: 'application/octet-stream' });
                                     const url = URL.createObjectURL(blob);
                                     const a = document.createElement('a');
                                     a.href = url;
                                     a.download = file.name.replace(/\.ifc$/i, '') + '.frag';
                                     document.body.appendChild(a);
                                     a.click();
                                     document.body.removeChild(a);
                                     URL.revokeObjectURL(url);
                                     logToScreen('Converted file downloaded automatically!');
                                 }
                            } catch (exportErr) {
                                 logToScreen(`Export error: ${exportErr}`, true);
                            }
                        }
                    } catch (e) {
                        logToScreen(`Error loading file: ${e}`, true);
                        alert(`Error loading file: ${e}`);
                    } finally {
                        if (overlay) overlay.style.display = 'none';
                    }
                    target.value = '';
                }
            });
        }
    } catch (e) {
        console.error('Error in initSidebar:', e);
    }
}

function initTheme() {
    try {
        const themeBtn = document.getElementById('theme-toggle');
        const icon = themeBtn?.querySelector('i');
        const logoImg = document.getElementById('logo-img') as HTMLImageElement;
        
        const savedTheme = localStorage.getItem('theme');
        const isDark = savedTheme === 'dark';
        
        const updateThemeUI = (dark: boolean) => {
            if (dark) {
                document.body.classList.add('dark-mode');
                if(icon) icon.className = 'fa-solid fa-sun';
                if(logoImg) logoImg.src = 'https://i.postimg.cc/0yDgcyBp/Logo-transparente-blanco.png';
                if (world && world.scene && world.scene.three) {
                     world.scene.three.background = new THREE.Color(0x1e1e1e); 
                }
            } else {
                document.body.classList.remove('dark-mode');
                if(icon) icon.className = 'fa-solid fa-moon';
                if(logoImg) logoImg.src = 'https://i.postimg.cc/GmWLmfZZ/Logo-transparente-negro.png';
                if (world && world.scene && world.scene.three) {
                     world.scene.three.background = new THREE.Color(0xf5f5f5); 
                }
            }
        };

        updateThemeUI(isDark);

        themeBtn?.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const currentDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('theme', currentDark ? 'dark' : 'light');
            updateThemeUI(currentDark);
        });
    } catch (e) {
        console.error('Error in initTheme:', e);
    }
}

function initProjectionToggle() {
    try {
        const btn = document.getElementById('projection-toggle');
        if (!btn) return;

        const labelSpan = btn.querySelector('span');

        const updateUI = () => {
            const current = (world.camera as any).projection?.current as string | undefined;
            const isOrtho = current === 'Orthographic';
            btn.classList.toggle('active', isOrtho);
            if (labelSpan) {
                labelSpan.textContent = isOrtho ? 'Orto' : 'Persp';
            }
        };

        updateUI();

        btn.addEventListener('click', () => {
            const projectionApi = (world.camera as any).projection;
            if (!projectionApi || typeof projectionApi.set !== 'function') return;

            const current = projectionApi.current as string;
            const next = current === 'Orthographic' ? 'Perspective' : 'Orthographic';

            projectionApi.set(next);

            const rendererAny: any = world.renderer as any;
            if (rendererAny?.postproduction?.updateCamera) {
                rendererAny.postproduction.updateCamera();
            }

            updateUI();
        });
    } catch (e) {
        console.error('Error in initProjectionToggle:', e);
    }
}

function initClipperTool() {
    try {
        const btn = document.getElementById('clipper-toggle');
        const controls = document.getElementById('clipper-controls');
        const viewer = document.getElementById('viewer-container');
        if (!btn || !viewer) return;

        const updateUI = () => {
            const active = clipper.enabled;
            btn.classList.toggle('active', active);
            if (controls) controls.style.display = active ? 'flex' : 'none';
        };

        updateUI();

        btn.addEventListener('click', () => {
            clipper.enabled = !clipper.enabled;
            updateUI();
        });

        viewer.addEventListener('dblclick', () => {
            if (clipper.enabled) {
                clipper.create(world);
            }
        });

        window.addEventListener('keydown', (event) => {
            if (event.code === 'Delete' || event.code === 'Backspace') {
                clipper.delete(world);
            }
        });

        const deleteAllBtn = document.getElementById('clipper-delete-all');
        if (deleteAllBtn) {
            deleteAllBtn.addEventListener('click', () => {
                clipper.deleteAll();
            });
        }

        const planeBtns = document.querySelectorAll('.clipper-plane-btn');
        planeBtns.forEach(pBtn => {
            pBtn.addEventListener('click', () => {
                if (!clipper.enabled) return;
                
                const axis = pBtn.getAttribute('data-axis');
                const center = getModelCenter();
                const normal = new THREE.Vector3();
                
                if (axis === 'x') normal.set(-1, 0, 0);
                else if (axis === 'y') normal.set(0, -1, 0);
                else if (axis === 'z') normal.set(0, 0, -1);
                
                clipper.createFromNormalAndCoplanarPoint(world, normal, center);
            });
        });
    } catch (e) {
        console.error('Error in initClipperTool:', e);
    }
}

function initGridToggle() {
    const btn = document.getElementById('grid-toggle');
    if (!btn) return;

    btn.addEventListener('click', () => {
        const grid = grids.list.get(world.uuid);
        if (grid) {
            grid.visible = !grid.visible;
            btn.classList.toggle('active', grid.visible);
        }
    });
}

// Load models from JSON and populate sidebar
async function loadModelList() {
    const listContainer = document.getElementById('model-list');
    if (!listContainer) return;

    try {
        if (!fragmentsReady) {
             // Should not happen if called from initApp
             console.warn('loadModelList called before fragments ready');
        }

        const modelsUrl = `${baseUrl}models.json?t=${Date.now()}`;
        
        const response = await fetch(modelsUrl);
        if (!response.ok) throw new Error(`Failed to load models list (${response.status})`);
        
        const models = await response.json();
        logToScreen(`Models list loaded: ${models.length} models found`);

        const groups: Record<string, any[]> = {};
        models.forEach((m: { name: string; path: string; folder?: string }) => {
            const specialty = getSpecialtyFromIfcPath(m.path) || m.folder || 'General';
            if (!groups[specialty]) groups[specialty] = [];
            groups[specialty].push(m);
        });

        listContainer.innerHTML = '';

        for (const [folder, items] of Object.entries(groups)) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'folder-group';

            const header = document.createElement('div');
            header.className = 'folder-header';
            header.innerHTML = `<span><i class="fa-regular fa-folder-open"></i> ${folder}</span> <i class="fa-solid fa-chevron-down"></i>`;
            
            const itemsList = document.createElement('ul');
            itemsList.className = 'folder-items'; 
            
            header.addEventListener('click', () => {
                const isCollapsed = itemsList.classList.contains('collapsed');
                if (isCollapsed) {
                    itemsList.classList.remove('collapsed');
                    header.querySelector('.fa-chevron-right')?.classList.replace('fa-chevron-right', 'fa-chevron-down');
                    header.querySelector('.fa-folder')?.classList.replace('fa-folder', 'fa-folder-open');
                } else {
                    itemsList.classList.add('collapsed');
                    header.querySelector('.fa-chevron-down')?.classList.replace('fa-chevron-down', 'fa-chevron-right');
                    header.querySelector('.fa-folder-open')?.classList.replace('fa-folder-open', 'fa-folder');
                }
            });

            items.forEach((m) => {
                const li = document.createElement('li');
                li.className = 'model-item';
                li.dataset.path = m.path;

                li.innerHTML = `
                    <div class="model-name"><i class="fa-solid fa-cube"></i> ${m.name}</div>
                    <div class="visibility-toggle" title="Toggle Visibility">
                        <i class="fa-regular fa-eye-slash"></i>
                    </div>
                `;

                li.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await toggleModel(m.path, baseUrl, li);
                });

                itemsList.appendChild(li);
            });

            groupDiv.appendChild(header);
            groupDiv.appendChild(itemsList);
            listContainer.appendChild(groupDiv);
        }

    } catch (err) {
        logToScreen(`Error loading model list: ${err}`, true);
    }
}

async function toggleModel(path: string, baseUrl: string, liElement: HTMLElement) {
    const toggleIcon = liElement.querySelector('.visibility-toggle i');
    
    if (loadedModels.has(path)) {
        const model = loadedModels.get(path);
        const newVisible = !model.object.visible;
        model.object.visible = newVisible;
        
        if (newVisible) {
            liElement.classList.add('visible');
            toggleIcon?.classList.replace('fa-eye-slash', 'fa-eye');
        } else {
            liElement.classList.remove('visible');
            toggleIcon?.classList.replace('fa-eye', 'fa-eye-slash');
        }
        return;
    }

    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';
    
    try {
        const encodedPath = path.split('/').map(part => encodeURIComponent(part)).join('/');
        const fullPath = `${baseUrl}${encodedPath}`;
        
        await loadModel(fullPath, path);
        
        liElement.classList.add('visible');
        toggleIcon?.classList.replace('fa-eye-slash', 'fa-eye');
        
    } catch (error) {
        alert('Error downloading model: ' + (error as Error).message);
    } finally {
        if (overlay) overlay.style.display = 'none';
    }
}

// --- Tabs Logic ---
function initTabs() {
    try {
        const tabs = document.querySelectorAll('.tab-btn');
        const contents = document.querySelectorAll('.tab-content');

        if (tabs.length === 0) {
            console.warn('No tabs found');
            return;
        }

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                contents.forEach(c => c.classList.remove('active'));
                
                const targetId = tab.getAttribute('data-target');
                if (targetId) {
                    const targetContent = document.getElementById(targetId);
                    if (targetContent) {
                        targetContent.classList.add('active');
                    }
                }
            });
        });
    } catch (e) {
        console.error('Error in initTabs:', e);
    }
}

// --- Properties Panel ---
function initPropertiesPanel() {
    try {
        const propertiesPanel = document.getElementById('properties-panel');
        const propertiesToggle = document.getElementById('properties-toggle');
        const propertiesContent = document.getElementById('properties-content');
        const resizer = document.getElementById('properties-resizer');

        if (propertiesToggle && propertiesPanel) {
            // Remove existing listeners to avoid duplicates if called multiple times
            const newToggle = propertiesToggle.cloneNode(true);
            propertiesToggle.parentNode?.replaceChild(newToggle, propertiesToggle);
            
            newToggle.addEventListener('click', () => {
                const isOpen = propertiesPanel.classList.toggle('open');
                document.body.classList.toggle('properties-open', isOpen);
                (newToggle as HTMLElement).classList.toggle('active', isOpen);
            });
        }

        // Resizing logic for properties panel
        if (resizer && propertiesPanel) {
            let isResizing = false;
            
            resizer.addEventListener('mousedown', (e) => {
                isResizing = true;
                resizer.classList.add('resizing');
                document.body.style.cursor = 'ew-resize';
                e.preventDefault();
            });
            
            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                const windowWidth = window.innerWidth;
                const newWidth = windowWidth - e.clientX;
                if (newWidth > 250 && newWidth < 600) {
                    propertiesPanel.style.width = `${newWidth}px`;
                }
            });
            
            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    resizer.classList.remove('resizing');
                    document.body.style.cursor = 'default';
                }
            });
        }
    } catch(e) {
        console.error('Error initPropertiesPanel', e);
    }
}

function initPropertiesEvents() {
    try {
        const propertiesPanel = document.getElementById('properties-panel');
        const propertiesToggle = document.getElementById('properties-toggle');
        const propertiesContent = document.getElementById('properties-content');

        if (highlighter && propertiesContent) {
             highlighter.events.select.onHighlight.add(async (fragmentMap) => {
                propertiesContent.innerHTML = '';
                
                const fragmentId = Object.keys(fragmentMap)[0];
                const expressID = [...fragmentMap[fragmentId]][0];
                
                propertiesContent.innerHTML = `
                    <div style="padding:10px;">
                        <h4>Elemento Seleccionado</h4>
                        <p><strong>Fragment ID:</strong> ${fragmentId}</p>
                        <p><strong>Express ID:</strong> ${expressID}</p>
                    </div>
                `;
                
                if (propertiesPanel && !propertiesPanel.classList.contains('open')) {
                     propertiesPanel.classList.add('open');
                     document.body.classList.add('properties-open');
                     propertiesToggle?.classList.add('active');
                }
            });
            
            highlighter.events.select.onClear.add(() => {
                if (propertiesContent) {
                     propertiesContent.innerHTML = '<div class="no-selection">Selecciona un elemento para ver sus propiedades</div>';
                }
            });
        }
    } catch(e) {
        console.error('Error initPropertiesEvents', e);
    }
}

function initFitModelTool() {
    const btn = document.getElementById('fit-model-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        const box = getModelBox();
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        
        if (sphere.radius > 0.1) {
             world.camera.controls.fitToSphere(sphere, true);
        } else {
             alert('No se pudo encontrar el modelo para ajustar. Intenta recargar.');
        }
    });
}

function getModelBox() {
    const boxer = components.get(OBC.BoundingBoxer);
    boxer.list.clear();
    boxer.addFromModels();
    let box = boxer.get();
    boxer.list.clear();

    if (box.isEmpty()) {
        box = new THREE.Box3();
        world.scene.three.traverse((child: any) => {
             if (child.isMesh && child.visible) {
                 box.expandByObject(child);
             }
        });
    }
    return box;
}

function getModelCenter(): THREE.Vector3 {
    const box = getModelBox();
    if (box.isEmpty()) return new THREE.Vector3(0,0,0);
    const center = new THREE.Vector3();
    box.getCenter(center);
    return center;
}


