import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import * as BUI from '@thatopen/ui';
import './style.css';

// --- Initialization of That Open Engine ---

const components = new OBC.Components();
const worlds = components.get(OBC.Worlds);

const world = worlds.create<
  OBC.SimpleScene,
  OBC.OrthoPerspectiveCamera,
  OBC.SimpleRenderer
>();

world.scene = new OBC.SimpleScene(components);
world.scene.setup();
world.scene.three.background = new THREE.Color(0x202020); // Dark gray

const container = document.getElementById('viewer-container') as HTMLElement;
world.renderer = new OBC.SimpleRenderer(components, container);
world.camera = new OBC.OrthoPerspectiveCamera(components);

components.init();
BUI.Manager.init();

// Grids
const grids = components.get(OBC.Grids);
grids.create(world);

// Indexer for Relations - Removed as it's not available in this version
// const indexer = components.get(OBC.IfcRelationsIndexer);

// --- IFC & Fragments Setup ---

const fragments = components.get(OBC.FragmentsManager);
const baseUrl = import.meta.env.BASE_URL || './';

// Initialize fragments with the worker
fragments.init(`${baseUrl}fragments/fragments.mjs`);

// Initialize IfcLoader once
const ifcLoader = components.get(OBC.IfcLoader);
ifcLoader.setup({
    wasm: {
        path: `${baseUrl}wasm/`,
        absolute: true
    }
});

// Expose IFC conversion test for debugging
(window as any).testIFC = async () => {
    try {
        logToScreen('Starting IFC conversion test...');
        const ifcLoader = components.get(OBC.IfcLoader);
        // Setup is done globally, but ensure it's ready
        
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
        
        // Center camera on it
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
    fragments.core.update(true);
});

