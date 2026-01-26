import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import * as BUI from '@thatopen/ui';
import * as CUI from '@thatopen/ui-obc';
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

// --- IFC & Fragments Setup ---

const baseUrl = import.meta.env.BASE_URL || './';
const fragments = components.get(OBC.FragmentsManager);

// Initialize fragments with the worker BEFORE getting other components
// that might depend on it (like Classifier or Hider)
await fragments.init(`${baseUrl}fragments/fragments.mjs`);

const classifier = components.get(OBC.Classifier);
const hider = components.get(OBC.Hider);
const clipper = components.get(OBC.Clipper);

// Initialize Highlighter
const highlighter = components.get(OBF.Highlighter);
highlighter.setup({
    world, // Pass the world instance to enable raycasting
    select: {
        name: 'select',
        material: new THREE.MeshBasicMaterial({ color: 0x1976d2, depthTest: false, opacity: 0.8, transparent: true })
    },
    hover: {
        name: 'hover',
        material: new THREE.MeshBasicMaterial({ color: 0xe0e0e0, depthTest: false, opacity: 0.4, transparent: true })
    }
});
highlighter.enabled = true; // Ensure it's enabled explicitly

// Add 3D Click Event for Selection
if (container) {
    container.addEventListener('click', () => {
        // Just verify highlighter is active, though it handles its own events.
        // If selection happened, properties table updates via event listener below.
        console.log('[DEBUG] 3D View clicked. Checking selection...');
    });
}

// Initialize IfcLoader once
const ifcLoader = components.get(OBC.IfcLoader);
// Use default WASM path
const wasmPath = `${baseUrl}wasm/`; 
console.log('Setting up IfcLoader with WASM path:', wasmPath);

