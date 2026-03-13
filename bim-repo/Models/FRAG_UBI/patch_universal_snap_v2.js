const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../LocalViewer/src/main.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove previous patch if exists (to avoid duplication or bad state)
// We'll search for the start marker
const patchStart = '// --- UNIVERSAL RAYCASTER SNAP PATCH (v25) ---';
const patchEnd = '// ------------------------------------------------';

if (content.includes(patchStart)) {
    const startIndex = content.indexOf(patchStart);
    const endIndex = content.indexOf(patchEnd, startIndex);
    if (endIndex !== -1) {
        content = content.substring(0, startIndex) + content.substring(endIndex + patchEnd.length);
        console.log("Removed previous patch.");
    }
}

// 2. Define the Correct Patch
const universalPatch = `
// --- UNIVERSAL RAYCASTER SNAP PATCH (v25) ---
// This intercepts ALL raycasts in the entire application.
const originalIntersectObjects = THREE.Raycaster.prototype.intersectObjects;
const originalIntersectObject = THREE.Raycaster.prototype.intersectObject;

const applyGlobalSnap = (intersects: THREE.Intersection[]) => {
    if (!intersects || intersects.length === 0) return intersects;
    
    // Find the closest mesh intersection
    const closest = intersects.find(i => i.object instanceof THREE.Mesh || i.object instanceof THREE.InstancedMesh);
    if (!closest) return intersects;

    try {
        const SNAP_THRESHOLD = 1.5; // 1.5 meters
        
        if (closest.face && (closest.object as any).geometry) {
            const geom = (closest.object as any).geometry;
            const pos = geom.attributes.position;
            
            if (pos) {
                // Get indices
                const a = closest.face.a;
                const b = closest.face.b;
                const c = closest.face.c;
                
                const getV = (idx: number) => {
                    const v = new THREE.Vector3();
                    v.fromBufferAttribute(pos, idx);
                    
                    // Apply instance matrix if needed
                    if (closest.object instanceof THREE.InstancedMesh && closest.instanceId !== undefined) {
                        const m = new THREE.Matrix4();
                        closest.object.getMatrixAt(closest.instanceId, m);
                        v.applyMatrix4(m);
                    }
                    
                    // Apply world matrix
                    closest.object.updateMatrixWorld();
                    v.applyMatrix4(closest.object.matrixWorld);
                    return v;
                };
                
                const va = getV(a);
                const vb = getV(b);
                const vc = getV(c);
                
                let bestV: THREE.Vector3 | null = null;
                let minD = SNAP_THRESHOLD;
                
                [va, vb, vc].forEach(v => {
                    const d = v.distanceTo(closest.point);
                    if (d < minD) {
                        minD = d;
                        bestV = v;
                    }
                });
                
                if (bestV) {
                    closest.point.copy(bestV);
                    
                    // Visual Update
                    if ((window as any).debugSphere) {
                        (window as any).debugSphere.position.copy(bestV);
                        (window as any).debugSphere.visible = true;
                    }
                    
                    // Log
                    // if ((window as any).debugLog && Math.random() < 0.05) (window as any).debugLog("Universal Snap! " + minD.toFixed(2));
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
    content = content.replace(importMarker, importMarker + '\n\n' + universalPatch);
    console.log("Injected Universal Patch (Corrected).");
}

// 4. Ensure debugSphere is exposed to window
// Find where debugSphere is instantiated and add the window assignment
const debugInit = 'debugSphere = new THREE.Mesh(debugSphereGeom, debugSphereMat);';
const debugExpose = 'debugSphere = new THREE.Mesh(debugSphereGeom, debugSphereMat); (window as any).debugSphere = debugSphere;';

if (content.includes(debugInit) && !content.includes('(window as any).debugSphere')) {
    content = content.replace(debugInit, debugExpose);
    console.log("Exposed debugSphere to window.");
} else if (content.includes('let debugSphere: THREE.Mesh | null = null;')) {
    // If we used the global let, we might need to find where it's assigned.
    // In previous file read, we saw: debugSphere = new THREE.Mesh(...)
    // So the replacement above should work.
}

fs.writeFileSync(filePath, content);
console.log("Applied v25 Patch.");
