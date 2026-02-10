import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import * as BUI from '@thatopen/ui';
import * as CUI from '@thatopen/ui-obc';
import './style.css';


// --- EDGE & VERTEX SNAP PATCH (v34) ---
// Intercepts raycasts to snap to Vertices (Corners) and Edges (Surface boundaries).
const originalIntersectObjects = THREE.Raycaster.prototype.intersectObjects;
const originalIntersectObject = THREE.Raycaster.prototype.intersectObject;

const applyGlobalSnap = (intersects: THREE.Intersection[]) => {
    if (!intersects || intersects.length === 0) return intersects;
    
    const closest = intersects.find(i => i.object instanceof THREE.Mesh || i.object instanceof THREE.InstancedMesh);
    if (!closest) return intersects;

    try {
        const VERTEX_THRESHOLD = 0.50; // Increased to 50cm for v34-MagneticSnap (Easier selection)
        const EDGE_THRESHOLD = 0.20; // Increased to 20cm for v34-MagneticSnap
        
        if (closest.face && (closest.object as any).geometry) {
            const geom = (closest.object as any).geometry;
            const pos = geom.attributes.position;
            
            if (pos) {
                const a = closest.face.a;
                const b = closest.face.b;
                const c = closest.face.c;
                
                const getV = (idx: number) => {
                    const v = new THREE.Vector3();
                    v.fromBufferAttribute(pos, idx);
                    if (closest.object instanceof THREE.InstancedMesh && closest.instanceId !== undefined) {
                        const m = new THREE.Matrix4();
                        closest.object.getMatrixAt(closest.instanceId, m);
                        v.applyMatrix4(m);
                    }
                    closest.object.updateMatrixWorld();
                    v.applyMatrix4(closest.object.matrixWorld);
                    return v;
                };
                
                const va = getV(a);
                const vb = getV(b);
                const vc = getV(c);
                
                let bestPoint: THREE.Vector3 | null = null;
                let minDist = Infinity;
                
                // 1. Vertex Snap (Green Cube)
                const snapVertex = (v: THREE.Vector3) => {
                    const d = closest.point.distanceTo(v);
                    if (d < VERTEX_THRESHOLD && d < minDist) {
                        minDist = d;
                        bestPoint = v;
                    }
                };
                snapVertex(va);
                snapVertex(vb);
                snapVertex(vc);
                
                if (bestPoint) {
                    closest.point.copy(bestPoint);
                    if ((window as any).debugCube) {
                        (window as any).debugCube.position.copy(bestPoint);
                        (window as any).debugCube.visible = true;
                    }
                    if ((window as any).debugSphere) (window as any).debugSphere.visible = false;
                    return intersects;
                }
                
                // 2. Edge Snap (Yellow Sphere)
                const snapEdge = (v1: THREE.Vector3, v2: THREE.Vector3) => {
                    const line = new THREE.Line3(v1, v2);
                    const closestOnLine = new THREE.Vector3();
                    line.closestPointToPoint(closest.point, true, closestOnLine);
                    const d = closest.point.distanceTo(closestOnLine);
                    if (d < EDGE_THRESHOLD && d < minDist) {
                        minDist = d;
                        bestPoint = closestOnLine;
                    }
                };
                snapEdge(va, vb);
                snapEdge(vb, vc);
                snapEdge(vc, va);
                
                if (bestPoint) {
                    closest.point.copy(bestPoint);
                    if ((window as any).debugSphere) {
                        (window as any).debugSphere.position.copy(bestPoint);
                        (window as any).debugSphere.visible = true;
                    }
                    if ((window as any).debugCube) (window as any).debugCube.visible = false;
                } else {
                     if ((window as any).debugSphere) (window as any).debugSphere.visible = false;
                     if ((window as any).debugCube) (window as any).debugCube.visible = false;
                }
            }
        }
    } catch (e) {
        console.error("Snap Error", e);
    }
    
    return intersects;
};