ifcLoader.setup({
    wasm: {
        path: wasmPath,
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

let propertiesTableElement: HTMLElement | null = null;

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

        let buffer = await file.arrayBuffer();
        let data = new Uint8Array(buffer);

        logToScreen(`Fetched ${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

        // Check for GZIP signature
        const isGzip = data[0] === 0x1f && data[1] === 0x8b;
        logToScreen(`Compression: ${isGzip ? 'GZIP' : 'Uncompressed'}`);

        let model;
        try {
            // First attempt: Load directly
            model = await fragments.core.load(data, { modelId: path });
        } catch (loadErr) {
            console.warn('Direct load failed, attempting manual decompression/handling...', loadErr);
            
            // If it was GZIP and failed, maybe the internal decompressor failed. Try manual decompression.
            if (isGzip && 'DecompressionStream' in window) {
                try {
                    logToScreen('Attempting manual decompression...');
                    const ds = new DecompressionStream('gzip');
                    const writer = ds.writable.getWriter();
                    writer.write(new Uint8Array(buffer)); // Ensure Uint8Array
                    writer.close();
                    const response = new Response(ds.readable);
                    const decompressedBuffer = await response.arrayBuffer();
                    const decompressedData = new Uint8Array(decompressedBuffer);
                    logToScreen(`Decompressed size: ${(decompressedBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
                    
                    // Try loading decompressed data
                    model = await fragments.core.load(decompressedData, { modelId: path });
                } catch (decompressErr) {
                    throw new Error(`Manual decompression failed: ${decompressErr}`);
                }
            } else {
                throw loadErr; // Re-throw if we can't handle it
            }
        }

        if (!model) throw new Error('Model failed to load (undefined result)');

        (model as any).name = path.split('/').pop() || 'Model';

        // FORCE UUID to match the path (which is the key in fragments.list)
        // This ensures the highlighter and classifier can find the model
        if (model.uuid !== path) {
             model.uuid = path;
             console.log(`[DEBUG] Forced model UUID to match path: ${model.uuid}`);
        }

        model.useCamera(world.camera.three);

        world.scene.three.add(model.object);

        await fragments.core.update(true);
        
        loadedModels.set(path, model);

        // Debug: Check properties structure deeply
        const modelAny = model as any;
        let hasProps = modelAny.properties && Object.keys(modelAny.properties).length > 0;
        
        // Check data safely (Map or Object)
        let hasData = false;
        if (modelAny.data) {
            if (modelAny.data instanceof Map) hasData = modelAny.data.size > 0;
            else hasData = Object.keys(modelAny.data).length > 0;
        }
        
        logToScreen(`Model loaded. Properties: ${hasProps}, Data: ${hasData}`);
        console.log('[DEBUG] Model Keys:', Object.keys(modelAny));
        
        // Always try to load external properties JSON if available, as it overrides/supplements embedded properties
        const jsonPath = url.replace(/\.frag$/i, '.json');
        try {
             logToScreen(`Checking for external properties at ${jsonPath}...`);
             const response = await fetch(jsonPath);
             if (response.ok) {
                 const jsonProps = await response.json();
                 if (jsonProps && Object.keys(jsonProps).length > 0) {
                     modelAny.properties = jsonProps;
                     hasProps = true;
                     logToScreen(`Loaded external properties from JSON (${Object.keys(jsonProps).length} items). Overriding embedded properties.`);
                 }
             } else {
                 if (!hasProps) logToScreen(`Properties file not found at ${jsonPath} (Status: ${response.status}).`);
             }
        } catch (err) {
             console.error('Error fetching properties JSON:', err);
             if (!hasProps) logToScreen(`Error loading external properties.`, true);
        }

        // Ensure model.types is populated from properties if missing
        if ((!modelAny.types || Object.keys(modelAny.types).length === 0) && hasProps) {
             logToScreen('Reconstructing model.types from properties...');
             modelAny.types = {};
             let typeCount = 0;
             for (const id in modelAny.properties) {
                 const prop = modelAny.properties[id];
                 if (prop && prop.type) {
                     const typeId = prop.type;
                     if (!modelAny.types[typeId]) modelAny.types[typeId] = [];
                     modelAny.types[typeId].push(Number(id));
                     typeCount++;
                 }
             }
             logToScreen(`Reconstructed ${Object.keys(modelAny.types).length} types covering ${typeCount} items.`);
        }

        if (!hasProps) {
             console.warn('[DEBUG] Model has no properties attached! attempting to check data...');

             // FALLBACK PROPERTIES GENERATION
              if (!modelAny.properties || Object.keys(modelAny.properties).length === 0) {
                 try {
                     logToScreen('Generating dummy properties for missing metadata...');
                     const ids = await model.getItemsIdsWithGeometry();
                     const dummyProperties: Record<string, any> = {};
                     
                     for (const id of ids) {
                         dummyProperties[id] = {
                             expressID: id,
                             type: 4065, // IFCBUILDINGELEMENTPROXY (Unknown)
                             GlobalId: { type: 1, value: `generated-${id}` },
                             Name: { type: 1, value: `Element ${id}` },
                         };
                     }
                     modelAny.properties = dummyProperties;
                     hasProps = true;
                     logToScreen(`Generated fallback properties for ${ids.length} items.`);
                 } catch (fallbackErr) {
                     logToScreen(`Failed to generate fallback properties: ${fallbackErr}`, true);
                 }
              }
         }

        // CRITICAL FIX: Reconstruct model.data if missing
        // This links the ExpressIDs (in properties) to the Geometry (fragments)
        // Without this, the Classifier knows the category exists but can't find the items (Count 0)
        if (!modelAny.data || (modelAny.data instanceof Map && modelAny.data.size === 0)) {
             logToScreen('Reconstructing missing model.data from geometry items...');
             if (!modelAny.data) modelAny.data = new Map();
             
             // Try to use keyFragments map if available (most reliable for FragmentsGroup)
             let dataReconstructed = false;
             if (modelAny.keyFragments && modelAny.keyFragments instanceof Map && modelAny.keyFragments.size > 0) {
                 logToScreen(`Found keyFragments map with ${modelAny.keyFragments.size} entries.`);
                 for (const [expressID, fragID] of modelAny.keyFragments.entries()) {
                     modelAny.data.set(Number(expressID), [fragID, Number(expressID)]);
                 }
                 dataReconstructed = true;
                 logToScreen(`Reconstructed model.data from keyFragments.`);
             }

             // Try to find fragments in model.items (Fragments) or model.object (Meshes)
             let fragmentsList: any[] = [];
             
             if (!dataReconstructed) {
                 // Check if model has direct reference to fragments
                 // @ts-ignore
                 if (model.items && Array.isArray(model.items) && model.items.length > 0) {
                     // @ts-ignore
                     console.log(`[DEBUG] Found ${model.items.length} fragments in model.items`);
                     // @ts-ignore
                     fragmentsList = model.items;
                 } else {
                     // Fallback to mesh traversal
                     console.log('[DEBUG] model.items empty or missing, traversing model.object for meshes...');
                     if (model.object) {
                         model.object.traverse((child: any) => {
                             if (child.isMesh) {
                                 // Check if this mesh IS a fragment (has ids) or points to one
                                 fragmentsList.push(child);
                             }
                         });
                     }
                     
                     // Try looking in _itemsManager if available
                     if (fragmentsList.length === 0 && modelAny._itemsManager && modelAny._itemsManager.list) {
                         console.log('[DEBUG] Trying to recover from _itemsManager...');
                         modelAny._itemsManager.list.forEach((frag: any) => fragmentsList.push(frag));
                     }
                 }
                 
                 if (fragmentsList.length > 0) {
                     logToScreen(`Found ${fragmentsList.length} fragments/meshes. Scanning for items...`);
                     
                     let totalMapped = 0;
                     
                     for (const frag of fragmentsList) {
                         // Check for items/ids in the fragment
                         let items = frag.items || frag.ids;
                         
                         if (!items && frag.fragment) {
                             items = frag.fragment.items || frag.fragment.ids;
                         }
                         
                         // Deep check: look in userData
                         if (!items && frag.userData && frag.userData.ids) {
                             items = frag.userData.ids;
                         }
                         
                         if (items) {
                             const idList = Array.isArray(items) ? items : Array.from(items);
                             const fragUUID = frag.uuid || (frag.fragment ? frag.fragment.uuid : null);
                             
                             if (idList.length > 0 && fragUUID) {
                                 for (const id of idList) {
                                     modelAny.data.set(Number(id), [fragUUID, Number(id)]);
                                     totalMapped++;
                                 }
                             }
                         } else {
                             // Fallback: Check geometry attributes if items are missing
                             const geom = frag.geometry;
                             if (geom && geom.attributes && geom.attributes.expressID) {
                                 const attr = geom.attributes.expressID;
                                 const count = attr.count;
                                 const foundIds = new Set<number>();
                                 for(let i=0; i<count; i++) {
                                     foundIds.add(attr.getX(i));
                                 }
                                 
                                 const fragUUID = frag.uuid || (frag.fragment ? frag.fragment.uuid : null);
                                 if (fragUUID) {
                                     for (const id of foundIds) {
                                         modelAny.data.set(Number(id), [fragUUID, Number(id)]);
                                         totalMapped++;
                                     }
                                 }
                             }
                         }
                     }
                     
                     logToScreen(`Reconstructed model.data with ${totalMapped} entries from ${fragmentsList.length} fragments.`);
                     
                     // Fallback if scanning failed
                     if (totalMapped === 0) {
                         logToScreen('WARNING: Could not find items on fragments directly. Using fallback mapping to first fragment.', true);
                         const mainFragment = fragmentsList[0];
                         const fragmentId = mainFragment.uuid;
                         
                         if (!mainFragment.ids) mainFragment.ids = new Set();
                         if (!mainFragment.items) mainFragment.items = mainFragment.ids;
            
                         try {
                             const ids = await model.getItemsIdsWithGeometry();
                             for (const id of ids) {
                                 const numId = Number(id);
                                 if (!modelAny.data.has(numId)) {
                                    modelAny.data.set(numId, [fragmentId, numId]);
                                    mainFragment.ids.add(numId);
                                    if (Array.isArray(mainFragment.items)) mainFragment.items.push(numId);
                                    totalMapped++;
                                }
                            }
                            logToScreen(`Fallback: Mapped ${totalMapped} items to fragment ${fragmentId}`);
                        } catch (e) {
                             logToScreen(`Fallback failed: ${e}`, true);
                         }
                     }
                
                // Debug first entry
                if (modelAny.data.size > 0) {
                    const firstKey = modelAny.data.keys().next().value;
                    console.log(`[DEBUG] Sample model.data entry: Key=${firstKey} Val=`, modelAny.data.get(firstKey));
                }
                
                // CRITICAL FIX: Ensure model.types matches the data if we have dummy properties
                if (modelAny.types && Object.keys(modelAny.types).length > 0) {
                    console.log(`[DEBUG] model.types found with ${Object.keys(modelAny.types).length} types.`);
                    
                    // Check for ID mismatch between types and geometry
                    const typeIds = new Set<number>();
                    for (const key in modelAny.types) {
                        const ids = modelAny.types[key];
                        if (Array.isArray(ids)) ids.forEach((id: number) => typeIds.add(id));
                    }
                    
                    // Get current geometry IDs from model.data
                    const geometryIds = new Set(modelAny.data.keys());
                    
                    // Intersect
                    let matchCount = 0;
                    for (const id of typeIds) {
                        if (geometryIds.has(id)) matchCount++;
                    }
                    
                    logToScreen(`[DEBUG] Type IDs: ${typeIds.size}, Geometry IDs: ${geometryIds.size}, Match: ${matchCount}`);
                    
                    // If match is low (< 50%), force sync to ensure classification works
                    if ((matchCount === 0 || matchCount < typeIds.size * 0.5) && typeIds.size > 0) {
                        logToScreen(`WARNING: Low ID Match (${matchCount}/${typeIds.size}). Syncing model.data to match Type IDs...`, true);
                        
                        // Force map all Type IDs to the first fragment so they show up in Classifier
                        const mainFragment = fragmentsList[0];
                        const fragmentId = mainFragment.uuid;
                        
                        if (!mainFragment.ids) mainFragment.ids = new Set();
                        if (!mainFragment.items) mainFragment.items = mainFragment.ids;

                        let forcedCount = 0;
                        for (const id of typeIds) {
                            if (!modelAny.data.has(id)) {
                                modelAny.data.set(id, [fragmentId, id]);
                                mainFragment.ids.add(id);
                                if (Array.isArray(mainFragment.items)) mainFragment.items.push(id);
                                forcedCount++;
                            }
                        }
                        logToScreen(`Forced ${forcedCount} missing Type IDs into model.data (mapped to first fragment)`);
                    }
                }
                 
             } else {
                 logToScreen('Cannot reconstruct model.data: No meshes found in model.object!', true);
                 
                 // Debug internal managers if possible
                 if (modelAny._itemsManager) {
                     console.log('[DEBUG] _itemsManager:', modelAny._itemsManager);
                 }
             }
             }
        }

        // Check if model is in fragments list
        console.log('[DEBUG] Fragments List Keys:', Array.from(fragments.list.keys()));
        const isRegistered = fragments.list.has(model.uuid);
        console.log(`[DEBUG] Model registered in fragments.list: ${isRegistered} (UUID: ${model.uuid})`);

        if (!isRegistered) {
             console.log('[DEBUG] Manually registering model in fragments manager...');
             try {
                 fragments.list.set(model.uuid, model);
                 console.log('[DEBUG] Manual registration successful');
             } catch (regError) {
                 console.error('[DEBUG] Manual registration failed:', regError);
                 logToScreen(`Warning: Failed to register model: ${regError}`, true);
             }
        }

        // Classify the model
        if (hasProps) {
            try {
                console.log(`[DEBUG] Running classifier.byCategory() for model ${model.uuid}`);
                await classifier.byCategory(model);
                await updateClassificationUI();
                logToScreen('Classification updated');
                
                // AUTO-SWITCH to Classification Tab to show the user the categories
                const classTabBtn = document.querySelector('.tab-btn[data-tab="classification"]') as HTMLElement;
                if (classTabBtn) {
                    classTabBtn.click();
                    logToScreen('Switched to Classification tab.');
                }

            } catch (e) {
                logToScreen(`Classification error: ${e}`, true);
            }
        } else {
             logToScreen('Skipping classification (no properties)', true);
             const container = document.getElementById('classification-list');
             if (container) container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">Sin propiedades para clasificar</div>';
        }
        
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
        console.error(error);
        throw error;
    }
}

// --- Sidebar Logic (Kept mostly same, updated for new loading) ---

function initSidebarTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    if (tabs.length === 0) {
        console.warn('No sidebar tabs found during initialization');
    } else {
        console.log(`Initialized ${tabs.length} sidebar tabs`);
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => {
                c.classList.remove('active');
                (c as HTMLElement).style.display = 'none';
            });

            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            const content = document.getElementById(`tab-${tabId}`);
            if (content) {
                content.classList.add('active');
                content.style.display = 'flex';
            }
        });
    });
}

