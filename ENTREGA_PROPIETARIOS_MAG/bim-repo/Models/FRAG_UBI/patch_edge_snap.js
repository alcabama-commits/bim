const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../LocalViewer/src/main.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove previous patch if exists
const patchStart = '// --- UNIVERSAL RAYCASTER SNAP PATCH (v25) ---';
const patchEnd = '// ------------------------------------------------';

if (content.includes(patchStart)) {
    const startIndex = content.indexOf(patchStart);
    const endIndex = content.indexOf(patchEnd, startIndex);
    if (endIndex !== -1) {
        content = content.substring(0, startIndex) + content.substring(endIndex + patchEnd.length);
        console.log("Removed v25 patch.");
    }
}

// 2. Define the Edge Snap Patch (v26)
const edgeSnapPatch = `
// --- EDGE & VERTEX SNAP PATCH (v26) ---
// Intercepts raycasts to snap to Vertices (Corners) and Edges (Surface boundaries).
const originalIntersectObjects = THREE.Raycaster.prototype.intersectObjects;
const originalIntersectObject = THREE.Raycaster.prototype.intersectObject;

const applyGlobalSnap = (intersects: THREE.Intersection[]) => {
    if (!intersects || intersects.length === 0) return intersects;
    
    const closest = intersects.find(i => i.object instanceof THREE.Mesh || i.object instanceof THREE.InstancedMesh);
    if (!closest) return intersects;

    try {
        const VERTEX_THRESHOLD = 0.4; // 40cm for Vertices
        const EDGE_THRESHOLD = 0.2;   // 20cm for Edges
        
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
                    
                    // Visual Update
                    if ((window as any).debugSphere) {
                        (window as any).debugSphere.position.copy(bestPoint);
                        (window as any).debugSphere.visible = true;
                        
                        // Color Code: Green = Vertex, Yellow = Edge
                        if (type === 'VERTEX') {
                            ((window as any).debugSphere.material as THREE.MeshBasicMaterial).color.setHex(0x00ff00);
                             (window as any).debugSphere.scale.set(1, 1, 1);
                        } else {
                            ((window as any).debugSphere.material as THREE.MeshBasicMaterial).color.setHex(0xffff00);
                             (window as any).debugSphere.scale.set(0.5, 0.5, 0.5);
                        }
                    }
                    
                    if ((window as any).debugLog && Math.random() < 0.05) {
                        (window as any).debugLog(\`Snap: \${type} (\${minD.toFixed(3)})\`);
                    }
                } else {
                     if ((window as any).debugSphere) (window as any).debugSphere.visible = false;
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
`;

// 3. Insert after imports
const importMarker = "import './style.css';";
if (content.includes(importMarker)) {
    content = content.replace(importMarker, importMarker + '\n\n' + edgeSnapPatch);
    console.log("Injected v26 Edge Snap Patch.");
}

// 4. Update Version
content = content.replace(/v25-UniversalSnap/g, 'v26-EdgeSnap');
content = content.replace(/v2026-02-10-v25-UniversalSnap/g, 'v2026-02-10-v26-EdgeSnap');

fs.writeFileSync(filePath, content);
console.log("Applied v26 Edge Snap Patch.");
