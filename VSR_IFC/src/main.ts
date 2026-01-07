import * as THREE from 'three';
import { IFCLoader } from 'web-ifc-three/IFCLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import './style.css';

// --- VISUAL LOGGER SETUP ---
const debugConsole = document.getElementById('debug-console');
// Attach to window to ensure global availability and avoid ReferenceErrors
(window as any).logToScreen = function(message: string, isError = false) {
    if (debugConsole) {
        const div = document.createElement('div');
        div.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        if (isError) div.style.color = 'red';
        debugConsole.appendChild(div);
        debugConsole.scrollTop = debugConsole.scrollHeight;
    }
    // Also log to browser console
    if (isError) console.error(message);
    else console.log(message);
};

const logToScreen = (window as any).logToScreen;

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa0a0a0);
scene.fog = new THREE.Fog(0xa0a0a0, 10, 50);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
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
// EXPLICITLY set the WASM path to check if this is the issue
// Using ./wasm/ assumes index.html is at root and wasm folder is next to it
ifcLoader.ifcManager.setWasmPath('./wasm/'); 

let currentModel: THREE.Object3D | null = null;

async function loadModel(url: string) {
    logToScreen(`[loadModel] Starting load for: ${url}`);
    
    // Clear previous model
    if (currentModel) {
        scene.remove(currentModel);
        currentModel = null;
    }

    try {
        logToScreen(`[loadModel] Fetching...`);
        const model = await ifcLoader.loadAsync(url);
        currentModel = model;
        scene.add(model);
        logToScreen(`[loadModel] Success! Model added to scene.`);

        // Auto-center camera
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        logToScreen(`[loadModel] Model size: ${JSON.stringify(size)}`);

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2));
        
        cameraZ *= 1.5; // Add padding
        
        const direction = new THREE.Vector3()
            .subVectors(camera.position, center)
            .normalize();

        camera.position.copy(direction.multiplyScalar(cameraZ).add(center));
        camera.lookAt(center);
        
        controls.target.copy(center);
        controls.update();
        
    } catch (error: any) {
        logToScreen(`[loadModel] ERROR: ${error.message || error}`, true);
        // Also alert for visibility if console is missed
        console.error(error);
    }
}

// File Input Handler
const input = document.getElementById('file-input') as HTMLInputElement;
if (input) {
    input.addEventListener('change', async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            await loadModel(url);
        }
    }, false);
}

// Model Selector Logic
const modelSelect = document.getElementById('model-select') as HTMLSelectElement;

if (modelSelect) {
    // Fetch models.json
    fetch('./models.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(models => {
            logToScreen('Loaded models list: ' + JSON.stringify(models));
            models.forEach((model: { name: string; path: string }) => {
                const option = document.createElement('option');
                option.value = model.path; // e.g., "models/file.ifc"
                option.textContent = model.name;
                modelSelect.appendChild(option);
            });
        })
        .catch(error => {
            logToScreen('Error loading models.json: ' + error, true);
            const option = document.createElement('option');
            option.textContent = "Error loading list";
            modelSelect.appendChild(option);
        });

    // Handle selection
    modelSelect.addEventListener('change', (event) => {
        const selectedPath = (event.target as HTMLSelectElement).value;
        if (selectedPath) {
            // Ensure path is relative
            const finalPath = selectedPath.startsWith('./') ? selectedPath : `./${selectedPath}`;
            loadModel(finalPath);
        }
    });
}