async function updateClassificationUI() {
    const container = document.getElementById('classification-list');
    if (!container) return;

    container.innerHTML = '';
    
    // Safety check for classifier list
    if (!classifier || !classifier.list) {
         console.warn('Classifier not ready');
         return;
    }

    // DEBUG LOGS
    console.log('[DEBUG] Classifier List Keys:', Array.from(classifier.list.keys()));
    
    // Iterate over ALL systems in the classifier
    let hasItems = false;
    for (const [systemName, classification] of classifier.list) {
        if (classification.size > 0) hasItems = true;
        console.log(`[DEBUG] Rendering system: ${systemName} with ${classification.size} groups`);
    }

    if (!hasItems) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">No hay clasificación disponible</div>';
        return;
    }

    const list = document.createElement('ul');
    list.className = 'folder-items';
    list.style.padding = '10px';

    // Second pass to render
    for (const [systemName, classification] of classifier.list) {
        for (const [type, groupData] of classification) {
            // FIX: Check if groupData has .map property, otherwise use groupData itself as the map
            // This handles different versions/structures of the classifier output
            const fragmentIdMap = (groupData as any).map || groupData;
            
            // Detailed Debug for map structure
            if (classification.size > 0 && !fragmentIdMap) {
                console.error(`[DEBUG] Missing map for ${type}`, groupData);
            }
            
            const li = document.createElement('li');
            li.className = 'model-item';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            
            let count = 0;
            if (fragmentIdMap) {
                for (const id in fragmentIdMap) {
                    const value = fragmentIdMap[id];
                    if (value instanceof Set) {
                        count += value.size;
                    } else if (Array.isArray(value)) {
                        count += value.length;
                    }
                }
            }
            
            // Log debug info for the first item found to see structure
            if (count === 0) {
                 // console.warn(`[DEBUG] Category ${type} has count 0. Map keys: ${fragmentIdMap ? Object.keys(fragmentIdMap) : 'null'}`);
            }

            // Optional: Hide items with 0 count to clean up UI?
            // For now, let's keep them but gray them out
            const opacity = count > 0 ? '1' : '0.5'; // Increased opacity for visibility
            const pointer = 'pointer'; // Always allow pointer events to debug

            li.innerHTML = `
                <div class="model-name" style="cursor: ${pointer}; flex-grow: 1; opacity: ${opacity};"><i class="fa-solid fa-layer-group"></i> ${type} <span style="font-size: 0.8em; color: #888;">(${count})</span></div>
                <div class="visibility-toggle" style="cursor: ${pointer}; padding: 0 10px; opacity: ${opacity};" title="Toggle Visibility">
                    <i class="fa-regular fa-eye"></i>
                </div>
            `;

            const nameDiv = li.querySelector('.model-name');
            const toggleDiv = li.querySelector('.visibility-toggle');
            const toggleIcon = toggleDiv?.querySelector('i');
            let isVisible = true;

            // SELECTION Handler (Clicking text)
            nameDiv?.addEventListener('click', async (e) => {
                e.stopPropagation();
                console.log(`[DEBUG] Selecting category: ${type} (Count: ${count})`);
                
                // Debug the map content
                console.log(`[DEBUG] FragmentIdMap for ${type}:`, fragmentIdMap);

                const highlighter = components.get(OBF.Highlighter);
                // ALLOW SELECTION even if count is 0 (to catch potential ghost items or map issues)
                if (fragmentIdMap && Object.keys(fragmentIdMap).length > 0) {
                     // Check keys in map
                     const mapKeys = Object.keys(fragmentIdMap || {});
                     console.log(`[DEBUG] Map keys: ${mapKeys.join(', ')}`);
                     
                     try {
                        highlighter.highlightByID('select', fragmentIdMap, true, true);
                        logToScreen(`Selected ${type} (${count} items)`);
                     } catch (e) {
                        logToScreen(`Error selecting ${type}: ${e}`, true);
                        console.error(e);
                     }
                } else {
                     logToScreen(`Cannot select ${type}: No items found (Map is empty)`, true);
                     console.warn(`[DEBUG] Map is empty for ${type}. GroupData:`, groupData);
                }
            });

            // VISIBILITY Handler (Clicking eye)
            toggleDiv?.addEventListener('click', (e) => {
                e.stopPropagation();
                isVisible = !isVisible;
                console.log(`[DEBUG] Toggling visibility for ${type}: ${isVisible}`);
                
                if (fragmentIdMap && Object.keys(fragmentIdMap).length > 0) {
                    hider.set(isVisible, fragmentIdMap);
                } else {
                    console.warn(`[DEBUG] Skipping visibility toggle for ${type} - map is empty`);
                    // Try to toggle anyway if logic permits, but hider needs a map
                }
                
                if (isVisible) {
                    li.classList.add('visible');
                    toggleIcon?.classList.replace('fa-eye-slash', 'fa-eye');
                    li.style.opacity = '1';
                } else {
                    li.classList.remove('visible');
                    toggleIcon?.classList.replace('fa-eye', 'fa-eye-slash');
                    li.style.opacity = '0.5';
                }
            });

            list.appendChild(li);
        }
    }

    container.appendChild(list);
}

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
                const overlay = document.getElementById('loading-overlay');
                if (overlay) {
                    overlay.style.display = 'flex';
                    const progressDiv = document.getElementById('loading-progress');
                    if (progressDiv) progressDiv.textContent = 'Procesando archivo...';
                }

                const file = target.files[0];
                const buffer = await file.arrayBuffer();
                
                try {
                    if (file.name.toLowerCase().endsWith('.frag')) {
                        logToScreen(`Loading fragments: ${file.name}...`);
                        const model = await fragments.core.load(buffer, { modelId: file.name });
                        
                        // Ensure model has a valid UUID
                        if (!model.uuid) {
                            model.uuid = THREE.MathUtils.generateUUID();
                            console.warn(`[DEBUG] Model had no UUID, generated: ${model.uuid}`);
                        }

                        // Ensure registration
                        if (!fragments.list.has(model.uuid)) {
                             fragments.list.set(model.uuid, model);
                        }
                        
                        model.useCamera(world.camera.three);
                        world.scene.three.add(model.object);
                        await fragments.core.update(true);
                        
                        const bbox = new THREE.Box3().setFromObject(model.object);
                        const sphere = new THREE.Sphere();
                        bbox.getBoundingSphere(sphere);
                        world.camera.controls.fitToSphere(sphere, true);

                        // Try to load associated properties file
                        const baseName = file.name.replace('.frag', '');
                        logToScreen(`Attempting to find properties for ${baseName}...`);
                        
                        // Check if user selected multiple files (frag + json)
                        // If only one file selected, we can't automagically find the json unless we ask for it
                        
                        // VERIFY PROPERTIES
                        const modelAny = model as any;
                        const hasProps = modelAny.properties && Object.keys(modelAny.properties).length > 0;
                        logToScreen(`Fragment loaded. Properties found: ${hasProps ? Object.keys(modelAny.properties).length : 0}`);
                        
                        if (!hasProps) {
                            logToScreen('WARNING: No properties found in .frag file. Generating dummy properties...', true);
                            
                            try {
                                const ids = await model.getItemsIdsWithGeometry();
                                const dummyProperties: Record<string, any> = {};
                                
                                // Create a basic map for classification if needed
                                // Usually classifier needs IFC type entities. 
                                // We will fake them as "IFCBUILDINGELEMENTPROXY" or similar if possible, 
                                // but mainly we just want *some* property to show up.
                                
                                for (const id of ids) {
                                    dummyProperties[id] = {
                                        expressID: id,
                                        type: 0, // Unknown type
                                        GlobalId: { type: 1, value: `generated-${id}` },
                                        Name: { type: 1, value: `Element ${id}` },
                                        Description: { type: 1, value: 'Generated Property' }
                                    };
                                }
                                
                                modelAny.properties = dummyProperties;
                                logToScreen(`Generated dummy properties for ${ids.length} elements.`);
                                
                                // Attempt classification (might be empty if types are 0, but at least properties exist)
                                logToScreen(`Attempting classification on dummy properties...`);
                                await classifier.byCategory(model);
                                await updateClassificationUI();
                                logToScreen(`Classification complete (fallback).`);
                                
                            } catch (genErr) {
                                logToScreen(`Error generating dummy properties: ${genErr}`, true);
                            }
                        } else {
                            // Classify only if properties exist
                            logToScreen(`Classifying fragments: ${file.name}...`);
                            try {
                                await classifier.byCategory(model);
                                await updateClassificationUI();
                                logToScreen(`Classification complete for ${file.name}`);
                            } catch (err) {
                                logToScreen(`Classification failed: ${err}`, true);
                            }
                        }

                        logToScreen(`Loaded .frag: ${file.name}`);
                    } else {
                        // Assume IFC - SHOW ERROR/WARNING AS REQUESTED BY USER
                        logToScreen('IFC loading is disabled. Please convert to .frag externally and load the .frag file.', true);
                        alert('La carga directa de IFC está deshabilitada por inestabilidad. Por favor, carga archivos .frag.');
                        
                        /* IFC LOADING DISABLED BY USER REQUEST
                        logToScreen(`Loading and converting IFC: ${file.name}...`);
                        ...
                        */
                    }
                } catch (e) {
                    logToScreen(`Error loading file: ${e}`, true);
                    alert(`Error loading file: ${e}`);
                } finally {
                    if (overlay) overlay.style.display = 'none';
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

function initClipperTool() {
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

    // Clipper Controls
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




// Add global state for folder open/close
const folderStates: Record<string, boolean> = {};

// Load models from JSON and populate sidebar
async function loadModelList() {
    const listContainer = document.getElementById('model-list');
    if (!listContainer) {
        return;
    }

    try {
        const GITHUB_API_URL = 'https://api.github.com/repos/alcabama-commits/bim/contents/docs/VSR_IFC/models';
        logToScreen('Scanning GitHub for models...');
        
        const response = await fetch(GITHUB_API_URL);
        if (!response.ok) throw new Error(`GitHub API Error: ${response.status}`);
        
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Invalid GitHub response');

        const models = data
            .filter((item: any) => item.name.toLowerCase().endsWith('.frag'))
            .map((item: any) => ({
                name: item.name,
                path: `models/${item.name}`,
                url: item.download_url
            }));

        logToScreen(`GitHub Scan: ${models.length} .frag models found`);

        // Group models by specialty
        const groups: Record<string, any[]> = {};
        models.forEach((m: { name: string; path: string; url: string }) => {
            const specialty = getSpecialtyFromIfcPath(m.path);
            if (!groups[specialty]) groups[specialty] = [];
            groups[specialty].push(m);
        });

        // Auto-update setup
        if (!(window as any)._autoUpdateStarted) {
            (window as any)._autoUpdateStarted = true;
            setInterval(loadModelList, 60000);
            logToScreen('Auto-update enabled (60s).');
        }

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
                    folderStates[folder] = false;
                } else {
                    itemsList.classList.add('collapsed');
                    header.querySelector('.fa-chevron-down')?.classList.replace('fa-chevron-down', 'fa-chevron-right');
                    header.querySelector('.fa-folder-open')?.classList.replace('fa-folder-open', 'fa-folder');
                    folderStates[folder] = true;
                }
            });

            // Restore state
            if (folderStates[folder]) {
                 itemsList.classList.add('collapsed');
                 header.querySelector('.fa-chevron-down')?.classList.replace('fa-chevron-down', 'fa-chevron-right');
                 header.querySelector('.fa-folder-open')?.classList.replace('fa-folder-open', 'fa-folder');
            }

            items.forEach((m) => {
                const li = document.createElement('li');
                li.className = 'model-item';
                li.dataset.path = m.path;

                // Check if already loaded (support both path and url keys)
                if (loadedModels.has(m.path) || (m.url && loadedModels.has(m.url))) {
                    li.classList.add('visible');
                }

                // Structure: Name + Visibility Toggle
                li.innerHTML = `
                    <div class="model-name"><i class="fa-solid fa-cube"></i> ${m.name}</div>
                    <div class="visibility-toggle" title="Toggle Visibility">
                        <i class="fa-regular ${li.classList.contains('visible') ? 'fa-eye' : 'fa-eye-slash'}"></i>
                    </div>
                `;

                // Handle click on the whole item or specific toggle
                li.addEventListener('click', async (e) => {
                    // Prevent propagation if clicking nested elements
                    e.stopPropagation();
                    
                    const target = e.target as HTMLElement;
                    // Prefer URL for loading if available
                    const loadKey = m.url || m.path;

                    // If clicked explicitly on the visibility toggle icon/div
                    if (target.closest('.visibility-toggle')) {
                        await toggleModel(loadKey, baseUrl, li);
                    } else {
                        // Clicked on the name/body -> Select the model
                        await selectModel(loadKey);
                    }
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

async function selectModel(path: string) {
    if (!loadedModels.has(path)) {
        logToScreen(`Model ${path} not loaded. Click the eye icon to load it first.`, true);
        return;
    }

    const model = loadedModels.get(path);
    if (!model) return;

    // Highlight the whole model
    // We create a selection map where the key is the model UUID (which is the path)
    // and the value is all expressIDs in the model
    try {
        const ids = await model.getItemsIdsWithGeometry();
        const selectionMap: Record<string, number[]> = {};
        selectionMap[path] = ids; // Use path as UUID since we forced it

        logToScreen(`Selecting model: ${model.name} (${ids.length} items)`);
        highlighter.highlightByID('select', selectionMap, true, true);
        
        // Also fit camera to model
        const bbox = new THREE.Box3().setFromObject(model.object);
        const sphere = new THREE.Sphere();
        bbox.getBoundingSphere(sphere);
        world.camera.controls.fitToSphere(sphere, true);
        
    } catch (e) {
        logToScreen(`Error selecting model: ${e}`, true);
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
        let fullPath = path;
        // Only prepend base URL if it's not absolute
        if (!path.startsWith('http')) {
             const encodedPath = path.split('/').map(part => encodeURIComponent(part)).join('/');
             fullPath = `${baseUrl}${encodedPath}`;
        }
        
        await loadModel(fullPath, path);
        
        // Update UI to loaded/visible state
        liElement.classList.add('visible');
        toggleIcon?.classList.replace('fa-eye-slash', 'fa-eye');
        
    } catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        alert('Error downloading model: ' + msg);
        logToScreen(`Error downloading model: ${msg}`, true);
    } finally {
        if (overlay) overlay.style.display = 'none';
    }
}

logToScreen('Initializing That Open Engine...');
initSidebar();
initSidebarTabs();
initTheme();
initProjectionToggle();
initGridToggle();
initClipperTool();
initFitModelTool();
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

// Helper to get current model center using BoundingBoxer with fallback
function getModelBox() {
    const boxer = components.get(OBC.BoundingBoxer);
    boxer.list.clear();
    
    // Use addFromModels to automatically include all fragments registered in FragmentsManager
    boxer.addFromModels();

    let box = boxer.get();
    boxer.list.clear();

    // Fallback if BoundingBoxer returns empty (e.g. if models are not fragments)
    if (box.isEmpty()) {
        console.warn('BoundingBoxer empty, falling back to scene traversal');
        box = new THREE.Box3();
        let hasMeshes = false;
        world.scene.three.traverse((child: any) => {
             // Check if it's a mesh and part of a model (not grid/helper)
             // Simple check: isMesh and visible
             if (child.isMesh && child.visible) {
                 box.expandByObject(child);
                 hasMeshes = true;
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

// Helper to get model size (radius)
function getModelRadius(): number {
    const box = getModelBox();
    if (box.isEmpty()) return 10;
    
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    return sphere.radius || 10;
}

function initFitModelTool() {
    const btn = document.getElementById('fit-model-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        logToScreen('Fit Model clicked');
        // alert('Fit Model Clicked'); // Uncomment for forceful debug
        const box = getModelBox();
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        
        logToScreen(`Fit Radius: ${sphere.radius.toFixed(2)} Center: ${sphere.center.x.toFixed(1)},${sphere.center.y.toFixed(1)},${sphere.center.z.toFixed(1)}`);

        if (sphere.radius > 0.1) {
             world.camera.controls.fitToSphere(sphere, true);
        } else {
             logToScreen('Model bounds too small/empty', true);
             alert('No se pudo encontrar el modelo para ajustar. Intenta recargar.');
        }
    });
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

const [propsTable] = CUI.tables.itemsData({
    components,
    modelIdMap: {},
});

propsTable.preserveStructureOnFilter = true;

const propertiesContent = document.getElementById('properties-content');
if (propertiesContent) {
    propertiesContent.innerHTML = '';
    propertiesContent.appendChild(propsTable);
}

highlighter.events.select.onHighlight.add(async (modelIdMap) => {
    console.log('[DEBUG] Highlight event:', modelIdMap);
    await renderPropertiesTable(modelIdMap as any);
});

highlighter.events.select.onClear.add(async () => {
    await renderPropertiesTable({} as any);
});

if (container) {
    container.addEventListener('click', () => {
        const selection = (highlighter as any).selection?.select as Record<string, Set<number>> | undefined;
        renderPropertiesTable(selection || ({} as any));
    });
}

// Helper for deep property resolution
function resolveRemote(ref: any, model: any) {
    if (!ref || !model || !model.properties) return ref;
    if (typeof ref === 'number') return model.properties[ref];
    if (ref && typeof ref.value === 'number') return model.properties[ref.value];
    return ref;
}

async function renderPropertiesTable(modelIdMap: Record<string, Set<number>>) {
    console.log('[DEBUG] renderPropertiesTable called with:', modelIdMap);
    const content = document.getElementById('properties-content');
    if (!content) return;
    content.innerHTML = '';

    const entries = modelIdMap instanceof Map
        ? Array.from(modelIdMap.entries())
        : Object.entries(modelIdMap);

    if (entries.length === 0) {
        content.innerHTML = '<div style="padding: 15px; color: #666; text-align: center;">Selecciona un elemento para ver sus propiedades</div>';
        return;
    }

    const normalized: Record<string, number[]> = {};
    for (const [modelID, idsSet] of entries) {
        const ids = idsSet instanceof Set ? Array.from(idsSet) : (idsSet as any[]);
        if (!ids || ids.length === 0) continue;
        normalized[modelID] = ids as number[];
    }

    const modelIds = Object.keys(normalized);
    if (modelIds.length === 0) {
        content.innerHTML = '<div style="padding: 15px; color: #666; text-align: center;">Selecciona un elemento para ver sus propiedades</div>';
        return;
    }

    const dataByModel = await fragments.getData(normalized as any, {
        attributesDefault: true,
        relations: {
            ContainedInStructure: { attributes: true, relations: true },
            IsDefinedBy: { attributes: true, relations: true }
        }
    } as any);

    // --- SECOND PASS: Fetch Relations Entities (specifically IfcRelContainedInSpatialStructure) ---
    // Identify which relation IDs we need to fetch
    const relationsToFetch: Record<string, number[]> = {};
    
    for (const modelID of modelIds) {
        const items = (dataByModel as any)[modelID] || [];
        const modelRelations = new Set<number>();
        
        items.forEach((item: any) => {
             const raw = item as any;
             const attrs = raw.data || raw.attributes || raw;
             const relations = raw.relations || raw.Relations || attrs.relations || attrs.Relations || {};
             const spatial = relations.ContainedInStructure || relations.containedInStructure || relations.containedInSpatialStructure || relations.ContainedInSpatialStructure;
             if (Array.isArray(spatial)) {
                 spatial.forEach((id: number) => modelRelations.add(id));
             }
        });
        
        if (modelRelations.size > 0) {
            relationsToFetch[modelID] = Array.from(modelRelations);
        }
    }

    let relationsData: any = {};
    if (Object.keys(relationsToFetch).length > 0) {
         try {
             relationsData = await fragments.getData(relationsToFetch as any, {
                 attributesDefault: true,
                 relationsDefault: { attributes: true } // We just need the RelatingStructure ID
             } as any);
         } catch (e) {
             console.error('Failed to fetch relations data:', e);
         }
    }

    // --- THIRD PASS: Fetch Structure Entities (The Levels themselves) ---
    const structuresToFetch: Record<string, number[]> = {};
    const relIdToStructureId: Record<string, number> = {}; // Key: "modelID-relID" -> structureID

    for (const modelID of Object.keys(relationsData)) {
        const rels = relationsData[modelID];
        const modelStructures = new Set<number>();

        rels.forEach((rel: any) => {
             const raw = rel as any;
             const attrs = raw.data || raw.attributes || raw;
             // IfcRelContainedInSpatialStructure has RelatingStructure
             const structRef = attrs.RelatingStructure || attrs.relatingStructure;
             const structID = (structRef && typeof structRef === 'object' && 'value' in structRef) ? structRef.value : structRef;
             
             if (typeof structID === 'number') {
                 modelStructures.add(structID);
                 // Map relation to structure for lookup later
                 // Note: relationsData returns array of objects, we need to match by Express ID if possible
                 // But fragments.getData returns objects which usually contain expressID. 
                 // If not, we rely on the order or check if expressID is in attrs.
                 const expressID = raw.expressID || attrs.expressID;
                 if (expressID) {
                     relIdToStructureId[`${modelID}-${expressID}`] = structID;
                 }
             }
        });

        if (modelStructures.size > 0) {
            structuresToFetch[modelID] = Array.from(modelStructures);
        }
    }

    let structuresData: any = {};
    if (Object.keys(structuresToFetch).length > 0) {
        try {
            structuresData = await fragments.getData(structuresToFetch as any, {
                attributesDefault: true
            } as any);
        } catch (e) {
            console.error('Failed to fetch structure data:', e);
        }
    }
    
    // Helper to find structure name
    const getStructureName = (modelID: string, structureID: number) => {
        const structs = structuresData[modelID];
        if (!structs) return null;
        const s = structs.find((x: any) => (x.expressID || x.attributes?.expressID || x.data?.expressID) === structureID);
        if (!s) return null;
        const attrs = s.data || s.attributes || s;
        const n = attrs.Name || attrs.name;
        return (n?.value ?? n);
    };

    for (const modelID of modelIds) {
        const localIds = normalized[modelID] || [];
        const items = (dataByModel as any)[modelID] || [];
        
        // Try to get the full model to access raw properties
        const model = loadedModels.get(modelID) || fragments.list.get(modelID);

        items.forEach((item: any, index: number) => {
            const localId = localIds[index];
            const raw = item as any;
            const attrs = raw.data || raw.attributes || raw;
            let levelName: string | null = null;

            // --- Base Info (Name, ID, Category, GUID) ---
            const nameAttr = attrs.Name || attrs.name || attrs.IFCNAME || attrs.IfcName;
            const nameValue = typeof nameAttr === 'object' && nameAttr !== null && 'value' in nameAttr
                ? (nameAttr as any).value
                : nameAttr || `Elemento ${localId ?? ''}`;

            const category = raw.category || attrs.Category || attrs.category;
            const guidAttr = raw.guid || attrs.GlobalId || attrs.globalId || attrs.GUID || attrs.guid;
            const guidValue = typeof guidAttr === 'object' && guidAttr !== null && 'value' in guidAttr
                ? (guidAttr as any).value
                : guidAttr || '';

            const container = document.createElement('div');
            container.className = 'prop-item';

            let html = `
                <div class="prop-header-info">
                    <strong>${nameValue}</strong>
                    <div style="font-size: 11px; color: #666;">
                        ID: ${localId ?? '-'} <span style="margin: 0 5px;">|</span> Modelo: ${modelID}
                        ${category ? `<span style="margin: 0 5px;">|</span> Tipo: ${category}</span>` : ''}
                        ${guidValue ? `<br/>GUID: ${guidValue}` : ''}
                    </div>
                </div>
            `;

            html += `<div class="prop-set-title">Atributos Base</div>`;
            html += `<table class="prop-table"><tbody>`;

            // Filter out internal/relation keys from base attributes
            const ignoredKeys = new Set(['localId', 'category', 'guid', 'IsDefinedBy', 'isDefinedBy', 'relations', 'Relations', 'expressID', 'type']);
            
            for (const [key, attr] of Object.entries(attrs)) {
                if (!key || ignoredKeys.has(key)) continue;

                const val = (attr as any)?.value ?? attr;
                if (val === null || val === undefined) continue;
                if (Array.isArray(val)) continue;
                if (typeof val === 'object') continue;

                html += `<tr><th>${key}</th><td>${val}</td></tr>`;
            }

            if (levelName) {
                html += `<tr><th>Nivel</th><td>${levelName}</td></tr>`;
            }

            html += `</tbody></table>`;

            // --- Relations (Property Sets & Cantidades) ---
            
            let foundDeepProps = false;
            
            // GENERIC DUMP of all other properties
            // This ensures we show everything in the JSON even if it's not a standard Pset
            const standardKeys = new Set([
                'expressID', 'type', 'GlobalId', 'Name', 'Description', 'Tag', 'ObjectType',
                'ContainedInStructure', 'containedInStructure', 
                'IsDefinedBy', 'isDefinedBy', 
                'relations', 'Relations', 
                'localId', 'category', 'guid'
            ]);

            // First, check standard relations (Psets)
            if (model && model.properties && model.properties[localId]) {
                const entity = model.properties[localId];
                
                // Show any top-level properties that aren't standard keys
                let hasCustomTopLevel = false;
                let customTopLevelHtml = `<div class="prop-set-title">Propiedades del Elemento (Completo)</div><table class="prop-table"><tbody>`;
                
                // Helper to format values recursively
                const formatValue = (v: any, depth: number): string => {
                    if (depth > 2) return '...'; // Avoid infinite recursion
                    if (v === null || v === undefined) return '';

                    let valueToProcess = v;
                    
                    // Handle Value Wrapper { type: 1, value: "foo" }
                    if (typeof v === 'object' && v !== null && v.value !== undefined) {
                        valueToProcess = v.value;
                    }

                    // Handle Array
                    if (Array.isArray(valueToProcess)) {
                        if (valueToProcess.length === 0) return '[]';
                        return `[${valueToProcess.map((item: any) => formatValue(item, depth + 1)).join(', ')}]`;
                    }

                    // Handle Reference (Number) - Try to resolve it
                    if (typeof valueToProcess === 'number' && Number.isInteger(valueToProcess)) {
                        // Check if it's a reference to another entity in the model
                        if (model.properties[valueToProcess]) {
                            const ref = model.properties[valueToProcess];
                            
                            // Try to get a meaningful name
                            const name = (ref.Name && (ref.Name.value || ref.Name)) || 
                                         (ref.NominalValue && (ref.NominalValue.value || ref.NominalValue)) ||
                                         (ref.Description && (ref.Description.value || ref.Description));
                                         
                            // If we are at depth 0 or 1, maybe show some details of the referenced object
                            let details = '';
                            if (depth < 1) {
                                const subProps = [];
                                for (const [sk, sv] of Object.entries(ref)) {
                                    if (['expressID', 'type', 'GlobalId', 'OwnerHistory', 'Owner'].includes(sk)) continue;
                                    if (typeof sv === 'object' || Array.isArray(sv)) continue; // Only simple values in summary
                                    subProps.push(`${sk}: ${sv}`);
                                }
                                if (subProps.length > 0) details = ` <span style="color:#666; font-size:0.85em;">{${subProps.join(', ')}}</span>`;
                            }
                            
                            return `<span title="ExpressID: ${valueToProcess}" style="color: #0056b3; cursor: help;">${name ? name : ref.type || 'Entity'} <i>#${valueToProcess}</i>${details}</span>`;
                        }
                        return String(valueToProcess);
                    }

                    if (typeof valueToProcess === 'object') {
                        try { return JSON.stringify(valueToProcess); } catch { return '[Object]'; }
                    }

                    return String(valueToProcess);
                };
                
                for (const [key, val] of Object.entries(entity)) {
                    if (standardKeys.has(key)) continue;
                    
                    // Skip nulls
                    if (val === null || val === undefined) continue;
                    
                    const displayVal = formatValue(val, 0);
                    customTopLevelHtml += `<tr><th>${key}</th><td>${displayVal}</td></tr>`;
                    hasCustomTopLevel = true;
                }
                customTopLevelHtml += `</tbody></table>`;
                
                if (hasCustomTopLevel) {
                    html += customTopLevelHtml;
                }

                // --- INVERSE ATTRIBUTE RECONSTRUCTION (Lazy Build) ---
                if (!model._inverseMap) {
                    console.log('Building inverse attribute map for property discovery...');
                    model._inverseMap = new Map();
                    const psetMap = model._inverseMap;
                    
                    for (const id in model.properties) {
                        const prop = model.properties[id];
                        if (!prop) continue;
                        
                        // Check for IfcRelDefinesByProperties
                        // Note: Type can be numeric or string depending on parser
                        const type = String(prop.type || '').toUpperCase();
                        
                        if (type === 'IFCRELDEFINESBYPROPERTIES') {
                            const related = prop.RelatedObjects || prop.relatedObjects;
                            const relating = prop.RelatingPropertyDefinition || prop.relatingPropertyDefinition;
                            
                            if (related && relating) {
                                const relatedIds = Array.isArray(related) ? related : [related];
                                const psetId = (relating.value || relating); // Handle wrapper
                                
                                for (const relId of relatedIds) {
                                    const rId = (relId.value || relId);
                                    if (!psetMap.has(rId)) psetMap.set(rId, []);
                                    psetMap.get(rId).push(psetId);
                                }
                            }
                        }
                    }
                    console.log(`Inverse map built. Found relations for ${psetMap.size} items.`);
                }

                // Inject detected Psets into IsDefinedBy if missing
                let isDefinedBy = entity.IsDefinedBy || entity.isDefinedBy || [];
                if (!Array.isArray(isDefinedBy)) isDefinedBy = [isDefinedBy];
                
                // Add inverse relations
                if (model._inverseMap && model._inverseMap.has(Number(localId))) {
                    const extraPsets = model._inverseMap.get(Number(localId));
                    // Construct synthetic objects to mimic direct reference
                    // We only have the Pset ID, but that's what resolveRemote needs
                    extraPsets.forEach((pid: any) => {
                         // We create a fake "Rel" that points to the Pset
                         // Because the loop below expects a Rel, then gets RelatingPropertyDefinition
                         // But wait, the loop below iterates 'isDefinedBy' which are RELATIONS (IfcRelDefinesByProperties)
                         // NOT Psets directly.
                         // So we need to find the REL ID that connects them? 
                         // No, we can just treat the Pset as if it was directly linked if we adjust the loop.
                         // BUT, to avoid breaking existing logic, let's look at the loop.
                         
                         // The loop expects: rel -> RelatingPropertyDefinition -> Pset
                         // If we just add the Pset ID to a separate list, we can process it.
                    });
                }
                
                // Better approach: Separate loop for Inverse Psets
                const inversePsets = model._inverseMap ? (model._inverseMap.get(Number(localId)) || []) : [];
                
                // --- Level / Spatial Structure ---
                const containedIn = entity.ContainedInStructure || entity.containedInStructure;
                if (containedIn && Array.isArray(containedIn)) {
                    for (const relRef of containedIn) {
                        const rel = resolveRemote(relRef, model);
                        if (!rel) continue;

                        const structureRef = rel.RelatingStructure || rel.relatingStructure;
                        if (!structureRef) continue;

                        const structure = resolveRemote(structureRef, model);
                        if (!structure) continue;

                        const levelNameObj = structure.Name || structure.name;
                        const candidate = (levelNameObj?.value ?? levelNameObj) || 'Sin Nombre';
                        if (candidate) {
                            levelName = String(candidate);
                            break;
                        }
                    }
                }

                const directIsDefinedBy = entity.IsDefinedBy || entity.isDefinedBy;
                
                if (directIsDefinedBy && Array.isArray(directIsDefinedBy)) {
                    for (const relRef of directIsDefinedBy) {
                        const rel = resolveRemote(relRef, model);
                        if (!rel) continue;

                        // Check if it is IfcRelDefinesByProperties
                        const psetRef = rel.RelatingPropertyDefinition || rel.relatingPropertyDefinition;
                        if (!psetRef) continue;

                        const pset = resolveRemote(psetRef, model);
                        if (!pset) continue;
                        
                        renderPset(pset);
                    }
                }
                
                // Render Inverse Psets
                if (inversePsets.length > 0) {
                     for (const psetId of inversePsets) {
                         const pset = resolveRemote(psetId, model);
                         if (pset) renderPset(pset);
                     }
                }

                function renderPset(pset: any) {
                        const psetNameObj = pset.Name || pset.name;
                        const psetName = (psetNameObj?.value ?? psetNameObj) || 'Sin Nombre';

                        // Case 1: IfcPropertySet -> HasProperties
                        const props = pset.HasProperties || pset.hasProperties;
                        if (props && Array.isArray(props)) {
                            foundDeepProps = true;
                            html += `<div class="prop-set-title">${psetName}</div><table class="prop-table"><tbody>`;
                            for (const propRef of props) {
                                const prop = resolveRemote(propRef, model);
                                if (!prop) continue;

                                const propNameObj = prop.Name || prop.name;
                                const propName = propNameObj?.value ?? propNameObj;
                                
                                const propValObj = prop.NominalValue || prop.nominalValue;
                                const propVal = propValObj?.value ?? propValObj;

                                if (propName && propVal !== undefined) {
                                    const displayVal = formatValue(propVal, 0);
                                    html += `<tr><th>${propName}</th><td>${displayVal}</td></tr>`;
                                }
                            }
                            html += `</tbody></table>`;
                        }

                        // Case 2: IfcElementQuantity -> Quantities
                        const quantities = pset.Quantities || pset.quantities;
                        if (quantities && Array.isArray(quantities)) {
                            foundDeepProps = true;
                            html += `<div class="prop-set-title">${psetName} (Cantidades)</div><table class="prop-table"><tbody>`;
                            for (const qRef of quantities) {
                                const q = resolveRemote(qRef, model);
                                if (!q) continue;

                                const qNameObj = q.Name || q.name;
                                const qName = qNameObj?.value ?? qNameObj;
                                
                                const qVal = (q.LengthValue?.value ?? q.LengthValue) ?? 
                                             (q.AreaValue?.value ?? q.AreaValue) ?? 
                                             (q.VolumeValue?.value ?? q.VolumeValue) ?? 
                                             (q.CountValue?.value ?? q.CountValue) ?? 
                                             (q.WeightValue?.value ?? q.WeightValue) ?? 
                                             (q.TimeValue?.value ?? q.TimeValue) ?? 
                                             (q.nominalValue?.value ?? q.nominalValue);
                                
                                if (qName && qVal !== undefined) {
                                    const displayVal = formatValue(qVal, 0);
                                    html += `<tr><th>${qName}</th><td>${displayVal}</td></tr>`;
                                }
                            }
                            html += `</tbody></table>`;
                        }
                }
            }

            // --- Robust Level Lookup (Independent of Deep Props) ---
            if (!levelName) {
                const relations = raw.relations || raw.Relations || attrs.relations || attrs.Relations || {};
                const spatial = relations.ContainedInStructure || relations.containedInStructure || relations.containedInSpatialStructure || relations.ContainedInSpatialStructure;
                
                if (Array.isArray(spatial) && spatial.length > 0) {
                     // spatial contains IDs of IFCRELCONTAINEDINSPATIALSTRUCTURE
                     for (const relID of spatial) {
                         // New Lookup Logic using pre-fetched data
                         const structID = relIdToStructureId[`${modelID}-${relID}`];
                         if (structID) {
                             const name = getStructureName(modelID, structID);
                             if (name) {
                                 levelName = String(name);
                                 break;
                             }
                         }
                         
                         // Fallback to old logic (only works if model.properties is loaded)
                         if (!levelName) {
                             const rel = resolveRemote(relID, model);
                             if (rel && typeof rel === 'object') {
                                 const structureRef = rel.RelatingStructure || rel.relatingStructure;
                                 const structure = resolveRemote(structureRef, model);
                                 if (structure && typeof structure === 'object') {
                                     const levelNameObj = structure.Name || structure.name;
                                     const candidate = (levelNameObj?.value ?? levelNameObj);
                                     if (candidate) {
                                         levelName = String(candidate);
                                         break; // Found it
                                     }
                                 }
                             }
                         }
                     }
                }
            }

            if (levelName && !html.includes("<th>Nivel</th>")) {
                html = html.replace(
                    "</tbody></table>",
                    `<tr><th>Nivel</th><td>${levelName}</td></tr></tbody></table>`
                );
            }

            const rels = raw.relations || raw.Relations || attrs.relations || attrs.Relations || {};
            const relKeys = Object.keys(rels);
            const spatial = rels.ContainedInStructure || rels.containedInStructure || rels.containedInSpatialStructure || rels.ContainedInSpatialStructure;
            
            html += `
                <details style="margin-top: 15px; border-top: 1px solid #ddd; padding-top: 10px;">
                    <summary style="font-size: 11px; color: #999; cursor: pointer; user-select: none;">
                        🛠 Diagnóstico de Datos
                    </summary>
                    <div style="font-size: 10px; color: #444; background: #f5f5f5; padding: 10px; margin-top: 5px; border-radius: 4px; overflow-x: auto;">
                        <strong>ID Elemento:</strong> ${localId} (ExpressID)<br/>
                        <strong>Relaciones Disponibles:</strong> ${relKeys.length > 0 ? relKeys.join(', ') : 'NINGUNA'}<br/>
                        <strong>Relación Espacial (Nivel):</strong> ${spatial ? '✅ EXISTE' : '❌ FALTA'}<br/>
                        ${spatial ? `Valores: ${JSON.stringify(spatial)}` : ''}
                    </div>
                </details>
            `;

            container.innerHTML = html;
            content.appendChild(container);
        });
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
        
                const header = panel.querySelector('.properties-header');
                if (header && !header.querySelector('.version-tag')) {
                     const v = document.createElement('span');
                     v.className = 'version-tag';
                     v.style.fontSize = '10px';
                     v.style.color = '#888';
                     v.style.marginLeft = '10px';
                     v.innerText = 'v1.7 (Custom Table)';
                     header.appendChild(v);
                }

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

    renderPropertiesTable({} as any);
}

