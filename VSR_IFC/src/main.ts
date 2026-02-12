import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import * as BUI from '@thatopen/ui';
import * as CUI from '@thatopen/ui-obc';
import './style.css';

// --- Global Error Handler (Must be first) ---
window.addEventListener('error', (event) => {
    console.error("Global Error:", event.error);
    const debugConsole = document.getElementById('debug-console');
    if (debugConsole) {
        debugConsole.style.display = 'block';
        const line = document.createElement('div');
        line.style.color = '#ff4444';
        line.textContent = `[CRITICAL ERROR] ${event.message} at ${event.filename}:${event.lineno}`;
        debugConsole.appendChild(line);
    }
});

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

// --- Measurement State ---
let activeTool: 'none' | 'angle' | 'slope' | 'point' = 'none';
const customMeshes: THREE.Mesh[] = [];

// --- UI & World Setup ---
const container = document.getElementById('app')!;
const components = new OBC.Components();
const worlds = components.get(OBC.Worlds);
const world = worlds.create();

// Use SimpleScene/Renderer/Camera to avoid complex dependency crashes
world.scene = new OBC.SimpleScene(components);
world.renderer = new OBC.SimpleRenderer(components, container);
world.camera = new OBC.SimpleCamera(components);

components.init();

// --- Setup Scene (Lights & Background) ---
(world.scene as OBC.SimpleScene).setup();
world.scene.three.background = new THREE.Color(0x202124); // Dark gray background

// --- Setup Grid ---
const grids = components.get(OBC.Grids);
grids.create(world);

// --- Camera Initial Position ---
world.camera.controls.setLookAt(5, 5, 5, 0, 0, 0);

const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

// --- Cursor Setup ---
const cursorGeom = new THREE.SphereGeometry(0.15, 16, 16);
const cursorMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, depthTest: false, transparent: true, opacity: 0.8 });
const cursorMesh = new THREE.Mesh(cursorGeom, cursorMat);
cursorMesh.visible = false;
world.scene.three.add(cursorMesh);

// --- Snap Visual Feedback ---
let snapMarker: THREE.Mesh | null = null;
let snapLine: THREE.Line | null = null;

function createSnapMarker() {
    if (snapMarker) return;
    
    // Marcador más preciso (esfera más pequeña)
    const geometry = new THREE.SphereGeometry(0.05, 16, 16);
    const material = new THREE.MeshBasicMaterial({ 
        color: 0xFFD700, // Gold for HyperSnap
        depthTest: false, 
        transparent: true, 
        opacity: 1.0 
    });
    snapMarker = new THREE.Mesh(geometry, material);
    snapMarker.visible = false;
    snapMarker.renderOrder = 999;
    world.scene.three.add(snapMarker);
    
    // Línea visual más sutil
    const lineGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(), 
        new THREE.Vector3()
    ]);
    const lineMat = new THREE.LineBasicMaterial({ 
        color: 0xFFD700, 
        depthTest: false, 
        transparent: true, 
        opacity: 0.5 
    });
    snapLine = new THREE.Line(lineGeom, lineMat);
    snapLine.visible = false;
    snapLine.renderOrder = 998;
    world.scene.three.add(snapLine);
}

// --- Debug Panel ---
const debugPanel = document.getElementById('debug-console');
const logToScreen = (msg: string) => {
    if (debugPanel) {
        debugPanel.style.display = 'block';
        const line = document.createElement('div');
        line.textContent = `[UI] ${msg}`;
        debugPanel.appendChild(line);
        debugPanel.scrollTop = debugPanel.scrollHeight;
    }
    console.log('[UI]', msg);
};

// --- GLOBAL RAYCASTER PATCH FOR SNAPPING (NUEVA IMPLEMENTACIÓN 3D MULTI-OBJETO) ---
const raycasters = components.get(OBC.Raycasters);
const simpleRaycaster = raycasters.get(world);
// No necesitamos originalCastRayToObjects si vamos a re-implementar la lógica de intersección para obtener múltiples hits
// const originalCastRayToObjects = simpleRaycaster.castRayToObjects.bind(simpleRaycaster);

// Estado para sticky snap
let lastSnapped: { object: THREE.Object3D; point: THREE.Vector3 } | null = null;
let lastPointerNDC: THREE.Vector2 | null = null;

interface SnapCandidate {
    point: THREE.Vector3;
    type: 'vertex' | 'edge' | 'intersection' | 'face' | 'corner';
    distanceToRay: number;
    distanceToCamera: number;
    intersection: THREE.Intersection;
}

const getWorldUnitsPerPixel = (distanceToTarget: number) => {
    const renderer = world.renderer?.three as THREE.WebGLRenderer | undefined;
    const canvas = renderer?.domElement;
    const viewportHeight = Math.max(1, canvas?.clientHeight || window.innerHeight || 1);
    const camera = world.camera.three as THREE.PerspectiveCamera | THREE.OrthographicCamera;

    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        const perspective = camera as THREE.PerspectiveCamera;
        const fovRad = THREE.MathUtils.degToRad(perspective.fov);
        const viewHeight = 2 * Math.tan(fovRad / 2) * Math.max(distanceToTarget, 0.001);
        return viewHeight / viewportHeight;
    }

    const ortho = camera as THREE.OrthographicCamera;
    const viewHeight = (ortho.top - ortho.bottom) / Math.max(ortho.zoom, 0.001);
    return viewHeight / viewportHeight;
};