// --- Helper Functions ---
function getSpecialtyFromIfcPath(path: string): string {
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

// Configure Fragments Manager (Culling, etc.)
// Offload heavy tasks to worker if possible (FragmentsManager has internal workers for geometry)
// Note: We are not setting up a separate Fragments worker URL here as we are loading IFCs directly mostly,
// but if we were loading .frag files we would need it. 
// However, the tutorial mentions initializing FragmentsManager with a worker.
// Since we are primarily loading IFCs which *become* fragments, the IfcLoader handles the conversion.

// Enable culling for performance
// const culler = components.get(OBC.Cullers).create(world);
// culler.threshold = 10; // Threshold for culling

// world.camera.controls.addEventListener('sleep', () => {
//    culler.needsUpdate = true;
// });

// Track loaded models
// Key: path, Value: FragmentsGroup (the model)
const loadedModels = new Map<string, any>();

// Helper to log to screen
function logToScreen(msg: string, isError = false) {
    const debugEl = document.getElementById('debug-console');
    if (debugEl) {
        // debugEl.style.display = 'block'; // Removed to keep it hidden by default
        const line = document.createElement('div');
        line.textContent = `> ${msg}`;
        if (isError) line.style.color = '#ff4444';
        debugEl.appendChild(line);
        debugEl.scrollTop = debugEl.scrollHeight;
    }
    if (isError) console.error(msg);
    else console.log(msg);
}

// --- Model Loading Logic ---

async function loadModel(url: string, path: string) {
    try {
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
        
        // try {
        //    await indexer.process(model);
        // } catch (err) {
        //    logToScreen(`Indexer error: ${err}`, true);
        // }

        loadedModels.set(path, model);
        
        logToScreen('Model loaded successfully as Fragments');

        let meshCount = 0;
        model.object.traverse((child: any) => {
            if (child.isMesh) meshCount++;
        });
        logToScreen(`Model meshes: ${meshCount}`);

        setTimeout(async () => {
            try {
                const ids = await model.getItemsIdsWithGeometry();
                logToScreen(`Deferred check - items with geometry: ${ids.length}`);
                let delayedMeshes = 0;
                model.object.traverse((child: any) => {
                    if (child.isMesh) delayedMeshes++;
                });
                logToScreen(`Deferred check - meshes in scene: ${delayedMeshes}`);
            } catch (e) {
                logToScreen(`Deferred geometry check failed: ${e}`, true);
            }
        }, 5000);

        // Auto-center camera if it's the first model
        if (loadedModels.size === 1) {
             const bbox = new THREE.Box3().setFromObject(model.object);
             const sphere = new THREE.Sphere();
             bbox.getBoundingSphere(sphere);
             
             logToScreen(`BBox: min(${bbox.min.x.toFixed(2)}, ${bbox.min.y.toFixed(2)}, ${bbox.min.z.toFixed(2)}) max(${bbox.max.x.toFixed(2)}, ${bbox.max.y.toFixed(2)}, ${bbox.max.z.toFixed(2)}) Radius: ${sphere.radius.toFixed(2)}`);

             if (sphere.radius > 0.1) {
                 world.camera.controls.fitToSphere(sphere, true);
                 logToScreen('Camera centered on model');
             } else {
                 logToScreen('Model bounds too small or empty - Camera not moved', true);
             }
        }
        
        return model;
    } catch (error) {
        logToScreen(`Error loading model: ${error}`, true);
        throw error;
    }
}

// --- Sidebar Logic (Kept mostly same, updated for new loading) ---

function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const resizer = document.getElementById('sidebar-resizer');

    // Toggle Logic usando solo el botón de hamburguesa
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            const isClosed = sidebar.classList.toggle('closed');
            document.body.classList.toggle('sidebar-closed', isClosed);
        });
    }

    // Resize Logic
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
    
    // Setup file upload
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) {
        fileInput.addEventListener('change', async (event) => {
            const target = event.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                const file = target.files[0];
                const buffer = await file.arrayBuffer();
                
                try {
                    if (file.name.toLowerCase().endsWith('.frag')) {
                        logToScreen(`Loading fragments: ${file.name}...`);
                        const model = await fragments.core.load(buffer, { modelId: file.name });
                        model.useCamera(world.camera.three);
                        world.scene.three.add(model.object);
                        await fragments.core.update(true);
                        
                        const bbox = new THREE.Box3().setFromObject(model.object);
                        const sphere = new THREE.Sphere();
                        bbox.getBoundingSphere(sphere);
                        world.camera.controls.fitToSphere(sphere, true);
                        logToScreen(`Loaded .frag: ${file.name}`);
                    } else {
                        // Assume IFC
                        logToScreen(`Loading and converting IFC: ${file.name}...`);
                        const data = new Uint8Array(buffer);
                        
                        // IfcLoader is already setup globally
                        const ifcLoader = components.get(OBC.IfcLoader);
                        // Optional: Ensure WASM path is correct if setup failed previously
                        // await ifcLoader.setup({ wasm: { path: `${baseUrl}wasm/`, absolute: true } });
                        
                        const model = await ifcLoader.load(data, true, file.name);
                        world.scene.three.add(model.object);
                        
                        // Center camera
                        const bbox = new THREE.Box3().setFromObject(model.object);
                        const sphere = new THREE.Sphere();
                        bbox.getBoundingSphere(sphere);
                        world.camera.controls.fitToSphere(sphere, true);
                        
                        logToScreen(`Loaded IFC: ${file.name}`);
                        
                        // AUTO EXPORT AND DOWNLOAD
                        logToScreen('Exporting to .frag...');
                        try {
                             // Try saving using internal method if public one is missing
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
                             } else {
                                 logToScreen('Export failed: Save method not found on model', true);
                             }
                        } catch (exportErr) {
                             logToScreen(`Export error: ${exportErr}`, true);
                        }
                    }
                } catch (e) {
                    logToScreen(`Error loading file: ${e}`, true);
                }
                
                // Reset input
                target.value = '';
            }
        });
    }
}

function initTheme() {
    const themeBtn = document.getElementById('theme-toggle');
    const icon = themeBtn?.querySelector('i');
    const logoImg = document.getElementById('logo-img') as HTMLImageElement;
    
    // Default to Light (false)
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

    // Initial set
    updateThemeUI(isDark);

    themeBtn?.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        // Force re-check of class because toggle returns boolean
        // But we want to be explicit
        const currentDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', currentDark ? 'dark' : 'light');
        updateThemeUI(currentDark);
    });
}

function initProjectionToggle() {
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
}