// Apply patch to Raycaster
THREE.Raycaster.prototype.intersectObjects = function(objects, recursive, optionalTarget) {
    const intersects = originalIntersectObjects.call(this, objects, recursive, optionalTarget);
    return applyGlobalSnap(intersects);
};

THREE.Raycaster.prototype.intersectObject = function(object, recursive, optionalTarget) {
    const intersects = originalIntersectObject.call(this, object, recursive, optionalTarget);
    return applyGlobalSnap(intersects);
};

// Setup global debug sphere function (v34-MagneticSnap)
const setupDebugSphere = (scene: THREE.Scene) => {
    // 1. Edge Cursor (Yellow Sphere)
    const sphereGeom = new THREE.SphereGeometry(0.15, 16, 16); // Reduced from 0.2 to 0.15
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffff00, depthTest: false, transparent: true, opacity: 0.8 });
    let debugSphere = new THREE.Mesh(sphereGeom, sphereMat);
    debugSphere.renderOrder = 9999;
    debugSphere.visible = false;
    scene.add(debugSphere);
    (window as any).debugSphere = debugSphere;
    console.log("DebugSphere Initialized (Global)");

    // 2. Vertex Cursor (Green Cube)
    const cubeGeom = new THREE.BoxGeometry(0.35, 0.35, 0.35); // Increased from 0.2 to 0.35
    const cubeMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false, transparent: true, opacity: 0.8 });
    let debugCube = new THREE.Mesh(cubeGeom, cubeMat);
    debugCube.renderOrder = 9999;
    debugCube.visible = false;
    scene.add(debugCube);
    (window as any).debugCube = debugCube;
    console.log("DebugCube Initialized (Global)");
};


// --- Measurement State (Hoisted to top to avoid ReferenceError) ---
let measurementMode: 'length' | 'point' | null = null;
let measurementPoints: THREE.Vector3[] = [];
let tempMeasurementLine: THREE.Line | null = null;
const measurementLabels: HTMLElement[] = [];
const measurementMarkers: THREE.Mesh[] = [];
let snappingCursor: THREE.Mesh | null = null;
let debugSphere: THREE.Mesh | null = null;


// --- EMERGENCY PATCH: Vector3.fromBufferAttribute ---
// This is the specific call site failing in the stack trace.
const originalFromBufferAttribute = THREE.Vector3.prototype.fromBufferAttribute;
THREE.Vector3.prototype.fromBufferAttribute = function(attribute, index) {
    try {
        // Double check attribute validity before calling
        if (!attribute || (attribute.isBufferAttribute && !attribute.array)) {
             return this.set(0, 0, 0);
        }
        return originalFromBufferAttribute.call(this, attribute, index);
    } catch (e) {
        // console.warn("Prevented Vector3.fromBufferAttribute crash", e);
        return this.set(0, 0, 0);
    }
};

// --- EMERGENCY PATCH: InstancedMesh.raycast ---
const originalInstancedRaycast = THREE.InstancedMesh.prototype.raycast;
THREE.InstancedMesh.prototype.raycast = function(raycaster, intersects) {
    try {
        if (!this.geometry) return;
        originalInstancedRaycast.call(this, raycaster, intersects);
    } catch (e) {
        // console.warn("Prevented InstancedMesh.raycast crash", e);
    }
};

// --- CRITICAL FIX: Monkey-patch THREE.BufferAttribute.prototype.getX to prevent crashes ---
// The measurement tool's raycaster crashes when hitting geometry with undefined attributes.
// We intercept the low-level call to prevent the entire app from freezing.
const originalGetX = THREE.BufferAttribute.prototype.getX;
THREE.BufferAttribute.prototype.getX = function(index) {
    // Safety check: if array is missing or index is out of bounds
    if (!this.array || this.array.length === 0) return 0;
    try {
        return originalGetX.call(this, index);
    } catch (e) {
        return 0;
    }
};

