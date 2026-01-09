import * as THREE from 'three';
import { IFCLoader } from 'web-ifc-three/IFCLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import './style.css';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0);
// Fog removed to improve clarity and visibility of distant elements

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.5, 10000);
camera.position.z = 5;
camera.position.y = 2;
camera.position.x = 2;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const container = document.getElementById('viewer-container');
if (container) {
    container.appendChild(renderer.domElement);
}

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1);
directionalLight2.position.set(-1, -1, -1);
scene.add(directionalLight2);

// Grid
const grid = new THREE.GridHelper(50, 50);
scene.add(grid);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// IFC Loading
const ifcLoader = new IFCLoader();
// Ensure correct path to WASM files
const baseUrl = import.meta.env.BASE_URL || './';
ifcLoader.ifcManager.setWasmPath(baseUrl + 'wasm/');

// Optimize for large models and precision
ifcLoader.ifcManager.applyWebIfcConfig({
    COORDINATE_TO_ORIGIN: false, // Disabled to manually handle relative positioning
    USE_FAST_BOOLS: true
});

// Track loaded models
// Key: path, Value: Model object
const loadedModels = new Map<string, any>();

// Global offset to fix floating point jitter while maintaining relative positions
let firstModelCenter: THREE.Vector3 | null = null;

async function loadIfc(url: string, path: string) {
    try {
        console.log('Attempting to load IFC from:', url);
        const model = await ifcLoader.loadAsync(url);
        
        // Handle geometry offset to fix jitter
        if (model.isMesh) {
            handleGeometryOffset(model.geometry);
        } else if (model.isGroup) {
            model.traverse((child: any) => {
                if (child.isMesh) {
                    handleGeometryOffset(child.geometry);
                }
            });
        }

        // Add to scene and tracking map
        scene.add(model);
        loadedModels.set(path, model);
        
        console.log('Model loaded:', model);

        // Auto-center camera if it's the first model
        if (loadedModels.size === 1) {
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2));
            
            cameraZ *= 2.0; // Padding
            
            const direction = new THREE.Vector3(1, 1, 1).normalize();
            camera.position.copy(center.clone().add(direction.multiplyScalar(cameraZ)));
            camera.lookAt(center);
            
            controls.target.copy(center);
            controls.update();
            
            console.log('Camera centered at:', center, 'Distance:', cameraZ);
        }
        
        return model;
    } catch (error) {
        console.error('Error loading IFC:', error);
        throw error;
    }
}

function handleGeometryOffset(geometry: THREE.BufferGeometry) {
    // If this is the very first geometry processed, calculate the global center
    if (!firstModelCenter) {
        geometry.computeBoundingBox();
        if (geometry.boundingBox) {
            firstModelCenter = geometry.boundingBox.getCenter(new THREE.Vector3());
            logToScreen(`Setting scene origin to: ${firstModelCenter.x.toFixed(2)}, ${firstModelCenter.y.toFixed(2)}, ${firstModelCenter.z.toFixed(2)}`);
        }
    }

    // Apply the global offset to all geometries (including the first one)
    if (firstModelCenter) {
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            positions.setXYZ(
                i,
                positions.getX(i) - firstModelCenter.x,
                positions.getY(i) - firstModelCenter.y,
                positions.getZ(i) - firstModelCenter.z
            );
        }
        positions.needsUpdate = true;
        
        // Recompute bounds after modification
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
    }
}

// Helper to log to screen
function logToScreen(msg: string, isError = false) {
    const debugEl = document.getElementById('debug-console');
    if (debugEl) {
        debugEl.style.display = 'block';
        const line = document.createElement('div');
        line.textContent = `> ${msg}`;
        if (isError) line.style.color = '#ff4444';
        debugEl.appendChild(line);
        debugEl.scrollTop = debugEl.scrollHeight;
    }
    if (isError) console.error(msg);
    else console.log(msg);
}

// Sidebar Logic
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const closeBtn = document.getElementById('sidebar-close');

    if (sidebar && toggleBtn && closeBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.remove('closed');
        });

        closeBtn.addEventListener('click', () => {
            sidebar.classList.add('closed');
        });
    }
}

// Load models from JSON and populate sidebar
async function loadModelList() {
    const listContainer = document.getElementById('model-list');
    if (!listContainer) {
        logToScreen('Model list container not found!', true);
        return;
    }

    try {
        const baseUrl = (import.meta as any).env?.BASE_URL || './';
        logToScreen(`Base URL: ${baseUrl}`);
        
        const modelsUrl = `${baseUrl}models.json?t=${Date.now()}`;
        logToScreen(`Fetching models from: ${modelsUrl}`);

        const response = await fetch(modelsUrl);
        if (!response.ok) throw new Error(`Failed to load models list (${response.status})`);
        
        const models = await response.json();
        logToScreen(`Models list loaded: ${models.length} models found`);

        // Group models by folder
        const groups: Record<string, any[]> = {};
        models.forEach((m: { name: string; path: string; folder?: string }) => {
            const folder = m.folder || 'General';
            if (!groups[folder]) groups[folder] = [];
            groups[folder].push(m);
        });

        // Clear container
        listContainer.innerHTML = '';

        // Render groups
        let firstModelPath: string | null = null;

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
                if (!firstModelPath) firstModelPath = m.path;

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

        // Auto-load first model
        if (firstModelPath) {
            logToScreen(`Auto-loading first model: ${firstModelPath}`);
            const firstItem = document.querySelector(`.model-item[data-path="${firstModelPath}"]`) as HTMLElement;
            if (firstItem) {
                await toggleModel(firstModelPath, baseUrl, firstItem);
            }
        }

    } catch (err) {
        logToScreen(`Error loading model list: ${err}`, true);
        alert('Error loading model list: ' + (err as Error).message);
    }
}

async function toggleModel(path: string, baseUrl: string, liElement: HTMLElement) {
    const toggleIcon = liElement.querySelector('.visibility-toggle i');
    
    // Check if already loaded
    if (loadedModels.has(path)) {
        const model = loadedModels.get(path);
        model.visible = !model.visible;
        
        // Update UI
        if (model.visible) {
            liElement.classList.add('visible');
            toggleIcon?.classList.replace('fa-eye-slash', 'fa-eye');
        } else {
            liElement.classList.remove('visible');
            toggleIcon?.classList.replace('fa-eye', 'fa-eye-slash');
        }
        
        logToScreen(`Toggled model visibility: ${path} -> ${model.visible}`);
        return;
    }

    // Not loaded, load it
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';
    
    try {
        logToScreen(`Downloading model from path: ${path}`);
        
        // Encode path parts to handle spaces
        const encodedPath = path.split('/').map(part => encodeURIComponent(part)).join('/');
        const fullPath = `${baseUrl}${encodedPath}`;
        
        logToScreen(`Full URL: ${fullPath}`);
        
        // Load the model
        // loadIfc now handles scene addition and map tracking
        await loadIfc(fullPath, path);
        
        // Update UI to loaded/visible state
        liElement.classList.add('visible');
        toggleIcon?.classList.replace('fa-eye-slash', 'fa-eye');
        
    } catch (error) {
        logToScreen(`Error fetching model: ${error}`, true);
        alert('Error downloading model: ' + (error as Error).message);
    } finally {
        if (overlay) overlay.style.display = 'none';
    }
}

logToScreen('Script initializing...');
initSidebar();
loadModelList();

const input = document.getElementById('file-input') as HTMLInputElement;
if (input) {
    input.addEventListener('change', async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            // Use filename as unique path for local files
            const path = `local/${file.name}`;
            await loadIfc(url, path);
        }
    }, false);
}
