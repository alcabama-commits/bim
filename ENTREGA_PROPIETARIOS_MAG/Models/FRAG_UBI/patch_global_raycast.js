const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../LocalViewer/src/main.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Define debugSphere globally at the top (after imports)
const lastImportIndex = content.lastIndexOf('import ');
const endOfImportsIndex = content.indexOf(';', lastImportIndex) + 1;

const globalDebugDef = `
// --- GLOBAL DEBUG SPHERE ---
let debugSphere: THREE.Mesh | null = null;
let debugLog: ((msg: string) => void) | null = null;
`;

// Insert after imports if not already there
if (!content.includes('let debugSphere: THREE.Mesh | null = null;')) {
    content = content.slice(0, endOfImportsIndex) + '\n' + globalDebugDef + content.slice(endOfImportsIndex);
}

// 2. Add Setup Function for Debug Sphere
const debugSetupFunc = `
const setupDebugSphere = (scene: THREE.Scene) => {
    if (debugSphere) return; // Already setup
    const geom = new THREE.SphereGeometry(0.3, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false, transparent: true, opacity: 0.8 });
    debugSphere = new THREE.Mesh(geom, mat);
    debugSphere.renderOrder = 9999;
    debugSphere.visible = false;
    scene.add(debugSphere);
    
    // Also setup log
    const debugConsole = document.getElementById('debug-console');
    if (debugConsole) {
        debugConsole.style.display = 'block';
        debugLog = (msg: string) => {
             const line = document.createElement('div');
             line.textContent = \`[\${new Date().toLocaleTimeString()}] \${msg}\`;
             debugConsole.appendChild(line);
             debugConsole.scrollTop = debugConsole.scrollHeight;
             if (debugConsole.children.length > 50) debugConsole.removeChild(debugConsole.firstChild);
        };
        (window as any).debugLog = debugLog;
    }
};
`;

// Insert this helper function
if (!content.includes('const setupDebugSphere =')) {
    content = content.replace(globalDebugDef, globalDebugDef + '\n' + debugSetupFunc);
}

// 3. Call setupDebugSphere after scene creation
const sceneCreation = 'const scene = components.get(OBC.Worlds).create();';
if (content.includes(sceneCreation) && !content.includes('setupDebugSphere(scene.three);')) {
    content = content.replace(sceneCreation, sceneCreation + '\nsetupDebugSphere(scene.three);');
}

// 4. The Global Raycaster Patch
const raycasterPatch = `
// --- GLOBAL RAYCASTER PATCH for SNAPPING ---
const originalIntersectObjects = THREE.Raycaster.prototype.intersectObjects;
THREE.Raycaster.prototype.intersectObjects = function(objects, recursive, optionalTarget) {
    // Call original
    const results = originalIntersectObjects.call(this, objects, recursive, optionalTarget);
    
    // Apply snapping to the closest result
    if (results.length > 0) {
        const closest = results[0];
        
        // Only snap if we hit a Mesh and have a point
        if (closest.object instanceof THREE.Mesh || closest.object instanceof THREE.InstancedMesh) {
             try {
                 const SNAP_THRESHOLD = 1.5; // 1.5 Meter Radius
                 const geom = (closest.object as any).geometry;
                 
                 if (geom && geom.attributes.position && closest.face) {
                     const pos = geom.attributes.position;
                     const indices = [closest.face.a, closest.face.b, closest.face.c];
                     
                     let bestVertex = null;
                     let bestDist = SNAP_THRESHOLD;
                     
                     // Helper to get world pos
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
                     
                     for (const idx of indices) {
                         const v = getV(idx);
                         const d = v.distanceTo(closest.point);
                         if (d < bestDist) {
                             bestDist = d;
                             bestVertex = v;
                         }
                     }
                     
                     if (bestVertex) {
                         closest.point.copy(bestVertex);
                         
                         // Visual Feedback
                         if (debugSphere) {
                             debugSphere.position.copy(bestVertex);
                             debugSphere.visible = true;
                         }
                         // Throttle logs
                         if (debugLog && Math.random() < 0.01) debugLog("Global Snap! " + bestDist.toFixed(2));
                     }
                 }
             } catch (e) {
                 // ignore
             }
        }
    }
    return results;
};
`;

// Insert patch before Components initialization
const componentsInit = 'const components = new OBC.Components();';
if (content.includes(componentsInit) && !content.includes('GLOBAL RAYCASTER PATCH')) {
    content = content.replace(componentsInit, raycasterPatch + '\n\n' + componentsInit);
}

// 5. Update Version
content = content.replace(/v23-LogEverything/g, 'v24-GlobalSnap');
content = content.replace(/v2026-02-10-v23-LogEverything/g, 'v2026-02-10-v24-GlobalSnap');

fs.writeFileSync(filePath, content);
console.log("Applied Global Raycaster Patch (v24)");