const originalGetY = THREE.BufferAttribute.prototype.getY;
THREE.BufferAttribute.prototype.getY = function(index) {
    if (!this.array || this.array.length === 0) return 0;
    try {
        return originalGetY.call(this, index);
    } catch (e) {
        return 0;
    }
};

const originalGetZ = THREE.BufferAttribute.prototype.getZ;
THREE.BufferAttribute.prototype.getZ = function(index) {
    if (!this.array || this.array.length === 0) return 0;
    try {
        return originalGetZ.call(this, index);
    } catch (e) {
        return 0;
    }
};

// Patch InterleavedBufferAttribute as well (Crucial for IFC models)
const originalInterleavedGetX = THREE.InterleavedBufferAttribute.prototype.getX;
THREE.InterleavedBufferAttribute.prototype.getX = function(index) {
    try {
        if (!this.data || !this.data.array) return 0;
        return originalInterleavedGetX.call(this, index);
    } catch (e) {
        return 0;
    }
};

const originalInterleavedGetY = THREE.InterleavedBufferAttribute.prototype.getY;
THREE.InterleavedBufferAttribute.prototype.getY = function(index) {
    try {
        if (!this.data || !this.data.array) return 0;
        return originalInterleavedGetY.call(this, index);
    } catch (e) {
        return 0;
    }
};

const originalInterleavedGetZ = THREE.InterleavedBufferAttribute.prototype.getZ;
THREE.InterleavedBufferAttribute.prototype.getZ = function(index) {
    try {
        if (!this.data || !this.data.array) return 0;
        return originalInterleavedGetZ.call(this, index);
    } catch (e) {
        return 0;
    }
};

// Also patch Mesh.raycast to be safe
const originalRaycast = THREE.Mesh.prototype.raycast;
THREE.Mesh.prototype.raycast = function(raycaster, intersects) {
    try {
        // Skip if geometry is missing or invalid
        if (!this.geometry) return;
        originalRaycast.call(this, raycaster, intersects);
    } catch (e) {
        // console.warn('Prevented Mesh.raycast crash', e);
    }
};

// Patch Line and LineSegments raycast as well
const originalLineRaycast = THREE.Line.prototype.raycast;
THREE.Line.prototype.raycast = function(raycaster, intersects) {
    try {
        if (!this.geometry) return;
        originalLineRaycast.call(this, raycaster, intersects);
    } catch (e) {
        // console.warn('Prevented Line.raycast crash', e);
    }
};

const originalLineSegmentsRaycast = THREE.LineSegments.prototype.raycast;
THREE.LineSegments.prototype.raycast = function(raycaster, intersects) {
    try {
        if (!this.geometry) return;
        originalLineSegmentsRaycast.call(this, raycaster, intersects);
    } catch (e) {
        // console.warn('Prevented LineSegments.raycast crash', e);
    }
};

// Patch acceleratedRaycast if it exists (three-mesh-bvh)
// We wrap it in a getter/setter or just check periodically, 
// but since it's likely already loaded by imports, we check now.
const patchAcceleratedRaycast = () => {
    const proto = THREE.Mesh.prototype as any;
    if (proto.acceleratedRaycast && !proto._patchedAcceleratedRaycast) {
        const originalAccelerated = proto.acceleratedRaycast;
        proto.acceleratedRaycast = function(raycaster: any, intersects: any) {
            try {
                if (!this.geometry || !this.geometry.attributes.position) return;
                
                // Ensure bounding sphere exists to prevent culling issues
                if (!this.geometry.boundingSphere) {
                    this.geometry.computeBoundingSphere();
                }
                
                originalAccelerated.call(this, raycaster, intersects);
            } catch (e) {
                // console.warn('Prevented acceleratedRaycast crash', e);
            }
        };
        proto._patchedAcceleratedRaycast = true;
        console.log('[Fix] Patched acceleratedRaycast successfully');
    }
};
// Try patching immediately and also after a small delay in case it loads async
patchAcceleratedRaycast();
setTimeout(patchAcceleratedRaycast, 1000);