const computeDistanceToRay = (ray: THREE.Ray, point: THREE.Vector3) => {
    const toPoint = point.clone().sub(ray.origin);
    const proj = toPoint.dot(ray.direction);
    const closest = ray.origin.clone().add(ray.direction.clone().multiplyScalar(proj));
    return point.distanceTo(closest);
};

const pushSnapCandidate = (
    point: THREE.Vector3,
    type: SnapCandidate['type'],
    intersection: THREE.Intersection,
    ray: THREE.Ray,
    out: SnapCandidate[]
) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) return;
    out.push({
        point,
        type,
        distanceToRay: computeDistanceToRay(ray, point),
        distanceToCamera: point.distanceTo(ray.origin),
        intersection
    });
};

const getClosestPointOnSegmentToRay = (a: THREE.Vector3, b: THREE.Vector3, ray: THREE.Ray) => {
    const pointOnRay = new THREE.Vector3();
    const pointOnSegment = new THREE.Vector3();
    ray.distanceSqToSegment(a, b, pointOnRay, pointOnSegment);
    return pointOnSegment;
};

const getSnapCandidatesFromIntersection = (valid: THREE.Intersection, ray: THREE.Ray, candidatesOut: SnapCandidate[]) => {
    if (valid.face && (valid.object instanceof THREE.Mesh || valid.object instanceof THREE.InstancedMesh)) {
        const geom = (valid.object as any).geometry;
        const pos = geom?.attributes?.position;
        
        // --- Strategy 1: Bounding Box Corners (Smart Corner Snap) ---
        // Good for columns, beams, plates where vertices might be messy but BB is clean
        if (geom && !geom.boundingBox) geom.computeBoundingBox();
        if (geom && geom.boundingBox) {
            const bbox = geom.boundingBox;
            const corners = [
                new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.min.z),
                new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.min.z),
                new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.min.z),
                new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.max.z),
                new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.min.z),
                new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.max.z),
                new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.max.z),
                new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.max.z),
            ];
            
            const instanceMatrix = (valid.object instanceof THREE.InstancedMesh && valid.instanceId !== undefined)
                ? (() => {
                    const m = new THREE.Matrix4();
                    valid.object.getMatrixAt(valid.instanceId, m);
                    return m;
                })()
                : null;

            for (const corner of corners) {
                if (instanceMatrix) corner.applyMatrix4(instanceMatrix);
                corner.applyMatrix4(valid.object.matrixWorld);
                pushSnapCandidate(corner, 'corner', valid, ray, candidatesOut);
            }
        }

        // --- Strategy 2: Face Vertices ---
        if (pos && pos.count > 0) {
            // Global Vertex Search for small meshes (Smart Snap)
            // Increased limit to 10000 for better usability
            if (pos.count < 10000) {
                 const instanceMatrix = (valid.object instanceof THREE.InstancedMesh && valid.instanceId !== undefined)
                    ? (() => {
                        const m = new THREE.Matrix4();
                        valid.object.getMatrixAt(valid.instanceId, m);
                        return m;
                    })()
                    : null;
                 
                 for (let i = 0; i < pos.count; i++) {
                     const v = new THREE.Vector3().fromBufferAttribute(pos, i);
                     if (instanceMatrix) v.applyMatrix4(instanceMatrix);
                     v.applyMatrix4(valid.object.matrixWorld);
                     pushSnapCandidate(v, 'vertex', valid, ray, candidatesOut);
                 }
            } else {
                // Fallback to face vertices for huge meshes
                const maxIndex = pos.count - 1;
                const indices = [valid.face.a, valid.face.b, valid.face.c]
                    .filter(i => i >= 0 && i <= maxIndex);
                
                const instanceMatrix = (valid.object instanceof THREE.InstancedMesh && valid.instanceId !== undefined)
                    ? (() => {
                        const m = new THREE.Matrix4();
                        valid.object.getMatrixAt(valid.instanceId, m);
                        return m;
                    })()
                    : null;

                const vertices: THREE.Vector3[] = [];
                for (const idx of indices) {
                    const v = new THREE.Vector3().fromBufferAttribute(pos, idx);
                    if (instanceMatrix) v.applyMatrix4(instanceMatrix);
                    v.applyMatrix4(valid.object.matrixWorld);
                    if (Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)) {
                        vertices.push(v);
                        pushSnapCandidate(v, 'vertex', valid, ray, candidatesOut);
                    }
                }
            }

            // Punto exacto de impacto en la cara como fallback
            pushSnapCandidate(valid.point.clone(), 'face', valid, ray, candidatesOut);
        }
    }
};

const addElementIntersectionCandidates = (
    relevantIntersections: THREE.Intersection[],
    ray: THREE.Ray,
    out: SnapCandidate[],
    cameraDistance: number
) => {
    const extent = Math.max(1, cameraDistance * 2);
    for (let i = 0; i < relevantIntersections.length; i++) {
        for (let j = i + 1; j < relevantIntersections.length; j++) {
            const a = relevantIntersections[i];
            const b = relevantIntersections[j];
            if (!a.face || !b.face) continue;
            if (a.object === b.object) continue;

            const n1 = a.face.normal.clone().transformDirection(a.object.matrixWorld).normalize();
            const n2 = b.face.normal.clone().transformDirection(b.object.matrixWorld).normalize();
            const lineDir = n1.clone().cross(n2);
            if (lineDir.lengthSq() < 1e-8) continue;
            lineDir.normalize();

            const planeA = new THREE.Plane().setFromNormalAndCoplanarPoint(n1, a.point);
            const planeB = new THREE.Plane().setFromNormalAndCoplanarPoint(n2, b.point);
            if (Math.abs(planeA.distanceToPoint(b.point)) > extent) continue;

            const inPlaneDir = n1.clone().cross(lineDir).normalize();
            if (inPlaneDir.lengthSq() < 1e-8) continue;

            const testLine = new THREE.Line3(
                a.point.clone().addScaledVector(inPlaneDir, -extent),
                a.point.clone().addScaledVector(inPlaneDir, extent)
            );

            const linePoint = new THREE.Vector3();
            const hasPoint = planeB.intersectLine(testLine, linePoint);
            if (!hasPoint) continue;

            const segA = linePoint.clone().addScaledVector(lineDir, -extent);
            const segB = linePoint.clone().addScaledVector(lineDir, extent);
            const pointOnRay = new THREE.Vector3();
            const pointOnLine = new THREE.Vector3();
            ray.distanceSqToSegment(segA, segB, pointOnRay, pointOnLine);
            pushSnapCandidate(pointOnLine, 'intersection', a, ray, out);
        }
    }
};

