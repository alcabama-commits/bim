const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../LocalViewer/src/main.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Clean up previous failed attempts (optional but good)
// Remove duplicate debugSphere declaration if found later in file
// We already have a script for that, but let's do it here too to be sure.
// We'll replace the second declaration with a simple assignment if it exists.

// 2. Prepare the Universal Patch
const universalPatch = `
// --- UNIVERSAL RAYCASTER SNAP PATCH (v25) ---
// This intercepts ALL raycasts in the entire application.
const originalIntersectObjects = THREE.Raycaster.prototype.intersectObjects;
const originalIntersectObject = THREE.Raycaster.prototype.intersectObject;

const applyGlobalSnap = (intersects) => {
    if (!intersects || intersects.length === 0) return intersects;
    
    // Find the closest mesh intersection
    const closest = intersects.find(i => i.object.isMesh || i.object.isInstancedMesh);
    if (!closest) return intersects;

    try {
        const SNAP_THRESHOLD = 1.5; // 1.5 meters
        
        // We need the debug sphere. Since this runs in prototype, scope is tricky.
        // We'll look for it on window or global scope if possible, or just rely on side effects.
        // But for now, let's just focus on modifying the point.
        
        if (closest.face && closest.object.geometry) {
            const geom = closest.object.geometry;
            const pos = geom.attributes.position;
            
            if (pos) {
                // Get indices
                const a = closest.face.a;
                const b = closest.face.b;
                const c = closest.face.c;
                
                const getV = (idx) => {
                    const v = new THREE.Vector3();
                    v.fromBufferAttribute(pos, idx);
                    
                    // Apply instance matrix if needed
                    if (closest.object.isInstancedMesh && closest.instanceId !== undefined) {
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
                
                let bestV = null;
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
                    // Try to log
                     if ((window).debugLog && Math.random() < 0.05) (window).debugLog("Universal Snap! " + minD.toFixed(2));
                     
                     // Try to move debug sphere if exposed
                     // We exposed it as 'debugSphere' in global scope in previous attempts, 
                     // but to be safe let's check window.debugSphere if we decide to expose it there.
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
    // Check if already patched to avoid duplication
    if (!content.includes('UNIVERSAL RAYCASTER SNAP PATCH')) {
        content = content.replace(importMarker, importMarker + '\n\n' + universalPatch);
        console.log("Injected Universal Patch.");
    } else {
        console.log("Universal Patch already present.");
    }
} else {
    console.error("Could not find import marker.");
}

// 4. Expose debugSphere to window for the patch to use (optional but helpful)
// Find setupDebugSphere and add window assignment
if (content.includes('debugSphere = new THREE.Mesh(geom, mat);')) {
    content = content.replace('debugSphere = new THREE.Mesh(geom, mat);', 'debugSphere = new THREE.Mesh(geom, mat); (window as any).debugSphere = debugSphere;');
}

// 5. Update Version
content = content.replace(/v24-GlobalSnap/g, 'v25-UniversalSnap');
content = content.replace(/v2026-02-10-v24-GlobalSnap/g, 'v2026-02-10-v25-UniversalSnap');

// 6. Fix the Visual Update in the Patch
// We need the patch to actually update the visual sphere.
// Since we attached it to window.debugSphere in step 4, we can use it.
const visualUpdate = `
                if (bestV) {
                    closest.point.copy(bestV);
                    if ((window as any).debugSphere) {
                        (window as any).debugSphere.position.copy(bestV);
                        (window as any).debugSphere.visible = true;
                    }
`;
content = content.replace('// Try to move debug sphere if exposed', visualUpdate);

fs.writeFileSync(filePath, content);
console.log("Applied v25 Universal Snap Patch.");