// Load models from JSON and populate sidebar
async function loadModelList() {
    const listContainer = document.getElementById('model-list');
    if (!listContainer) {
        return;
    }

    try {
        const modelsUrl = `${baseUrl}models.json?t=${Date.now()}`;
        
        const response = await fetch(modelsUrl);
        if (!response.ok) throw new Error(`Failed to load models list (${response.status})`);
        
        const models = await response.json();
        logToScreen(`Models list loaded: ${models.length} models found`);

        // Group models by specialty
        const groups: Record<string, any[]> = {};
        models.forEach((m: { name: string; path: string; folder?: string }) => {
            const specialty = getSpecialtyFromIfcPath(m.path) || m.folder || 'General';
            if (!groups[specialty]) groups[specialty] = [];
            groups[specialty].push(m);
        });

        // Clear container
        listContainer.innerHTML = '';

        for (const [folder, items] of Object.entries(groups)) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'folder-group';

            const header = document.createElement('div');
            header.className = 'folder-header';
            header.innerHTML = `<span><i class="fa-regular fa-folder-open"></i> ${folder}</span> <i class="fa-solid fa-chevron-down"></i>`;
            
            const itemsList = document.createElement('ul');
            itemsList.className = 'folder-items'; // Open by default
            
            // Toggle logic
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

                // Structure: Name + Visibility Toggle
                li.innerHTML = `
                    <div class="model-name"><i class="fa-solid fa-cube"></i> ${m.name}</div>
                    <div class="visibility-toggle" title="Toggle Visibility">
                        <i class="fa-regular fa-eye-slash"></i>
                    </div>
                `;

                // Handle click on the whole item or specific toggle
                li.addEventListener('click', async (e) => {
                    // Prevent propagation if clicking nested elements
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
    
    // Check if already loaded
    if (loadedModels.has(path)) {
        const model = loadedModels.get(path);
        
        // Toggle visibility
        const newVisible = !model.object.visible;
        model.object.visible = newVisible;
        
        // Also update culler
        if(newVisible) {
             // culler.add(model.mesh);
        } else {
            // There isn't a direct remove from culler in simple API sometimes, 
            // but hiding the mesh handles it visually. 
            // Culler updates based on scene visibility usually.
        }
        // culler.needsUpdate = true;
        
        // Update UI
        if (newVisible) {
            liElement.classList.add('visible');
            toggleIcon?.classList.replace('fa-eye-slash', 'fa-eye');
        } else {
            liElement.classList.remove('visible');
            toggleIcon?.classList.replace('fa-eye', 'fa-eye-slash');
        }
        
        logToScreen(`Toggled model visibility: ${path} -> ${newVisible}`);
        return;
    }

    // Not loaded, load it
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';
    
    try {
        // Encode path parts to handle spaces
        const encodedPath = path.split('/').map(part => encodeURIComponent(part)).join('/');
        const fullPath = `${baseUrl}${encodedPath}`;
        
        await loadModel(fullPath, path);
        
        // Update UI to loaded/visible state
        liElement.classList.add('visible');
        toggleIcon?.classList.replace('fa-eye-slash', 'fa-eye');
        
    } catch (error) {
        alert('Error downloading model: ' + (error as Error).message);
    } finally {
        if (overlay) overlay.style.display = 'none';
    }
}

logToScreen('Initializing That Open Engine...');
initSidebar();
initTheme();
initProjectionToggle();
loadModelList();
initPropertiesPanel();

// --- View Controls & Console Toggle ---

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

// Helper to get current model center
function getModelCenter(): THREE.Vector3 {
    // If we have loaded models, calculate bounding sphere of the whole scene or last model
    // Simple approach: Use bounding box of all meshes in scene
    const box = new THREE.Box3();
    const meshes: THREE.Mesh[] = [];
    world.scene.three.traverse((child: any) => {
        if ((child as THREE.Mesh).isMesh) {
             meshes.push(child as THREE.Mesh);
        }
    });
    
    if (meshes.length === 0) return new THREE.Vector3(0, 0, 0);
    
    meshes.forEach(mesh => {
        box.expandByObject(mesh);
    });
    
    const center = new THREE.Vector3();
    box.getCenter(center);
    return center;
}

// Helper to get model size (radius)
function getModelRadius(): number {
    const box = new THREE.Box3();
    let hasMeshes = false;
    world.scene.three.traverse((child: any) => {
        if ((child as THREE.Mesh).isMesh) {
             box.expandByObject(child);
             hasMeshes = true;
        }
    });
    
    if (!hasMeshes) return 10; // Default size
    
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    return sphere.radius || 10;
}

const viewDropdownBtn = document.getElementById('view-dropdown-btn');
const viewDropdownMenu = document.getElementById('view-dropdown-menu');

if (viewDropdownBtn && viewDropdownMenu) {
    // Toggle menu
    viewDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        viewDropdownMenu.classList.toggle('show');
    });

    // Close menu when clicking outside
    document.addEventListener('click', () => {
        viewDropdownMenu.classList.remove('show');
    });
}

const viewButtons = document.querySelectorAll('.view-btn');
viewButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
        const view = btn.getAttribute('data-view');
        
        // Update Main Button Text to show selected view
        if (viewDropdownBtn) {
             const icon = btn.querySelector('i')?.cloneNode(true);
             const text = btn.textContent?.trim();
             const span = viewDropdownBtn.querySelector('span');
             if (span && icon && text) {
                 span.innerHTML = '';
                 span.appendChild(icon);
                 span.appendChild(document.createTextNode(' ' + text));
             }
        }

        const center = getModelCenter();
        const radius = getModelRadius();
        const dist = radius * 2; // Distance factor
        
        // Ensure controls are enabled
        world.camera.controls.enabled = true;

        switch (view) {
            case 'top':
                await world.camera.controls.setLookAt(center.x, center.y + dist, center.z, center.x, center.y, center.z, true);
                break;
            case 'bottom':
                await world.camera.controls.setLookAt(center.x, center.y - dist, center.z, center.x, center.y, center.z, true);
                break;
            case 'front':
                await world.camera.controls.setLookAt(center.x, center.y, center.z + dist, center.x, center.y, center.z, true);
                break;
            case 'back':
                await world.camera.controls.setLookAt(center.x, center.y, center.z - dist, center.x, center.y, center.z, true);
                break;
            case 'left':
                await world.camera.controls.setLookAt(center.x - dist, center.y, center.z, center.x, center.y, center.z, true);
                break;
            case 'right':
                await world.camera.controls.setLookAt(center.x + dist, center.y, center.z, center.x, center.y, center.z, true);
                break;
            case 'iso':
                await world.camera.controls.setLookAt(center.x + dist, center.y + dist, center.z + dist, center.x, center.y, center.z, true);
                break;
        }
    });
});