const findBestSnap = (intersections: THREE.Intersection[]) => {
    if (snapMarker) snapMarker.visible = false;
    if (snapLine) snapLine.visible = false;
    document.body.style.cursor = '';

    if (!intersections || intersections.length === 0) {
        lastSnapped = null;
        return null;
    }

    const firstHit = intersections[0];
    const ray = new THREE.Ray();
    ray.origin.copy(world.camera.three.position);
    ray.direction.copy(firstHit.point).sub(ray.origin).normalize();

    const camDist = firstHit.distance;
    const worldUnitsPerPixel = getWorldUnitsPerPixel(camDist);
    // Increased threshold for easier snapping (approx 20px radius)
    const WORLD_UNITS_THRESHOLD = THREE.MathUtils.clamp(worldUnitsPerPixel * 20, 0.001, 0.05);
    const STICKY_THRESHOLD = WORLD_UNITS_THRESHOLD * 0.45;

    const candidates: SnapCandidate[] = [];
    const depthWindow = THREE.MathUtils.clamp(camDist * 0.01, 0.03, 0.25);
    const relevantIntersections = intersections
        .filter(i => (i.distance - firstHit.distance) < depthWindow)
        .slice(0, 12);

    for (const hit of relevantIntersections) {
        getSnapCandidatesFromIntersection(hit, ray, candidates);
    }
    addElementIntersectionCandidates(relevantIntersections, ray, candidates, camDist);

    if (candidates.length === 0) return firstHit;

    let bestCandidate: SnapCandidate | null = null;
    let bestScore = Infinity;
    let bestMainScore = Infinity;

    for (const c of candidates) {
        if (c.distanceToRay > WORLD_UNITS_THRESHOLD) continue;

        let score = c.distanceToRay;
        if (c.type === 'intersection') score *= 0.15;
        if (c.type === 'corner') score *= 0.20; // High priority for corners
        if (c.type === 'vertex') score *= 0.25;
        if (c.type === 'edge') score *= 0.85;
        if (c.type === 'face') score *= 1.4;
        score += c.distanceToCamera * 0.0001;
        
        const mainScore = c.distanceToRay * (
            c.type === 'intersection' ? 0.6 : 
            c.type === 'corner' ? 0.65 :
            c.type === 'vertex' ? 0.75 : 
            c.type === 'edge' ? 1 : 1.3
        );

        if (mainScore < bestMainScore || (mainScore === bestMainScore && score < bestScore)) {
            bestMainScore = mainScore;
            bestScore = score;
            bestCandidate = c;
        }
    }

    if (lastSnapped) {
        const stickyDistanceToRay = computeDistanceToRay(ray, lastSnapped.point);
        if (stickyDistanceToRay < STICKY_THRESHOLD) {
            const stickyScore = stickyDistanceToRay * 0.95;
            const shouldKeepSticky = !bestCandidate || stickyScore <= bestMainScore * 0.7;
            if (shouldKeepSticky) {
                createSnapMarker();
                if (snapMarker) {
                    snapMarker.position.copy(lastSnapped.point);
                    snapMarker.visible = true;
                }
                if (snapLine && cursorMesh) {
                    snapLine.geometry.setFromPoints([cursorMesh.position, lastSnapped.point]);
                    snapLine.visible = true;
                }
                document.body.style.cursor = 'crosshair';
                return {
                    ...firstHit,
                    point: lastSnapped.point.clone(),
                    object: lastSnapped.object,
                    // @ts-ignore
                    isSnapped: true
                };
            }
        }
    }

    if (bestCandidate) {
        lastSnapped = { object: bestCandidate.intersection.object, point: bestCandidate.point.clone() };

        createSnapMarker();
        if (snapMarker) {
            snapMarker.position.copy(bestCandidate.point);
            snapMarker.visible = true;
        }
        if (snapLine && cursorMesh) {
            snapLine.geometry.setFromPoints([cursorMesh.position, bestCandidate.point]);
            snapLine.visible = true;
        }
        document.body.style.cursor = 'crosshair';

        const result = bestCandidate.intersection;
        result.point.copy(bestCandidate.point);
        (result as any).isSnapped = true;
        return result;
    }

    return firstHit;
};