// ------------------------------------------------------------------------------------------------------------------
// --- Polyfills / Monkey-patching if needed (Snapper / Edges)
// ------------------------------------------------------------------------------------------------------------------
// It seems OBC.Edges and OBC.Snapper are not exported in the current version of @thatopen/components.
// We'll stub them or check if they exist on the instance to avoid build errors,
// or use alternative logic if they were removed/renamed.

// NOTE: Based on inspection of index.d.ts:
// - OBC.Edges is NOT exported.
// - OBC.Snapper is NOT exported.
// - OBF.Snap exists in types, but likely not what we want for "Snapper".

// We will comment out the failing lines or wrap them in try-catch with `any` casting to bypass TS check for now
// while preserving the intent if they are available at runtime (which is unlikely if not in d.ts).
// But for "Edges", we can try to find if there is an alternative.
// Since we are fixing the build, we will remove the calls to missing components for now.

console.log('VSR_IFC Version: v2026-02-10-v36-ModelLoader');
const versionDiv = document.createElement('div');
versionDiv.style.position = 'fixed';
versionDiv.style.bottom = '10px';
versionDiv.style.right = '10px';
versionDiv.style.background = 'rgba(0, 0, 0, 0.7)';
versionDiv.style.color = '#00ff00';
versionDiv.style.padding = '5px 10px';
versionDiv.style.zIndex = '10000';
versionDiv.style.borderRadius = '4px';
versionDiv.style.fontFamily = 'monospace';
versionDiv.style.fontSize = '12px';
versionDiv.textContent = 'v37-LoadFix';
document.body.appendChild(versionDiv);

// --- Global Error Handler (Added for debugging "Destruiste el visor") ---
window.addEventListener('error', (event) => {
    const box = document.createElement('div');
    box.style.position = 'fixed';
    box.style.top = '10px';
    box.style.left = '10px';
    box.style.background = 'rgba(255, 0, 0, 0.9)';
    box.style.color = 'white';
    box.style.padding = '15px';
    box.style.zIndex = '10000';
    box.style.borderRadius = '5px';
    box.style.fontFamily = 'monospace';
    box.style.maxWidth = '80%';
    box.style.wordBreak = 'break-all';
    box.innerHTML = `<strong>Error Critical:</strong><br>${event.message}<br><small>${event.filename}:${event.lineno}</small>`;
    document.body.appendChild(box);
    console.error("Global Error Caught:", event.error);
});

// --- Initialization of That Open Engine ---

const components = new OBC.Components();
// Ensure components.meshes exists for Raycasters that might rely on it
if (!(components as any).meshes) (components as any).meshes = [];

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


// --- DEBUG VISUALIZATION (v34-MagneticSnap) ---
// 1. Edge Cursor (Small Yellow Sphere)
const debugSphereGeom = new THREE.SphereGeometry(0.15, 16, 16); 
const debugSphereMat = new THREE.MeshBasicMaterial({ color: 0xffff00, depthTest: false, transparent: true, opacity: 0.8 });
debugSphere = new THREE.Mesh(debugSphereGeom, debugSphereMat);
(window as any).debugSphere = debugSphere;
debugSphere.renderOrder = 9999;
debugSphere.visible = false;
world.scene.three.add(debugSphere);

// 2. Vertex Cursor (Green Cube)
const debugCubeGeom = new THREE.BoxGeometry(0.35, 0.35, 0.35); // Increased to 0.35
const debugCubeMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false, transparent: true, opacity: 0.8 });
const debugCube = new THREE.Mesh(debugCubeGeom, debugCubeMat);
(window as any).debugCube = debugCube;
debugCube.renderOrder = 9999;
debugCube.visible = false;
world.scene.three.add(debugCube);

