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
    COORDINATE_TO_ORIGIN: true,
    USE_FAST_BOOLS: true
});

let currentModel: any = null;

async function loadIfc(url: string) {
    if (currentModel) {
        scene.remove(currentModel);
        currentModel = null;
    }

    try {
        console.log('Attempting to load IFC from:', url);
        const model = await ifcLoader.loadAsync(url);
        currentModel = model;
        scene.add(model);
        console.log('Model loaded:', model);

        // Auto-center camera
        if (model) {
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            // Since COORDINATE_TO_ORIGIN is used, center should be near (0,0,0)
            // But we still center camera on the actual geometry center just in case
            
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
    } catch (error) {
        console.error('Error loading IFC:', error);
        alert('Error loading model: ' + (error as Error).message);
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

// Load models from JSON
async function loadModelList() {
    const select = document.getElementById('model-select') as HTMLSelectElement;
    if (!select) {
        logToScreen('Model select element not found!', true);
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

        models.forEach((m: { name: string; path: string }) => {
            const option = document.createElement('option');
            option.value = m.path;
            option.textContent = m.name;
            select.appendChild(option);
        });

        select.addEventListener('change', async (e) => {
            const path = (e.target as HTMLSelectElement).value;
            if (path) {
                const overlay = document.getElementById('loading-overlay');
                if (overlay) overlay.style.display = 'flex';
                
                try {
                    logToScreen(`Downloading model from path: ${path}`);
                    
                    // Encode path parts to handle spaces
                    const encodedPath = path.split('/').map(part => encodeURIComponent(part)).join('/');
                    const fullPath = `${baseUrl}${encodedPath}`;
                    
                    logToScreen(`Full URL: ${fullPath}`);
                    
                    const res = await fetch(fullPath);
                    if (!res.ok) throw new Error(`Error downloading model (${res.status})`);
                    
                    const blob = await res.blob();
                    logToScreen(`Model downloaded, blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
                    
                    if (blob.size === 0) throw new Error('Downloaded model is empty');

                    const blobUrl = URL.createObjectURL(blob);
                    
                    await loadIfc(blobUrl);
                } catch (error) {
                    logToScreen(`Error fetching model: ${error}`, true);
                    alert('Error downloading model: ' + (error as Error).message);
                } finally {
                    if (overlay) overlay.style.display = 'none';
                }
            }
        });

        // Auto-load first model if available
        if (models.length > 0) {
            select.value = models[0].path;
            select.dispatchEvent(new Event('change'));
        }

    } catch (err) {
        logToScreen(`Error loading model list: ${err}`, true);
        alert('Error loading model list: ' + (err as Error).message);
    }
}

// Ensure DOM is fully loaded
// window.addEventListener('DOMContentLoaded', () => {
//     loadModelList();
// });

logToScreen('Script initializing...');
loadModelList();

const input = document.getElementById('file-input') as HTMLInputElement;
if (input) {
    input.addEventListener('change', async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            loadIfc(url);
        }
    }, false);
}