// Override de los métodos del raycaster para soportar MULTI-INTERSECCIÓN
simpleRaycaster.castRayToObjects = (items?: THREE.Object3D[], position?: THREE.Vector2) => {
    if (position) lastPointerNDC = position.clone();
    
    // Usar el raycaster de Three.js directamente para obtener TODAS las intersecciones
    const raycaster = (simpleRaycaster as any)._raycaster as THREE.Raycaster; // Acceso privado o asumir global
    if (!raycaster) return null;

    // Configurar raycaster
    const camera = world.camera.three;
    if (position) {
        raycaster.setFromCamera(position, camera);
    } else if (lastPointerNDC) {
        raycaster.setFromCamera(lastPointerNDC, camera);
    } else {
        return null;
    }

    const targetItems = items || components.meshes;
    // Obtener todas las intersecciones
    const intersections = raycaster.intersectObjects(targetItems, false);

    return findBestSnap(intersections);
};


// --- FRAGMENTS & COMPONENTS ---
const baseUrl = import.meta.env.BASE_URL || './';
const debugSphereGeom = new THREE.SphereGeometry(0.5, 32, 32);
const debugSphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false, transparent: true, opacity: 0.8 });
const debugSphere = new THREE.Mesh(debugSphereGeom, debugSphereMat);
debugSphere.renderOrder = 999;
debugSphere.visible = false;
world.scene.three.add(debugSphere);