// Listener moved to initSidebar to handle both IFC and Frag files centrally

// --- Highlighter & Properties Setup ---
const highlighter = components.get(OBF.Highlighter);
highlighter.setup({ world });
highlighter.zoomToSelection = true;

highlighter.events.select.onHighlight.add(async (fragmentIdMap) => {
    for (const modelUUID in fragmentIdMap) {
        const model = fragments.list.get(modelUUID);
        if (!model) continue;

        const expressIDs = fragmentIdMap[modelUUID];
        if (expressIDs.size > 0) {
            const expressID = Array.from(expressIDs)[0];
            const data = await getFormattedProperties(model, expressID);
            renderPropertiesTable(data);
            return;
        }
    }
});

highlighter.events.select.onClear.add(() => {
    const content = document.getElementById('properties-content');
    if (content) {
        content.innerHTML = '<p class="placeholder-text">Selecciona un elemento para ver sus propiedades</p>';
    }
});

// Initialize Properties Panel
function initPropertiesPanel() {
    const propertiesPanel = document.getElementById('properties-panel');
    if (propertiesPanel) {
        propertiesPanel.innerHTML = `
            <div class="panel-header">
                <h3>Propiedades</h3>
                <button class="toggle-btn"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
            <div class="panel-content">
                <div id="properties-content">
                    <p class="placeholder-text">Selecciona un elemento para ver sus propiedades</p>
                </div>
            </div>
        `;

        const toggleBtn = propertiesPanel.querySelector('.toggle-btn');
        const content = propertiesPanel.querySelector('.panel-content');
        
        if (toggleBtn && content) {
            toggleBtn.addEventListener('click', () => {
                propertiesPanel.classList.toggle('collapsed');
                const icon = toggleBtn.querySelector('i');
                if (propertiesPanel.classList.contains('collapsed')) {
                    icon?.classList.replace('fa-chevron-right', 'fa-chevron-left');
                } else {
                    icon?.classList.replace('fa-chevron-left', 'fa-chevron-right');
                }
            });
        }
    }
}



