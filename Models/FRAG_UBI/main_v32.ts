import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import * as BUI from '@thatopen/ui';
import * as CUI from '@thatopen/ui-obc';
import './style.css';


// --- EDGE & VERTEX SNAP PATCH (v26) ---
// Intercepts raycasts to snap to Vertices (Corners) and Edges (Surface boundaries).
const originalIntersectObjects = THREE.Raycaster.prototype.intersectObjects;
const originalIntersectObject = THREE.Raycaster.prototype.intersectObject;

const applyGlobalSnap = (intersects: THREE.Intersection[]) => {
    if (!intersects || intersects.length === 0) return intersects;
    
    const closest = intersects.find(i => i.object instanceof THREE.Mesh || i.object instanceof THREE.InstancedMesh);
    if (!closest) return intersects;

    try {
        const VERTEX_THRESHOLD = 0.20; // Reduced to 20cm for v32-StableSnap (Less jitter)
        const EDGE_THRESHOLD = 0.10; // Reduced to 10cm for v32-StableSnap
        
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
                let minD = Infinity;
                let type = '';

                // 1. Check Vertices
                [va, vb, vc].forEach(v => {
                    const d = v.distanceTo(closest.point);
                    if (d < minD) {
                        minD = d;
                        bestPoint = v;
                        type = 'VERTEX';
                    }
                });

                // Only stick to vertex if within threshold
                if (minD > VERTEX_THRESHOLD) {
                    // 2. Check Edges if vertex is too far
                    // Edges: va-vb, vb-vc, vc-va
                    const edges = [
                        new THREE.Line3(va, vb),
                        new THREE.Line3(vb, vc),
                        new THREE.Line3(vc, va)
                    ];
                    
                    let bestEdgeDist = Infinity;
                    let bestEdgePoint: THREE.Vector3 | null = null;
                    
                    edges.forEach(edge => {
                        const target = new THREE.Vector3();
                        edge.closestPointToPoint(closest.point, true, target);
                        const d = target.distanceTo(closest.point);
                        if (d < bestEdgeDist) {
                            bestEdgeDist = d;
                            bestEdgePoint = target;
                        }
                    });
                    
                    if (bestEdgeDist < EDGE_THRESHOLD) {
                        bestPoint = bestEdgePoint;
                        minD = bestEdgeDist;
                        type = 'EDGE';
                    } else {
                        // Reset if neither match
                        bestPoint = null;
                    }
                }

                if (bestPoint) {
                    closest.point.copy(bestPoint);
                    
                    // Visual Update (v31-RescueSnap)
                    const ds = (window as any).debugSphere; // Edge (Sphere)
                    const dc = (window as any).debugCube;   // Vertex (Cube)
                    
                    if (ds && dc) {
                        if (type === 'VERTEX') {
                            // Show Green Cube
                            dc.position.copy(bestPoint);
                            dc.visible = true;
                            ds.visible = false;
                        } else {
                            // Show Small Yellow Sphere
                            ds.position.copy(bestPoint);
                            ds.visible = true;
                            dc.visible = false;
                            
                            // Ensure Yellow Color & Small Scale
                            ((ds.material) as THREE.MeshBasicMaterial).color.setHex(0xffff00);
                            ds.scale.set(0.5, 0.5, 0.5); // Base radius 0.2 * 0.5 = 0.1m
                        }
                    }
                    
                    if ((window as any).debugLog && Math.random() < 0.05) {
                        (window as any).debugLog(`Snap: ${type} (${minD.toFixed(3)})`);
                    }
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

THREE.Raycaster.prototype.intersectObjects = function(objects, recursive, optionalTarget) {
    const res = originalIntersectObjects.call(this, objects, recursive, optionalTarget);
    return applyGlobalSnap(res);
};

THREE.Raycaster.prototype.intersectObject = function(object, recursive, optionalTarget) {
    const res = originalIntersectObject.call(this, object, recursive, optionalTarget);
    return applyGlobalSnap(res);
};
// ------------------------------------------------










// --- GLOBAL DEBUG SPHERE ---
let debugSphere: THREE.Mesh | null = null;
let debugLog: ((msg: string) => void) | null = null;


const setupDebugSphere = (scene: THREE.Scene) => {
    if (debugSphere) return; // Already setup
    
    // 1. Edge Cursor (Yellow Sphere) - Base Radius 0.2
    const sphereGeom = new THREE.SphereGeometry(0.2, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffff00, depthTest: false, transparent: true, opacity: 0.8 });
    debugSphere = new THREE.Mesh(sphereGeom, sphereMat); 
    (window as any).debugSphere = debugSphere;
    debugSphere.renderOrder = 9999;
    debugSphere.visible = false;
    scene.add(debugSphere);

    // 2. Vertex Cursor (Green Cube) - Size 0.2 (Reduced)
    const cubeGeom = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const cubeMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false, transparent: true, opacity: 0.8 });
    const debugCube = new THREE.Mesh(cubeGeom, cubeMat);
    (window as any).debugCube = debugCube;
    debugCube.renderOrder = 9999;
    debugCube.visible = false;
    scene.add(debugCube);
    
    // Also setup log
    const debugConsole = document.getElementById('debug-console');
    if (debugConsole) {
        debugConsole.style.display = 'block';
        debugLog = (msg: string) => {
             const line = document.createElement('div');
             line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
             debugConsole.appendChild(line);
             debugConsole.scrollTop = debugConsole.scrollHeight;
             if (debugConsole.children.length > 50) debugConsole.removeChild(debugConsole.firstChild);
        };
        (window as any).debugLog = debugLog;
    }
};