const debugConsole = document.getElementById('debug-console');
if (debugConsole) {
    debugConsole.style.display = 'block';
    const log = (msg: string) => {
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
    // Don't throw to prevent white screen, try to continue
    logToScreen("ERROR CRÍTICO: No se pudo cargar el motor de fragmentos.");
}

const classifier = components.get(OBC.Classifier);
const hider = components.get(OBC.Hider);

// Monkey-patch Hider to sync hiddenItems globally
const originalSet = hider.set.bind(hider);
hider.set = async (visible: boolean, items?: any) => {
    await originalSet(visible, items);
    
    if (items && Object.keys(items).length > 0) {
        updateHiddenItems(items, visible);
    } else if (visible) {
        // Show All case
        for (const key in hiddenItems) {
            delete hiddenItems[key];
        }
    }
};

const originalIsolate = hider.isolate.bind(hider);
hider.isolate = async (selection: any) => {
    await originalIsolate(selection);
    
    // Sync hiddenItems for Isolate
    try {
         for (const [uuid, model] of fragments.list) {
             const allIds = await model.getItemsIdsWithGeometry();
             
             // Collect visible IDs for this model
             const visibleIDsForThisModel = new Set<number>();
             
             // Selection is Record<FragmentID, Iterable<ExpressID>>
             for (const [fragID, idSet] of Object.entries(selection)) {
                 // Check if this fragment belongs to the current model
                 // 1. Check if fragID IS the model UUID
                 let belongs = (fragID === uuid);
                 
                 // 2. Check if fragID is one of the fragments in the model
                 if (!belongs) {
                     if (model.items && model.items.length > 0) {
                         belongs = model.items.some((f: any) => f.id === fragID);
                     } else if (model.children && model.children.length > 0) {
                         // Fallback: check Three.js children (Meshes/Fragments)
                         // Fragment objects usually have 'id' matching the fragment ID
                         belongs = model.children.some((child: any) => child.uuid === fragID);
                     }
                 }
                 
                 if (belongs) {
                     // console.log(`[DEBUG] Fragment ${fragID} belongs to model ${uuid}`);
                     const items = idSet instanceof Set ? idSet : (Array.isArray(idSet) ? idSet : []);
                     for(const id of (items as any)) visibleIDsForThisModel.add(id);
                 }
             }
             
             if (!hiddenItems[uuid]) hiddenItems[uuid] = new Set();
             const hiddenSet = hiddenItems[uuid];
             hiddenSet.clear(); // Reset before repopulating based on Isolate logic
             
             let hiddenCount = 0;
             for (const id of allIds) {
                 if (visibleIDsForThisModel.has(id)) {
                     // It's visible
                 } else {
                     hiddenSet.add(id);
                     hiddenCount++;
                 }
             }
         }
    } catch (e) {
         console.error("Error updating hidden items during global isolate:", e);
    }
};

// --- CLIPPER SAFE INIT ---
let clipper: any = null;
try {
    if (OBC.Clipper) {
        clipper = components.get(OBC.Clipper);
        clipper.material = new THREE.MeshBasicMaterial({
            color: 0xCFD8DC,
            side: THREE.DoubleSide,
            shadowSide: THREE.DoubleSide,
            opacity: 0.2,
            transparent: true
        });
    }
} catch (e) {
    console.error("Clipper init failed:", e);
}

// --- HIGHLIGHTER SAFE INIT ---
let highlighter: any = null;
try {
    highlighter = components.get(OBF.Highlighter);
    highlighter.setup({ world });
    highlighter.zoomToSelection = true;
} catch(e) {
    console.error("Highlighter init failed:", e);
}

// --- TOOL SYSTEM ---
// --- getIntersection (AHORA SIN DOBLE SNAP) ---
const getIntersection = (event: MouseEvent) => {
    const rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Usar el raycaster oficial que YA tiene snapping integrado
    const raycasters = components.get(OBC.Raycasters);
    const caster = raycasters.get(world);
    const mouseVec = new THREE.Vector2(mouse.x, mouse.y);
    
    let valid = null;
    try {
         valid = caster.castRayToObjects(components.meshes, mouseVec);
    } catch (e) {
        console.error("OBC Raycaster failed:", e);
    }

    // Solo feedback visual, no re-snapear
    if (valid) {
        if ((valid as any).isSnapped) {
            cursorMat.color.setHex(0xFFD700); // Gold
            cursorMesh.scale.set(2.0, 2.0, 2.0);
        } else {
            cursorMat.color.setHex(0xFF00FF); // Magenta
            cursorMesh.scale.set(1.0, 1.0, 1.0);
        }
        return valid;
    }
    return null;
};

// --- CURSOR MOVEMENT ---
container.addEventListener('mousemove', (event) => {
    if (activeTool === 'none') {
        cursorMesh.visible = false;
        return;
    }
    
    if (['angle', 'slope', 'point'].includes(activeTool)) {
        const hit = getIntersection(event);
        if (hit) {
            cursorMesh.visible = true;
            cursorMesh.position.copy(hit.point);
        } else {
            cursorMesh.visible = false;
        }
    } else {
         cursorMesh.visible = false;
    }
});

// --- POINT TOOL HANDLER ---
const pointHandler = (event: MouseEvent) => {
    if (activeTool !== 'point') return;
    
    // Force disable highlighter and clear selection to prevent conflicts
    const highlighter = components.get(OBF.Highlighter);
    highlighter.enabled = false;
    highlighter.clear('select');
    highlighter.clear('hover');

    event.stopImmediatePropagation();
    event.preventDefault(); // Add this
    
    console.log("[DEBUG] Point tool click detected");
    const hit = getIntersection(event);
    if (hit) {
        const p = hit.point;
        
        // Create Marker (Sphere)
        const geom = new THREE.SphereGeometry(0.2, 16, 16);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false, transparent: true, opacity: 0.8 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(p);
        world.scene.three.add(mesh);
        customMeshes.push(mesh);
        
        // Create Label
        const div = document.createElement('div');
        div.className = 'floating-label';
        div.style.position = 'absolute';
        div.style.background = 'rgba(0, 0, 0, 0.7)';
        div.style.color = 'white';
        div.style.padding = '5px 10px';
        div.style.borderRadius = '4px';
        div.style.pointerEvents = 'none';
        div.style.transform = 'translate(-50%, -100%)';
        div.style.marginTop = '-10px';
        div.style.fontSize = '12px';
        div.innerHTML = `X: ${p.x.toFixed(2)}<br>Y: ${p.y.toFixed(2)}<br>Z: ${p.z.toFixed(2)}`;
        
        // Simple CSS2D emulation
        const updateLabel = () => {
            if (!mesh.parent) {
                div.remove();
                world.camera.controls.removeEventListener('update', updateLabel);
                return;
            }
            const v = p.clone().project(world.camera.three);
            const x = (v.x * .5 + .5) * container.clientWidth;
            const y = (v.y * -.5 + .5) * container.clientHeight;
            div.style.left = `${x}px`;
            div.style.top = `${y}px`;
            
            // Hide if behind camera
            if (v.z > 1) div.style.display = 'none';
            else div.style.display = 'block';
        };
        
        updateLabel();
        world.camera.controls.addEventListener('update', updateLabel);
        document.body.appendChild(div);
        
        logToScreen(`Point: X:${p.x.toFixed(2)} Y:${p.y.toFixed(2)} Z:${p.z.toFixed(2)}`);
    }
};

// --- TOOL BUTTONS (FIXED IDs) ---
const deactivateAllTools = () => {
    activeTool = 'none';
    measurementMode = null;
    
    // Disable Area tool if active
    if (area) area.enabled = false;
    
    // UI updates
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    
    // Clear listeners
    container.removeEventListener('click', onMeasureClick);
    container.removeEventListener('mousemove', onMeasureMouseMove);
    
    // Hide cursor
    if (snappingCursor) snappingCursor.visible = false;
    if (tempMeasurementLine) {
        world.scene.three.remove(tempMeasurementLine);
        tempMeasurementLine = null;
    }
    
    measurementPoints = [];
    logToScreen('Tool deactivated');
};

const activateTool = (tool: 'length' | 'point' | 'angle' | 'slope') => {
    if (activeTool === tool) {
        deactivateAllTools();
        return;
    }
    
    deactivateAllTools();
    activeTool = tool;
    measurementMode = tool === 'length' ? 'length' : null; // Keep for compatibility if needed
    
    // UI update
    const btnId = tool === 'length' ? 'btn-measure-length' : 
                  tool === 'point' ? 'btn-measure-point' :
                  tool === 'angle' ? 'btn-measure-angle' : 'btn-measure-slope';
    document.getElementById(btnId)?.classList.add('active');
    
    // Setup listeners
    container.addEventListener('click', onMeasureClick);
    container.addEventListener('mousemove', onMeasureMouseMove);
    
    // Create cursor if needed
    if (!snappingCursor) {
        const cursorGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const cursorMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false });
        snappingCursor = new THREE.Mesh(cursorGeometry, cursorMaterial);
        world.scene.three.add(snappingCursor);
    }
    snappingCursor.visible = false;
    
    logToScreen(`${tool.charAt(0).toUpperCase() + tool.slice(1)} tool activated`);
};

document.getElementById('btn-measure-point')?.addEventListener('click', () => activateTool('point'));
document.getElementById('btn-measure-length')?.addEventListener('click', () => activateTool('length'));
document.getElementById('btn-measure-angle')?.addEventListener('click', () => activateTool('angle'));
document.getElementById('btn-measure-slope')?.addEventListener('click', () => activateTool('slope'));

document.getElementById('btn-measure-delete')?.addEventListener('click', () => {
    deactivateAllTools();
    
    // Clear all measurements
    measurementMarkers.forEach(m => world.scene.three.remove(m));
    measurementMarkers.length = 0;
    
    measurementLabels.forEach(l => l.remove());
    measurementLabels.length = 0;
    
    customMeshes.forEach(m => world.scene.three.remove(m));
    customMeshes.length = 0;
    
    document.querySelectorAll('.measurement-label').forEach(el => el.remove());
    document.querySelectorAll('.floating-label').forEach(el => el.remove()); 
    
    if (area) area.deleteAll();
    
    logToScreen('All measurements cleared');
});