// Custom function to fetch and format properties
async function getFormattedProperties(model: any, expressID: number) {
    const result: Array<{ group: string, name: string, value: string }> = [];
    
    // Helper to format a value
    const formatValue = (val: any): string => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') {
            if (val.value !== undefined) return String(val.value);
            if (val.type === 1 && val.value) return val.value; // IfcLabel/Text
            return JSON.stringify(val); // Fallback
        }
        return String(val);
    };

    try {
        // Fetch the entity directly from the model
        // Note: This relies on the model having loaded properties. 
        // IfcLoader in components v3 usually loads properties into the internal web-ifc state.
        const entity = await model.getProperties(expressID);
        
        if (!entity) {
            console.warn(`No entity found for ID ${expressID}`);
            return result;
        }

        // 1. Basic Attributes
        ['Name', 'GlobalId', 'Tag', 'ObjectType', 'PredefinedType', 'Description'].forEach(key => {
            if (entity[key]) {
                result.push({
                    group: 'Attributes',
                    name: key,
                    value: formatValue(entity[key])
                });
            }
        });

        // Helper to resolve handle (recursively if needed, though usually just one level)
        const resolve = async (handle: any): Promise<any> => {
             if (!handle) return null;
             if (Array.isArray(handle)) {
                 // Return array of resolved items
                 return Promise.all(handle.map(h => resolve(h)));
             }
             if (typeof handle === 'object' && handle.type === 5 && handle.value) { // Ref
                 return await model.getProperties(handle.value);
             }
             return handle;
        };

        // 2. Relations (Psets, Materials, Type)
        // We check standard inverse attributes. 
        // If these are undefined, it means Inverse Attributes were not enabled during load.
        
        // IfcRelDefinesByProperties (Psets)
        if (entity.IsDefinedBy) {
            const definedBy = Array.isArray(entity.IsDefinedBy) ? entity.IsDefinedBy : [entity.IsDefinedBy];
            for (const relHandle of definedBy) {
                const rel = await resolve(relHandle);
                if (!rel) continue;

                if (rel.type === 'IfcRelDefinesByProperties') {
                     const pset = await resolve(rel.RelatingPropertyDefinition);
                     if (pset) {
                         if (pset.type === 'IfcPropertySet') {
                             const psetName = pset.Name?.value || 'Unknown Pset';
                             if (pset.HasProperties) {
                                 const props = Array.isArray(pset.HasProperties) ? pset.HasProperties : [pset.HasProperties];
                                 for (const propHandle of props) {
                                     const prop = await resolve(propHandle);
                                     if (prop && prop.Name && prop.NominalValue) {
                                          result.push({
                                              group: psetName,
                                              name: prop.Name.value,
                                              value: formatValue(prop.NominalValue)
                                          });
                                     }
                                 }
                             }
                         } else if (pset.type === 'IfcElementQuantity') {
                             const qsetName = pset.Name?.value || 'Quantities';
                             if (pset.Quantities) {
                                 const quants = Array.isArray(pset.Quantities) ? pset.Quantities : [pset.Quantities];
                                 for (const qHandle of quants) {
                                     const q = await resolve(qHandle);
                                     if (q && q.Name) {
                                         let val = '';
                                         if (q.LengthValue) val = formatValue(q.LengthValue);
                                         else if (q.AreaValue) val = formatValue(q.AreaValue);
                                         else if (q.VolumeValue) val = formatValue(q.VolumeValue);
                                         else if (q.CountValue) val = formatValue(q.CountValue);
                                         else if (q.WeightValue) val = formatValue(q.WeightValue);
                                         else if (q.TimeValue) val = formatValue(q.TimeValue);
                                         
                                         if (val) {
                                             result.push({
                                                 group: qsetName,
                                                 name: q.Name.value,
                                                 value: val
                                             });
                                         }
                                     }
                                 }
                             }
                         }
                     }
                }
            }
        } else {
            // Fallback: If no inverse attributes, we can't easily find Psets from the element.
            // We might try to scan all Psets in the model, but that's expensive.
            // For now, we leave it.
            // console.log('No IsDefinedBy inverse attribute found.');
        }
        
        // Associations (Material)
        if (entity.HasAssociations) {
             const associations = Array.isArray(entity.HasAssociations) ? entity.HasAssociations : [entity.HasAssociations];
             for (const assocHandle of associations) {
                 const assoc = await resolve(assocHandle);
                 if (assoc && assoc.type === 'IfcRelAssociatesMaterial') {
                      const mat = await resolve(assoc.RelatingMaterial);
                      if (mat) {
                           // Material might be IfcMaterial, IfcMaterialLayerSetUsage, etc.
                           if (mat.Name) {
                               result.push({
                                   group: 'Material',
                                   name: 'Name',
                                   value: formatValue(mat.Name)
                               });
                           }
                           if (mat.ForLayerSet) {
                               const layerSet = await resolve(mat.ForLayerSet);
                               if (layerSet && layerSet.MaterialLayers) {
                                   const layers = Array.isArray(layerSet.MaterialLayers) ? layerSet.MaterialLayers : [layerSet.MaterialLayers];
                                   for (const layerHandle of layers) {
                                       const layer = await resolve(layerHandle);
                                       if (layer && layer.Material) {
                                           const m = await resolve(layer.Material);
                                            if (m && m.Name) {
                                                result.push({
                                                    group: 'Material Layer',
                                                    name: 'Layer Material',
                                                    value: formatValue(m.Name)
                                                });
                                            }
                                       }
                                   }
                               }
                           }
                      }
                 }
             }
        }
        
        // Type
         if (entity.IsTypedBy) {
             const typedBy = Array.isArray(entity.IsTypedBy) ? entity.IsTypedBy : [entity.IsTypedBy];
             for (const relHandle of typedBy) {
                 const rel = await resolve(relHandle);
                 if (rel && rel.RelatingType) {
                      const typeEntity = await resolve(rel.RelatingType);
                      if (typeEntity) {
                           result.push({
                               group: 'Type',
                               name: 'Name',
                               value: formatValue(typeEntity.Name)
                           });
                           
                           // Type Properties (Psets on Type)
                           if (typeEntity.HasPropertySets) {
                               const psets = Array.isArray(typeEntity.HasPropertySets) ? typeEntity.HasPropertySets : [typeEntity.HasPropertySets];
                               for (const psetHandle of psets) {
                                   const pset = await resolve(psetHandle);
                                   if (pset && pset.HasProperties) {
                                        const psetName = (pset.Name?.value || 'Type Pset') + ' (Type)';
                                        const props = Array.isArray(pset.HasProperties) ? pset.HasProperties : [pset.HasProperties];
                                        for (const propHandle of props) {
                                            const prop = await resolve(propHandle);
                                            if (prop && prop.Name && prop.NominalValue) {
                                                result.push({
                                                    group: psetName,
                                                    name: prop.Name.value,
                                                    value: formatValue(prop.NominalValue)
                                                });
                                            }
                                        }
                                   }
                               }
                           }
                      }
                 }
             }
        }

    } catch (e) {
        console.error('Error fetching properties', e);
        result.push({ group: 'Error', name: 'Message', value: 'Error loading properties. See console.' });
    }
    
    return result;
}

// Function to render the table
function renderPropertiesTable(data: Array<{ group: string, name: string, value: string }>) {
    const content = document.getElementById('properties-content');
    if (!content) return;
    
    if (data.length === 0) {
        content.innerHTML = '<p class="placeholder-text">No se encontraron propiedades</p>';
        return;
    }

    let html = '<table class="properties-table"><thead><tr><th>Propiedad</th><th>Valor</th></tr></thead><tbody>';
    
    // Group by 'group'
    const grouped: Record<string, Array<{ name: string, value: string }>> = {};
    data.forEach(item => {
        if (!grouped[item.group]) grouped[item.group] = [];
        grouped[item.group].push(item);
    });
    
    for (const groupName in grouped) {
        html += `<tr class="group-header"><td colspan="2">${groupName}</td></tr>`;
        grouped[groupName].forEach(item => {
            html += `<tr><td>${item.name}</td><td>${item.value}</td></tr>`;
        });
    }
    
    html += '</tbody></table>';
    content.innerHTML = html;
}

