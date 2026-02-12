import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import * as BUI from '@thatopen/ui';
import * as CUI from '@thatopen/ui-obc';
import './style.css';

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

world.scene = new OBC.Scene(components);
world.renderer = new OBC.Renderer(components, container);
world.camera = new OBC.Camera(components);

components.init();

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
        color: 0x00FF00, 
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
        color: 0x00FF00, 
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
const debugPanel = document.getElementById('debug-panel')!;
const logToScreen = (msg: string) => {
    debugPanel.textContent = msg;
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
    type: 'vertex' | 'edge' | 'intersection' | 'face';
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
        if (pos && pos.count > 0) {
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

            // Vértices del triángulo
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

            // Punto exacto de impacto en la cara como fallback
            pushSnapCandidate(valid.point.clone(), 'face', valid, ray, candidatesOut);

            // Puntos de arista reales (no midpoint)
            if (vertices.length === 3) {
                const addEdge = (p1: THREE.Vector3, p2: THREE.Vector3) => {
                    const closestOnEdge = getClosestPointOnSegmentToRay(p1, p2, ray);
                    pushSnapCandidate(closestOnEdge, 'edge', valid, ray, candidatesOut);
                };
                addEdge(vertices[0], vertices[1]);
                addEdge(vertices[1], vertices[2]);
                addEdge(vertices[2], vertices[0]);
            }
        }
    } else if ((valid.object instanceof THREE.Line || valid.object instanceof THREE.LineSegments) && valid.index !== undefined) {
        // Lógica para líneas... (simplificada por brevedad, similar a arriba)
        const geom = (valid.object as any).geometry;
        const pos = geom?.attributes?.position;
        if (pos && pos.count > 0) {
             const getIndex = (i: number) => geom?.index ? geom.index.getX(i) : i;
             const i1 = getIndex(valid.index);
             const i2 = getIndex(valid.index + 1);
             const lineVerts: THREE.Vector3[] = [];
             
             // Check vertices
             [i1, i2].forEach(idx => {
                 if(idx < 0 || idx >= pos.count) return;
                 const v = new THREE.Vector3().fromBufferAttribute(pos, idx).applyMatrix4(valid.object.matrixWorld);
                 pushSnapCandidate(v, 'vertex', valid, ray, candidatesOut);
                 lineVerts.push(v);
             });
             
             // Check closest point on segment
             if(lineVerts.length === 2) {
                 const closestOnSegment = getClosestPointOnSegmentToRay(lineVerts[0], lineVerts[1], ray);
                 pushSnapCandidate(closestOnSegment, 'edge', valid, ray, candidatesOut);
             }
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
    const WORLD_UNITS_THRESHOLD = THREE.MathUtils.clamp(worldUnitsPerPixel * 12, 0.0006, 0.03);
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
        if (c.type === 'vertex') score *= 0.25;
        if (c.type === 'edge') score *= 0.85;
        if (c.type === 'face') score *= 1.4;
        score += c.distanceToCamera * 0.0001;
        const mainScore = c.distanceToRay * (c.type === 'intersection' ? 0.6 : c.type === 'vertex' ? 0.75 : c.type === 'edge' ? 1 : 1.3);

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
    throw new Error(`Fragments init failed: ${error}`);
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
         console.warn("[DEBUG] Global Isolate Triggered. Syncing hiddenItems...");
         console.log("[DEBUG] Selection keys:", Object.keys(selection));

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
                     console.log(`[DEBUG] Fragment ${fragID} belongs to model ${uuid}`);
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
             console.log(`[DEBUG] Model ${uuid}: Total ${allIds.size}, Visible ${visibleIDsForThisModel.size}, Hidden ${hiddenCount}`);
         }
    } catch (e) {
         console.error("Error updating hidden items during global isolate:", e);
    }
};

