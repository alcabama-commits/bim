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

world.scene = new OBC.SimpleScene(components);
world.renderer = new OBC.SimpleRenderer(components, container);
world.camera = new OBC.SimpleCamera(components);

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
let debugPanel = document.getElementById('debug-panel');
if (!debugPanel) {
    debugPanel = document.createElement('div');
    debugPanel.id = 'debug-panel';
    debugPanel.style.position = 'fixed';
    debugPanel.style.bottom = '10px';
    debugPanel.style.left = '50%';
    debugPanel.style.transform = 'translateX(-50%)';
    debugPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    debugPanel.style.color = 'white';
    debugPanel.style.padding = '10px 20px';
    debugPanel.style.borderRadius = '5px';
    debugPanel.style.zIndex = '1000';
    debugPanel.style.pointerEvents = 'none';
    debugPanel.style.fontFamily = 'sans-serif';
    debugPanel.style.fontSize = '14px';
    debugPanel.style.transition = 'opacity 0.5s';
    document.body.appendChild(debugPanel);
}

let debugTimeout: any;
const logToScreen = (msg: string) => {
    if (debugPanel) {
        debugPanel.textContent = msg;
        debugPanel.style.opacity = '1';
        
        clearTimeout(debugTimeout);
        debugTimeout = setTimeout(() => {
            if (debugPanel) debugPanel.style.opacity = '0';
        }, 3000);
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

function createMarker(position: THREE.Vector3, color: number = 0x00ff00) {
    const geometry = new THREE.SphereGeometry(0.1, 16, 16);
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

const grids = components.get(OBC.Grids);
// grids.world = world; // Grids usually auto-init or need create
// components.get(OBC.Grids).create(world); // We might need to create a grid first

// Initialize Clipper (Already done above, but ensure access)
const clipper = components.get(OBC.Clipper);
clipper.enabled = true;

const hider = components.get(OBC.Hider);

const pointHandler = (e: MouseEvent) => {
    // Placeholder for point logic if needed
};

// --- Helper: Deactivate All Tools ---
function deactivateAllTools() {
    activeTool = 'none';
    measurementMode = null;
    if (snappingCursor) snappingCursor.visible = false;
    
    // Disable Area
    area.enabled = false;
    
    // Clear selection
    const highlighter = components.get(OBF.Highlighter);
    highlighter.clear('select');
    
    // Reset any temporary lines
    if (tempMeasurementLine) {
        world.scene.three.remove(tempMeasurementLine);
        tempMeasurementLine = null;
    }
    measurementPoints = [];
}

// --- KEYBOARD SHORTCUTS ---
// Refactored to Single-Key System for robustness

window.addEventListener('keydown', async (e) => {
    // FORCE DEBUG: Log EVERY keydown event to see if they are even registering
    console.log(`[GLOBAL_KEY_DEBUG] Code: ${e.code}, Key: ${e.key}, Ctrl: ${e.ctrlKey}, Target: ${e.target}`);

    // Ignore if typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    
    // Ignore if modifier keys (Ctrl, Alt, Meta) are pressed
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const key = e.key.toUpperCase();
    const code = e.code;
    
    let handled = true;

    try {
        switch (code) {
            case 'KeyP': // P: Perspectiva/Ortogonal
                const camera = world.camera;
                const current = camera.projection.current;
                const next = current === 'Perspective' ? 'Orthographic' : 'Perspective';
                await camera.projection.set(next);
                logToScreen(`Proyección: ${next === 'Perspective' ? 'Perspectiva' : 'Ortogonal'}`);
                break;

            case 'KeyZ': // Z: Ajustar modelo a la pantalla (Zoom)
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
                break;

            case 'KeyH': // H: Ocultar selección
                {
                    const highlighter = components.get(OBF.Highlighter);
                    const selection = highlighter.selection.select;
                    if (Object.keys(selection).length > 0) {
                        await hider.set(false, selection);
                        highlighter.clear('select');
                        logToScreen('Selección ocultada');
                    }
                }
                break;

            case 'KeyI': // I: Aislar selección
                {
                    const highlighter = components.get(OBF.Highlighter);
                    const selection = highlighter.selection.select;
                    if (Object.keys(selection).length > 0) {
                        await hider.isolate(selection);
                        highlighter.clear('select');
                        logToScreen('Selección aislada');
                    }
                }
                break;

            case 'KeyR': // R: Mostrar todo (Reset)
                await hider.set(true);
                logToScreen('Mostrar todo');
                break;

            case 'KeyL': // L: Regla (Length)
                // Trigger existing custom tool
                const btnMeasure = document.getElementById('btn-measure-length');
                if (btnMeasure && !measurementMode) {
                    btnMeasure.click();
                } else if (measurementMode !== 'length') {
                    if (activeTool !== 'none') activeTool = 'none'; // Disable others
                    measurementMode = 'length';
                    logToScreen('Herramienta: Regla');
                }
                break;

            case 'KeyA': // A: Área
                // Use OBF.AreaMeasurement
                if (measurementMode) {
                    // Disable custom tools
                    const btnMeasure = document.getElementById('btn-measure-length');
                    if(btnMeasure && measurementMode) btnMeasure.click();
                }
                // Also trigger UI button if it exists to sync state
                const btnArea = document.getElementById('btn-measure-area');
                if (btnArea && !area.enabled) {
                    btnArea.click();
                } else {
                    area.enabled = true;
                    area.create();
                    logToScreen('Herramienta: Área');
                }
                break;

            case 'KeyG': // G: Ángulo (Grados)
                const btnAngle = document.getElementById('btn-measure-angle');
                if (btnAngle) btnAngle.click();
                break;

            case 'KeyS': // S: Pendiente (Slope)
                const btnSlope = document.getElementById('btn-measure-slope');
                if (btnSlope) btnSlope.click();
                break;

            case 'KeyC': // C: Coordenada (Coordinate)
                if (measurementMode === 'length') {
                    // Toggle off length first
                    const btnMeasure = document.getElementById('btn-measure-length');
                    if(btnMeasure) btnMeasure.click();
                }
                const btnPoint = document.getElementById('btn-measure-point');
                if (btnPoint) {
                    btnPoint.click();
                } else {
                    activeTool = 'point';
                    container.addEventListener('click', pointHandler);
                    logToScreen('Herramienta: Coordenada');
                }
                break;

            case 'Delete':
            case 'Backspace': // Borrar medidas
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
                
                // Clear Clipper
                clipper.deleteAll();

                logToScreen('Todas las medidas borradas');
                break;

            case 'KeyJ': // J: Rejilla (Rejilla)
                const grid = components.get(OBC.Grids);
                grid.enabled = !grid.enabled;
                logToScreen(`Rejilla: ${grid.enabled ? 'On' : 'Off'}`);
                break;

            case 'KeyX': // X: Recorte (Clipper/Cut)
                clipper.create();
                logToScreen('Plano de corte creado');
                break;
            
            case 'Escape': // Escape: Cancel tools
                deactivateAllTools();
                logToScreen('Herramientas desactivadas');
                break;

            default:
                handled = false;
        }
    } catch (err) {
        console.error("Error executing shortcut:", err);
        logToScreen(`Error: ${err}`);
        handled = true;
    }
}, { capture: true }); // CRITICAL: Use capture phase to prevent Three.js/UI from stealing events

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