// --- MODEL LOADING ---
const loadFragment = async (buffer: ArrayBuffer, name: string) => {
    const fragmentsManager = components.get(OBC.FragmentsManager);
    const fragment = await fragmentsManager.load(buffer);
    
    if (!components.meshes) components.meshes = [];
    
    const root = fragment.mesh || fragment.object;
    if (root) {
        // Essential for OBC Tools (Highlighter, Clipper, etc)
        if (world.meshes) world.meshes.add(root);

        root.traverse((child: any) => {
            if ((child.isMesh || child.isInstancedMesh) && child.visible) {
                components.meshes.push(child);
                if (world.meshes) world.meshes.add(child);
            }
        });
    }
    
    logToScreen(`Model loaded: ${name}`);
    return fragment;
};

const loadModel = async (fragmentsFile: File) => {
    const buffer = await fragmentsFile.arrayBuffer();
    await loadFragment(buffer, fragmentsFile.name);
};

// --- UI CONTROLS ---
document.getElementById('file-input')?.addEventListener('change', async (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (!files?.length) return;
    
    for (const file of files) {
        if (file.name.endsWith('.frag')) {
            await loadModel(file);
        }
    }
});



// --- MEASUREMENT FUNCTIONS ---
function createMarker(position: THREE.Vector3, color: number = 0xffff00) {
    const geometry = new THREE.SphereGeometry(0.15, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color, depthTest: false });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.copy(position);
    world.scene.three.add(marker);
    measurementMarkers.push(marker);
    return marker;
}

function createLine(start: THREE.Vector3, end: THREE.Vector3, color: number = 0xffff00) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color, depthTest: false, linewidth: 2 });
    const line = new THREE.Line(geometry, material);
    world.scene.three.add(line);
    measurementMarkers.push(line as any); 
    return line;
}

function createLabel(text: string, position: THREE.Vector3) {
    const div = document.createElement('div');
    div.className = 'measurement-label';
    div.textContent = text;
    div.style.position = 'absolute';
    div.style.background = 'rgba(0, 0, 0, 0.7)';
    div.style.color = 'white';
    div.style.padding = '4px 8px';
    div.style.borderRadius = '4px';
    div.style.pointerEvents = 'none';
    div.style.fontSize = '12px';
    div.style.zIndex = '1000';
    document.body.appendChild(div);
    measurementLabels.push(div);
    
    const update = () => {
        if (!div.isConnected) return;
        const screenPos = position.clone().project(world.camera.three);
        const x = (screenPos.x * .5 + .5) * window.innerWidth;
        const y = (-(screenPos.y * .5) + .5) * window.innerHeight;
        div.style.left = `${x}px`;
        div.style.top = `${y}px`;
        requestAnimationFrame(update);
    };
    update();
}

async function onMeasureMouseMove(event: MouseEvent) {
    if (activeTool === 'none') {
        if (snappingCursor) snappingCursor.visible = false;
        return;
    }
    
    // Guardar NDC para el snap
    {
        const rect = container.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        lastPointerNDC = new THREE.Vector2(x, y);
    }
    
    const result = await simpleRaycaster.castRay();
    
    if (result && result.point) {
        if (snappingCursor) {
            snappingCursor.position.copy(result.point);
            snappingCursor.visible = true;
        }

        // Temp line logic
        const currentPoint = result.point;
        
        if (activeTool === 'length' && measurementPoints.length === 1) {
            updateTempLine(measurementPoints[0], currentPoint);
        } else if (activeTool === 'slope' && measurementPoints.length === 1) {
             updateTempLine(measurementPoints[0], currentPoint);
        } else if (activeTool === 'angle') {
            if (measurementPoints.length === 1) {
                updateTempLine(measurementPoints[0], currentPoint);
            } else if (measurementPoints.length === 2) {
                updateTempLine(measurementPoints[1], currentPoint);
            }
        }

    } else {
        if (snappingCursor) snappingCursor.visible = false;
    }
}

function updateTempLine(start: THREE.Vector3, end: THREE.Vector3) {
    if (!tempMeasurementLine) {
        const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        const material = new THREE.LineBasicMaterial({ color: 0xffff00, depthTest: false, opacity: 0.5, transparent: true });
        tempMeasurementLine = new THREE.Line(geometry, material);
        world.scene.three.add(tempMeasurementLine);
    } else {
        const positions = tempMeasurementLine.geometry.attributes.position;
        positions.setXYZ(0, start.x, start.y, start.z);
        positions.setXYZ(1, end.x, end.y, end.z);
        positions.needsUpdate = true;
    }
}

