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
ifcLoader.ifcManager.setWasmPath('wasm/');

const input = document.getElementById('file-input') as HTMLInputElement;
if (input) {
    input.addEventListener('change', async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            try {
                const model = await ifcLoader.loadAsync(url);
                scene.add(model);
                console.log('Model loaded:', model);

                // Auto-center camera and fix jitter
                if (model) {
                    const box = new THREE.Box3().setFromObject(model);
                    const center = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());

                    // Move model to origin to fix floating point jitter (temblor)
                    // This is crucial for large coordinate models (BIM/GIS)
                    model.position.sub(center);

                    // Re-calculate bounds relative to new origin (0,0,0)
                    // box.setFromObject(model); // box is now centered at 0,0,0
                    
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const fov = camera.fov * (Math.PI / 180);
                    let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2)); // Basic distance calculation
                    
                    // Adjust for aspect ratio
                    cameraZ *= 2.0; // Add some padding
                    
                    // Position camera looking at origin
                    const direction = new THREE.Vector3(1, 1, 1).normalize();
                    camera.position.copy(direction.multiplyScalar(cameraZ));
                    camera.lookAt(0, 0, 0);
                    
                    // Update controls target to origin
                    controls.target.set(0, 0, 0);
                    controls.update();
                    
                    console.log('Model centered at origin. Camera distance:', cameraZ);
                }
            } catch (error) {
                console.error('Error loading IFC:', error);
            }
        }
    }, false);
}