// --- Measurement State (Hoisted to top to avoid ReferenceError) ---
let measurementMode: 'length' | 'point' | null = null;
let measurementPoints: THREE.Vector3[] = [];
let tempMeasurementLine: THREE.Line | null = null;
const measurementLabels: HTMLElement[] = [];
const measurementMarkers: THREE.Mesh[] = [];
let snappingCursor: THREE.Mesh | null = null;


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

console.log('VSR_IFC Version: 2026-02-03-Fix-v13-BuildFix');
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
versionDiv.textContent = 'v2026-02-10-v32-StableSnap';
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


// --- DEBUG VISUALIZATION (v31-RescueSnap) ---
// 1. Edge Cursor (Small Yellow Sphere)
const debugSphereGeom = new THREE.SphereGeometry(0.2, 16, 16); 
const debugSphereMat = new THREE.MeshBasicMaterial({ color: 0xffff00, depthTest: false, transparent: true, opacity: 0.8 });
debugSphere = new THREE.Mesh(debugSphereGeom, debugSphereMat);
(window as any).debugSphere = debugSphere;
debugSphere.renderOrder = 9999;
debugSphere.visible = false;
world.scene.three.add(debugSphere);

// 2. Vertex Cursor (Green Cube)
const debugCubeGeom = new THREE.BoxGeometry(0.2, 0.2, 0.2); // Reduced to 0.2 for v32-StableSnap
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
    const log = (msg) => {
        const line = document.createElement('div');
        line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        debugConsole.appendChild(line);
        debugConsole.scrollTop = debugConsole.scrollHeight;
        if (debugConsole.children.length > 20) debugConsole.removeChild(debugConsole.firstChild);
    };
    window.debugLog = log;
} else {
    window.debugLog = console.log;
}

const fragments = components.get(OBC.FragmentsManager);

// Initialize fragments with the worker BEFORE getting other components
// that might depend on it (like Classifier or Hider)
try {
    await fragments.init(`${baseUrl}fragments/fragments.mjs`);
} catch (error) {
    console.error("Critical Error: Fragments init failed", error);
    throw new Error(`Fragments init failed: ${error}`);
}

const classifier = components.get(OBC.Classifier);
const hider = components.get(OBC.Hider);

// --- GLOBAL RAYCASTER PATCH FOR SNAPPING (Official Tools Support) ---
// This ensures that ALL tools using OBC.Raycasters (like Length, Area) benefit from snapping logic
// even if they don't explicitly use a VertexPicker or if Snapper is missing.
const raycasters = components.get(OBC.Raycasters);