async function onMeasureClick(event: MouseEvent) {
    if (activeTool === 'none') return;
    
    // Don't trigger if clicking on UI
    if ((event.target as HTMLElement).closest('button') || (event.target as HTMLElement).closest('.sidebar')) return;

    // Guardar NDC para el snap
    {
        const rect = container.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        lastPointerNDC = new THREE.Vector2(x, y);
    }

    const result = await simpleRaycaster.castRay();
    if (!result || !result.point) return;
    
    const point = result.point;
    
    if (activeTool === 'point') {
        createMarker(point, 0x00ff00);
        const text = `X:${point.x.toFixed(2)} Y:${point.y.toFixed(2)} Z:${point.z.toFixed(2)}`;
        createLabel(text, point);
        logToScreen(`Point: ${text}`);
    } 
    else if (activeTool === 'length') {
        measurementPoints.push(point);
        createMarker(point, 0xffff00);
        
        if (measurementPoints.length === 2) {
            const p1 = measurementPoints[0];
            const p2 = measurementPoints[1];
            createLine(p1, p2);
            
            const dist = p1.distanceTo(p2);
            const mid = p1.clone().add(p2).multiplyScalar(0.5);
            createLabel(`${dist.toFixed(3)}m`, mid);
            
            logToScreen(`Distance: ${dist.toFixed(3)}m`);
            resetMeasurementState();
        }
    }
    else if (activeTool === 'angle') {
        measurementPoints.push(point);
        createMarker(point, 0x00ffff); // Cyan for angle

        if (measurementPoints.length === 2) {
            createLine(measurementPoints[0], measurementPoints[1], 0x00ffff);
        }
        else if (measurementPoints.length === 3) {
            const p1 = measurementPoints[0]; // Start
            const p2 = measurementPoints[1]; // Vertex
            const p3 = measurementPoints[2]; // End
            
            createLine(p2, p3, 0x00ffff);
            
            // Calculate Angle
            const v1 = p1.clone().sub(p2).normalize();
            const v2 = p3.clone().sub(p2).normalize();
            const angleRad = v1.angleTo(v2);
            const angleDeg = THREE.MathUtils.radToDeg(angleRad);
            
            createLabel(`${angleDeg.toFixed(1)}°`, p2);
            logToScreen(`Angle: ${angleDeg.toFixed(1)}°`);
            resetMeasurementState();
        }
    }
    else if (activeTool === 'slope') {
        measurementPoints.push(point);
        createMarker(point, 0xff00ff); // Magenta for slope

        if (measurementPoints.length === 2) {
            const p1 = measurementPoints[0];
            const p2 = measurementPoints[1];
            createLine(p1, p2, 0xff00ff);
            
            const dy = Math.abs(p2.y - p1.y);
            const dx = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.z - p1.z, 2));
            
            let text = '';
            if (dx < 0.001) {
                text = 'Vertical';
            } else {
                const slope = dy / dx;
                const deg = THREE.MathUtils.radToDeg(Math.atan(slope));
                const pct = slope * 100;
                text = `${deg.toFixed(1)}° (${pct.toFixed(1)}%)`;
            }
            
            const mid = p1.clone().add(p2).multiplyScalar(0.5);
            createLabel(text, mid);
            logToScreen(`Slope: ${text}`);
            resetMeasurementState();
        }
    }
}

function resetMeasurementState() {
    measurementPoints = [];
    if (tempMeasurementLine) {
        world.scene.three.remove(tempMeasurementLine);
        tempMeasurementLine = null;
    }
}


// --- SAFE INIT FOR AREA & GRIDS ---
let area: any = null;
try {
    // Check if AreaMeasurement exists in OBF (Components Front)
    // @ts-ignore
    const AreaClass = OBF.AreaMeasurement;
    if (AreaClass) {
        area = components.get(AreaClass);
        area.world = world;
        area.enabled = false;
    } else {
        console.warn("AreaMeasurement component not found");
    }
} catch (e) {
    console.error("Area init failed:", e);
}

// Force Focus on Container to ensure keys are captured
if (container) {
    container.tabIndex = 0; // Make focusable
    container.focus();
    container.style.outline = 'none'; // Remove ugly outline
    
    // Refocus on click
    container.addEventListener('click', () => {
        container.focus();
    });
}




// --- KEYBOARD SHORTCUTS ---
let keyBuffer = '';
let lastKeyTime = 0;