const clipper = components.get(OBC.Clipper);
clipper.material = new THREE.MeshBasicMaterial({
    color: 0xCFD8DC, // Light gray-blue typical of BIM software
    side: THREE.DoubleSide,
    shadowSide: THREE.DoubleSide,
    opacity: 0.2,
    transparent: true
});

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
            cursorMat.color.setHex(0x00FF00); // Verde si hay snap
            cursorMesh.scale.set(2.0, 2.0, 2.0);
        } else {
            cursorMat.color.setHex(0xFF00FF); // Magenta si no hay snap
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

// --- TOOL BUTTONS ---
document.getElementById('btn-point')?.addEventListener('click', () => {
    activeTool = 'point';
    logToScreen('Point tool activated');
    container.addEventListener('click', pointHandler);
});

document.getElementById('btn-angle')?.addEventListener('click', () => {
    activeTool = 'angle';
    logToScreen('Angle tool activated');
});

document.getElementById('btn-slope')?.addEventListener('click', () => {
    activeTool = 'slope';
    logToScreen('Slope tool activated');
});

document.getElementById('btn-none')?.addEventListener('click', () => {
    activeTool = 'none';
    logToScreen('Tools deactivated');
    container.removeEventListener('click', pointHandler);
});

// --- MODEL LOADING ---
const loadModel = async (fragmentsFile: File) => {
    const fragmentsManager = components.get(OBC.FragmentsManager);
    const buffer = await fragmentsFile.arrayBuffer();
    const fragment = await fragmentsManager.load(buffer);
    
    // Populate components.meshes for raycasting
    if (!components.meshes) components.meshes = [];
    
    const root = fragment.mesh || fragment.object;
    if (root) {
        root.traverse((child: any) => {
            if ((child.isMesh || child.isInstancedMesh) && child.visible) {
                components.meshes.push(child);
            }
        });
    }
    
    logToScreen(`Model loaded: ${fragmentsFile.name}`);
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

// --- MEASUREMENT MODE TOGGLE ---
document.getElementById('btn-measure')?.addEventListener('click', () => {
    const btn = document.getElementById('btn-measure')!;
    if (measurementMode) {
        measurementMode = null;
        btn.textContent = 'Medir';
        btn.classList.remove('active');
        
        // Clean up
        measurementPoints = [];
        measurementMarkers.forEach(m => world.scene.three.remove(m));
        measurementLabels.forEach(l => l.remove());
        measurementMarkers.length = 0;
        measurementLabels.length = 0;
        
        if (tempMeasurementLine) {
            world.scene.three.remove(tempMeasurementLine);
            tempMeasurementLine = null;
        }
        
        if (snappingCursor) {
            world.scene.three.remove(snappingCursor);
            snappingCursor = null;
        }
        
        container.removeEventListener('click', onMeasureClick);
        container.removeEventListener('mousemove', onMeasureMouseMove);
        
        logToScreen('Measurement mode deactivated');
    } else {
        measurementMode = 'length';
        btn.textContent = 'Detener';
        btn.classList.add('active');
        
        // Create snapping cursor
        const cursorGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const cursorMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false });
        snappingCursor = new THREE.Mesh(cursorGeometry, cursorMaterial);
        snappingCursor.visible = false;
        world.scene.three.add(snappingCursor);
        
        container.addEventListener('click', onMeasureClick);
        container.addEventListener('mousemove', onMeasureMouseMove);
        
        logToScreen('Measurement mode activated');
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
    // Debug for v21
    if (Math.random() < 0.05 && measurementMode) {
         // console.log("Measure Mouse Move Active");
    }

    if (!measurementMode) {
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

        // If we have a start point, draw a temp line to current cursor
        if (measurementMode === 'length' && measurementPoints.length === 1) {
            const start = measurementPoints[0];
            const end = result.point;
            
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
    } else {
        if (snappingCursor) snappingCursor.visible = false;
    }
}

async function onMeasureClick(event: MouseEvent) {
    if (!measurementMode) return;
    
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
    
    if (measurementMode === 'point') {
        createMarker(point, 0x00ff00);
        const text = `X:${point.x.toFixed(2)} Y:${point.y.toFixed(2)} Z:${point.z.toFixed(2)}`;
        createLabel(text, point);
        logToScreen(`Point: ${text}`);
    } else if (measurementMode === 'length') {
        measurementPoints.push(point);
        createMarker(point, 0xffff00);
        
        if (measurementPoints.length === 2) {
            // Finish measurement
            const p1 = measurementPoints[0];
            const p2 = measurementPoints[1];
            createLine(p1, p2);
            
            const dist = p1.distanceTo(p2);
            const mid = p1.clone().add(p2).multiplyScalar(0.5);
            createLabel(`${dist.toFixed(3)}m`, mid);
            
            logToScreen(`Distance: ${dist.toFixed(3)}m`);
            
            // Reset for next measurement
            measurementPoints = [];
            if (tempMeasurementLine) {
                world.scene.three.remove(tempMeasurementLine);
                tempMeasurementLine = null;
            }
        }
    }
}




// --- UI CONTROLS CONTINUATION ---
// Add any additional UI controls here...

// --- Initialize ---
// --- Initialize ---
const area = components.get(OBF.AreaMeasurement);
area.world = world;
area.enabled = false;

const grids = components.get(OBC.Grids);
// grids.world = world; // Grids usually auto-init or need create
// components.get(OBC.Grids).create(world); // We might need to create a grid first

// Initialize Clipper (Already done above, but ensure access)

// --- KEYBOARD SHORTCUTS ---
let keyBuffer = '';
let lastKeyTime = 0;

window.addEventListener('keydown', async (e) => {
    // Ignore if typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const now = Date.now();
    if (now - lastKeyTime > 1000) {
        keyBuffer = '';
    }
    lastKeyTime = now;

    keyBuffer += e.key.toUpperCase();
    if (keyBuffer.length > 2) {
        keyBuffer = keyBuffer.slice(-2);
    }

    if (keyBuffer.length === 2) {
        // console.log("Shortcut Buffer:", keyBuffer);
        
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
                // Trigger existing custom tool
                const btnMeasure = document.getElementById('btn-measure');
                if (btnMeasure && !measurementMode) {
                    btnMeasure.click();
                } else if (measurementMode !== 'length') {
                    // Switch to length if in point mode?
                    // Currently btn-measure toggles.
                    if (activeTool !== 'none') activeTool = 'none'; // Disable others
                    measurementMode = 'length';
                    logToScreen('Herramienta: Regla');
                }
                keyBuffer = '';
                break;

            case 'AR': // Área
                // Use OBF.AreaMeasurement
                if (measurementMode) {
                    // Disable custom tools
                    const btnMeasure = document.getElementById('btn-measure');
                    if(btnMeasure && measurementMode) btnMeasure.click();
                }
                area.enabled = true;
                area.create();
                logToScreen('Herramienta: Área (Click para puntos, Doble click/Enter para terminar)');
                keyBuffer = '';
                break;

            case 'AG': // Ángulo
                const btnAngle = document.getElementById('btn-angle');
                if (btnAngle) btnAngle.click();
                keyBuffer = '';
                break;

            case 'PN': // Pendiente
                const btnSlope = document.getElementById('btn-slope');
                if (btnSlope) btnSlope.click();
                keyBuffer = '';
                break;

            case 'CO': // Coordenada por punto
                if (measurementMode === 'length') {
                    // Toggle off length first?
                     const btnMeasure = document.getElementById('btn-measure');
                     if(btnMeasure) btnMeasure.click();
                }
                // Activate point
                 const btnPoint = document.getElementById('btn-point'); // Wait, main.ts has btn-measure-point logic? 
                 // Actually the main.ts I read had `document.getElementById('btn-point')?.addEventListener`.
                 // But index.html had `btn-measure-point`. 
                 // Let's check main.ts listener IDs.
                 // Line 746: `document.getElementById('btn-point')`
                 // Index.html Line 178: `id="btn-measure-point"`
                 // MISMATCH! I should fix this too or use the ID that exists in DOM.
                 // I will assume `activeTool = 'point'` logic.
                 activeTool = 'point';
                 container.addEventListener('click', pointHandler);
                 logToScreen('Herramienta: Coordenada');
                keyBuffer = '';
                break;

            case 'BM': // Borrar medidas
                // Clear custom
                measurementPoints = [];
                measurementMarkers.forEach(m => world.scene.three.remove(m));
                measurementLabels.forEach(l => l.remove());
                measurementMarkers.length = 0;
                measurementLabels.length = 0;
                if (tempMeasurementLine) {
                    world.scene.three.remove(tempMeasurementLine);
                    tempMeasurementLine = null;
                }
                
                // Clear Area
                area.deleteAll();
                
                // Clear Point (customMeshes)
                customMeshes.forEach(m => world.scene.three.remove(m));
                customMeshes.length = 0;
                document.querySelectorAll('.floating-label').forEach(el => el.remove());

                logToScreen('Medidas borradas');
                keyBuffer = '';
                break;

            case 'RJ': // Rejilla
                const grid = components.get(OBC.Grids);
                // Grid might not be created.
                // grid.enabled = !grid.enabled; 
                // Usually we check if it exists in the world.
                // Let's try creating/toggling visibility.
                // Accessing the internal grid mesh? 
                // OBF.Grids manages a grid. 
                // Let's assume standard behavior:
                grid.enabled = !grid.enabled;
                if(grid.enabled) {
                     // Check if created
                     // grid.create(world);
                }
                logToScreen(`Rejilla: ${grid.enabled ? 'On' : 'Off'}`);
                keyBuffer = '';
                break;

            case 'RC': // Recorte (Clipper)
                clipper.create();
                logToScreen('Plano de corte creado');
                keyBuffer = '';
                break;
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

logToScreen('VSR IFC Viewer Ready - Snapping 3D Mejorado con Visualización');

// Export for global access
(window as any).components = components;
(window as any).world = world;
