import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
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

// Grids
const grids = components.get(OBC.Grids);
grids.create(world);

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
            
            // Calculate new width based on mouse position from right edge
            const newWidth = window.innerWidth - e.clientX;
            
            if (newWidth > 200 && newWidth < 800) { // Min 200px, Max 800px
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

highlighter.events.select.onHighlight.add((fragmentIdMap) => {
    updatePropertiesPanel(fragmentIdMap);
});

highlighter.events.select.onClear.add(() => {
    updatePropertiesPanel({});
});

async function updatePropertiesPanel(fragmentIdMap: Record<string, Set<number>>) {
    const content = document.getElementById('properties-content');
    if (!content) return;

    content.innerHTML = '';

    const fragmentId = Object.keys(fragmentIdMap)[0];
    if (!fragmentId) {
        content.innerHTML = '<div class="no-selection">Selecciona un elemento para ver sus propiedades</div>';
        return;
    }

    const expressIds = fragmentIdMap[fragmentId];
    if (!expressIds || expressIds.size === 0) return;

    const expressId = Array.from(expressIds)[0]; // Just show first selected
    const model = fragments.list.get(fragmentId);
    
    if (!model) return;

    try {
        const properties = await (model as any).getProperties(expressId);
        
        if (!properties) {
             content.innerHTML = '<div class="no-selection">No se encontraron propiedades</div>';
             return;
        }

        const renderGroup = (title: string, props: any) => {
             const group = document.createElement('div');
             group.className = 'property-group';
             
             const header = document.createElement('div');
             header.className = 'property-group-header';
             header.textContent = title;
             group.appendChild(header);

             let hasProps = false;
             for (const key in props) {
                 const val = props[key];
                 if (val === null || val === undefined || typeof val === 'object' || key === 'type') continue;
                 
                 hasProps = true;
                 const row = document.createElement('div');
                 row.className = 'property-row';
                 
                 const nameDiv = document.createElement('div');
                 nameDiv.className = 'property-name';
                 nameDiv.textContent = key;
                 
                 const valDiv = document.createElement('div');
                 valDiv.className = 'property-value';
                 valDiv.textContent = String(val);

                 row.appendChild(nameDiv);
                 row.appendChild(valDiv);
                 group.appendChild(row);
             }

             if (hasProps) content.appendChild(group);
        };

        renderGroup('Información General', {
            'GlobalId': properties.GlobalId?.value || properties.GlobalId,
            'Name': properties.Name?.value || properties.Name,
            'Description': properties.Description?.value || properties.Description,
            'ObjectType': properties.ObjectType?.value || properties.ObjectType,
            'Tag': properties.Tag?.value || properties.Tag
        });
        
        // Render all other properties that are simple values
        const otherProps: any = {};
        for(const key in properties) {
            if(['GlobalId', 'Name', 'Description', 'ObjectType', 'Tag', 'type', 'expressID'].includes(key)) continue;
            const val = properties[key];
            if (val && typeof val === 'object' && val.value !== undefined) {
                 otherProps[key] = val.value;
            } else if (val && typeof val !== 'object') {
                 otherProps[key] = val;
            }
        }
        if (Object.keys(otherProps).length > 0) {
            renderGroup('Otros Atributos', otherProps);
        }

    } catch (e) {
        console.error("Error getting properties", e);
        content.innerHTML = '<div class="no-selection">Error al leer propiedades</div>';
    }
}

function initPropertiesPanel() {
    const panel = document.getElementById('properties-panel');
    const toggleBtn = document.getElementById('properties-toggle');
    const resizer = document.getElementById('properties-resizer');
    
    if (toggleBtn && panel) {
        toggleBtn.addEventListener('click', () => {
            panel.classList.toggle('closed');
        });
    }

    if (resizer && panel) {
        let isResizing = false;
        
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            resizer.classList.add('resizing');
            document.body.style.cursor = 'ew-resize';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth > 200 && newWidth < 800) {
                panel.style.width = `${newWidth}px`;
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
}