window.addEventListener('keydown', async (e) => {
    // FORCE DEBUG
    // console.log(`[KEY_EVENT] Key: "${e.key}", Code: "${e.code}", Buffer: "${keyBuffer}"`);
    
    // Ignore if typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    // Filter out non-printable keys and modifiers
    // Allow single printable characters (length 1)
    if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;

    const now = Date.now();
    if (now - lastKeyTime > 1500) { 
        keyBuffer = '';
    }
    lastKeyTime = now;

    const char = e.key.toUpperCase();
    if (/[A-Z]/.test(char)) {
        keyBuffer += char;
        logToScreen(`Shortcut: ${keyBuffer}`); 
    }

    if (keyBuffer.length > 2) {
        keyBuffer = keyBuffer.slice(-2);
    }

    if (keyBuffer.length === 2) {
        console.log("Shortcut Triggered:", keyBuffer);
        
        let handled = true;

        switch (keyBuffer) {
            case 'PR': // Perspectiva/Ortogonal
                const camera = world.camera;
                const current = camera.projection.current;
                const next = current === 'Perspective' ? 'Orthographic' : 'Perspective';
                await camera.projection.set(next);
                logToScreen(`Proyección: ${next === 'Perspective' ? 'Perspectiva' : 'Ortogonal'}`);
                keyBuffer = '';
                break;

            case 'AZ': // Ajustar modelo a la pantalla
                if (components.meshes && components.meshes.length > 0) {
                     // Calculate bounding box of all meshes
                     const bbox = new THREE.Box3();
                     for(const mesh of components.meshes) {
                         if(mesh instanceof THREE.Mesh || mesh instanceof THREE.InstancedMesh) {
                             // Use geometry bounding box transformed to world
                             if(mesh.geometry) {
                                 if(!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
                                 if(mesh.geometry.boundingBox) {
                                    const meshBox = mesh.geometry.boundingBox.clone();
                                    meshBox.applyMatrix4(mesh.matrixWorld);
                                    bbox.union(meshBox);
                                 }
                             }
                         }
                     }
                     
                     if(!bbox.isEmpty()) {
                        const sphere = new THREE.Sphere();
                        bbox.getBoundingSphere(sphere);
                        await world.camera.controls.fitToSphere(sphere, true);
                        logToScreen('Ajustado a pantalla');
                     }
                }
                keyBuffer = '';
                break;

            case 'HH': // Ocultar selección
                {
                    const highlighter = components.get(OBF.Highlighter);
                    const selection = highlighter.selection.select;
                    if (Object.keys(selection).length > 0) {
                        await hider.set(false, selection);
                        highlighter.clear('select');
                        logToScreen('Selección ocultada');
                    }
                }
                keyBuffer = '';
                break;

            case 'HI': // Aislar selección
                {
                    const highlighter = components.get(OBF.Highlighter);
                    const selection = highlighter.selection.select;
                    if (Object.keys(selection).length > 0) {
                        await hider.isolate(selection);
                        highlighter.clear('select');
                        logToScreen('Selección aislada');
                    }
                }
                keyBuffer = '';
                break;

            case 'HR': // Mostrar todo
                await hider.set(true);
                logToScreen('Mostrar todo');
                keyBuffer = '';
                break;

            case 'RL': // Regla (Length)
                const btnMeasure = document.getElementById('btn-measure-length');
                if (btnMeasure) btnMeasure.click();
                keyBuffer = '';
                break;

            case 'AR': // Área
                if (area) {
                    deactivateAllTools();
                    area.enabled = true;
                    area.create();
                    logToScreen('Herramienta: Área (Click para puntos, Doble click/Enter para terminar)');
                } else {
                    logToScreen('Herramienta Área no disponible');
                }
                keyBuffer = '';
                break;

            case 'AG': // Ángulo
                const btnAngle = document.getElementById('btn-measure-angle');
                if (btnAngle) btnAngle.click();
                keyBuffer = '';
                break;

            case 'PN': // Pendiente
                const btnSlope = document.getElementById('btn-measure-slope');
                if (btnSlope) btnSlope.click();
                keyBuffer = '';
                break;

            case 'CO': // Coordenada por punto
                if (measurementMode === 'length') {
                     const btnMeasure = document.getElementById('btn-measure-length');
                     if(btnMeasure) btnMeasure.click();
                }
                const btnPoint = document.getElementById('btn-measure-point');
                if (btnPoint) btnPoint.click();
                keyBuffer = '';
                break;

            case 'BM': // Borrar medidas
                const btnDelete = document.getElementById('btn-measure-delete');
                if (btnDelete) btnDelete.click();
                keyBuffer = '';
                break;

            case 'RJ': // Rejilla
                if (grids) {
                    grids.enabled = !grids.enabled;
                    logToScreen(`Rejilla: ${grids.enabled ? 'On' : 'Off'}`);
                } else {
                    logToScreen('Rejilla no disponible');
                }
                keyBuffer = '';
                break;

            case 'RC': // Recorte (Clipper)
                if (clipper) {
                    clipper.create(world);
                    logToScreen('Plano de corte creado');
                } else {
                    logToScreen('Clipper no disponible');
                }
                keyBuffer = '';
                break;
            default:
                handled = false;
        }

        if (handled) {
            keyBuffer = ''; // Clear buffer only if handled successfully
        }
    }
});

window.addEventListener('mousedown', async (e) => {
    if (e.button === 1 && e.detail === 2) { // Middle button (1) + Double click (detail 2)
        e.preventDefault(); // Prevent default scroll/zoom behavior if any
        if (components.meshes && components.meshes.length > 0) {
             const bbox = new THREE.Box3();
             for(const mesh of components.meshes) {
                 if(mesh instanceof THREE.Mesh || mesh instanceof THREE.InstancedMesh) {
                     if(mesh.geometry) {
                         if(!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
                         if(mesh.geometry.boundingBox) {
                            const meshBox = mesh.geometry.boundingBox.clone();
                            meshBox.applyMatrix4(mesh.matrixWorld);
                            bbox.union(meshBox);
                         }
                     }
                 }
             }
             
             if(!bbox.isEmpty()) {
                const sphere = new THREE.Sphere();
                bbox.getBoundingSphere(sphere);
                await world.camera.controls.fitToSphere(sphere, true);
                logToScreen('Ajustado a pantalla (Mouse)');
             }
        }
    }
});

logToScreen('VSR IFC Viewer Ready - v36 Restored');

// Export for global access
(window as any).components = components;
(window as any).world = world;

// --- AUTO LOAD MODELS ---
const initModels = async () => {
    try {
        const response = await fetch(`${baseUrl}models.json`);
        if (!response.ok) throw new Error('models.json not found');
        const models = await response.json();
        
        for (const model of models) {
             const path = `${baseUrl}${model.path}`;
             try {
                 const modelRes = await fetch(path);
                 if (!modelRes.ok) throw new Error(`Status ${modelRes.status}`);
                 const buffer = await modelRes.arrayBuffer();
                 await loadFragment(buffer, model.name);
             } catch (e) {
                 console.error(`Failed to load model ${model.name}`, e);
             }
        }
    } catch (e) {
        // Fallback: Try loading specific file if models.json fails
        console.warn("Auto-load failed (models.json)", e);
        try {
            const path = `${baseUrl}models/2442602.frag`;
            const modelRes = await fetch(path);
            if(modelRes.ok) {
                const buffer = await modelRes.arrayBuffer();
                await loadFragment(buffer, "2442602.frag");
            }
        } catch(ex) {
            // ignore
        }
    }
};

initModels();