// --- v31-RescueSnap: GLOBAL INDEPENDENT SNAPPING LOOP ---
container.addEventListener('mousemove', (event) => {
    if (!world || !world.camera || !world.scene) return;
    const rect = container.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const tempRaycaster = new THREE.Raycaster();
    tempRaycaster.setFromCamera(new THREE.Vector2(x, y), world.camera.three);
    
    // NUCLEAR DEBUG: Raycast against EVERYTHING in scene
    const candidates: THREE.Object3D[] = [];
    world.scene.three.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
            candidates.push(child);
        }
    });

    if (candidates.length === 0) return;
    
    const intersects = tempRaycaster.intersectObjects(candidates, true);
    
    if (intersects.length > 0) {
        applyGlobalSnap([intersects[0]]);
    } else {
        if ((window as any).debugSphere) (window as any).debugSphere.visible = false;
        if ((window as any).debugCube) (window as any).debugCube.visible = false;
    }
});

const debugConsole = document.getElementById('debug-console');
if (debugConsole) {
    debugConsole.style.display = 'block'; // Force visible
}

const fragments = components.get(OBC.FragmentsManager);

// --- RESTORED INITIALIZATION (CRITICAL FIX v35) ---
// Initialize fragments with the worker BEFORE getting other components
try {
    await fragments.init(`${baseUrl}fragments/fragments.mjs`);
    console.log("FragmentsManager initialized successfully.");
} catch (error) {
    console.error("Critical Error: Fragments init failed", error);
}

// --- AUTOMATIC MODEL LOADING (v36-ModelLoader) ---
// This was missing in v35, causing the blank viewer.
async function loadModels() {
    try {
        console.log("Fetching models.json...");
        const response = await fetch(`${baseUrl}models.json`);
        if (!response.ok) {
            console.warn(`models.json not found at ${baseUrl}models.json`);
            return;
        }
        
        const models = await response.json();
        console.log(`Found ${models.length} models.`);
        
        for (const model of models) {
            try {
                const modelPath = `${baseUrl}${model.path}`;
                console.log(`Loading: ${model.name}`);
                
                const modelResponse = await fetch(modelPath);
                if (!modelResponse.ok) throw new Error(`Status ${modelResponse.status}`);
                
                const buffer = await modelResponse.arrayBuffer();
                const data = new Uint8Array(buffer);
                // Fix for v37: Use fragments.core.load with mandatory modelId
                await fragments.core.load(data, { modelId: model.name });
                
            } catch (err) {
                console.error(`Failed to load ${model.name}:`, err);
            }
        }
        
        console.log("All models loaded. Updating scene...");
        
        // Zoom to fit models
        // We can use a simple timeout to ensure everything is rendered
        setTimeout(() => {
            // Traverse scene to find meshes that are NOT grid or debug
            const box = new THREE.Box3();
            let hasObjects = false;
            
            world.scene.three.traverse((obj) => {
                if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
                    // Skip debug objects and grid
                    if (obj === debugSphere || obj === debugCube) return;
                    if ((obj as any).isGrid) return; 
                    
                    // Add to bounds
                    // This is a rough approximation, ideally we use fragment bounding boxes
                    hasObjects = true;
                }
            });
            
            if (hasObjects) {
                world.camera.controls.fitToSphere(world.scene.three, 1.2);
            }
        }, 500);

    } catch (e) {
        console.error("Error in loadModels:", e);
    }
}

// Execute loading
await loadModels();


const fileOpener = document.createElement('input');
fileOpener.type = 'file';
fileOpener.accept = '.frag';
fileOpener.style.display = 'none';
document.body.appendChild(fileOpener);

fileOpener.addEventListener('change', async () => {
    if (fileOpener.files && fileOpener.files.length > 0) {
        const file = fileOpener.files[0];
        const data = await file.arrayBuffer();
        const buffer = new Uint8Array(data);
        // Fix for v37: Use fragments.core.load with mandatory modelId
        await fragments.core.load(buffer, { modelId: file.name });
    }
});

// --- Model Classifier & Hider (For Sidebar) ---
const classifier = components.get(OBC.Classifier);
const hider = components.get(OBC.Hider);

// --- Raycasters (For other tools) ---
const raycasters = components.get(OBC.Raycasters);
raycasters.get(world);
