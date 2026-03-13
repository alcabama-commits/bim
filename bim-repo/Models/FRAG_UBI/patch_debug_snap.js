const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../LocalViewer/src/main.ts');

if (!fs.existsSync(targetFile)) {
    console.error('Target file not found:', targetFile);
    process.exit(1);
}

let content = fs.readFileSync(targetFile, 'utf8');

// 1. Add Debug Sphere Setup
const debugSetupCode = `
// --- DEBUG VISUALIZATION ---
const debugSphereGeom = new THREE.SphereGeometry(0.3, 16, 16);
const debugSphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false, transparent: true, opacity: 0.8 });
const debugSphere = new THREE.Mesh(debugSphereGeom, debugSphereMat);
debugSphere.renderOrder = 999;
debugSphere.visible = false;
scene.add(debugSphere);

const debugConsole = document.getElementById('debug-console');
if (debugConsole) {
    debugConsole.style.display = 'block'; // Force visible
    const log = (msg) => {
        const line = document.createElement('div');
        line.textContent = \`[\${new Date().toLocaleTimeString()}] \${msg}\`;
        debugConsole.appendChild(line);
        debugConsole.scrollTop = debugConsole.scrollHeight;
        if (debugConsole.children.length > 20) debugConsole.removeChild(debugConsole.firstChild);
    };
    window.debugLog = log;
} else {
    window.debugLog = console.log;
}
`;

// Insert Debug Setup after scene creation or near top of main logic
// Finding a good insertion point. After "const scene = components.get(OBC.Worlds).create();" would be ideal.
// But we don't have that line handy in context. 
// Let's insert before "const fragments = components.get(OBC.FragmentsManager);"
if (!content.includes('const debugSphereGeom')) {
    const insertMarker = 'const fragments = components.get(OBC.FragmentsManager);';
    content = content.replace(insertMarker, debugSetupCode + '\n' + insertMarker);
}

// 2. Replace Snapping Logic with Debug Version
const oldSnapFunctionStart = 'const applySnappingToIntersection = (valid: THREE.Intersection | null) => {';
const newSnapFunction = `const applySnappingToIntersection = (valid: THREE.Intersection | null) => {
    if (!valid) {
        if (debugSphere) debugSphere.visible = false;
        return null;
    }

    try {
        // Threshold in units (meters) - Large for testing
        const SNAP_THRESHOLD = 0.8;

        if (valid.face && (valid.object instanceof THREE.Mesh || valid.object instanceof THREE.InstancedMesh)) {
             const geom = (valid.object as any).geometry;
             if (!geom || !geom.attributes.position) return valid;
             
             const pos = geom.attributes.position;
             const indices = [valid.face.a, valid.face.b, valid.face.c];
             
             // Helpers to get world coordinates
             const getVertexWorld = (idx: number) => {
                 const tempV = new THREE.Vector3();
                 if (idx >= 0 && idx < pos.count) {
                     tempV.fromBufferAttribute(pos, idx);
                     if (valid.object instanceof THREE.InstancedMesh && valid.instanceId !== undefined) {
                          const instanceMatrix = new THREE.Matrix4();
                          valid.object.getMatrixAt(valid.instanceId, instanceMatrix);
                          tempV.applyMatrix4(instanceMatrix);
                     }
                     tempV.applyMatrix4(valid.object.matrixWorld);
                 }
                 return tempV;
             };

             const vA = getVertexWorld(indices[0]);
             const vB = getVertexWorld(indices[1]);
             const vC = getVertexWorld(indices[2]);

             // Candidates: Vertices (Endpoints)
             const vertices = [vA, vB, vC];
             
             // Candidates: Midpoints
             const midpoints = [
                 vA.clone().add(vB).multiplyScalar(0.5),
                 vB.clone().add(vC).multiplyScalar(0.5),
                 vC.clone().add(vA).multiplyScalar(0.5)
             ];

             // Candidate: Face Center (Centroid)
             const centroid = vA.clone().add(vB).add(vC).multiplyScalar(1/3);

             let closestPoint = new THREE.Vector3();
             let minDist = Infinity;
             let found = false;
             let type = '';

             // Check Vertices
             for (const p of vertices) {
                 const dist = p.distanceTo(valid.point);
                 if (dist < minDist) {
                     minDist = dist;
                     closestPoint.copy(p);
                     found = true;
                     type = 'VERTEX';
                 }
             }

             // Check Midpoints
             for (const p of midpoints) {
                 const dist = p.distanceTo(valid.point);
                 if (dist < minDist) {
                     minDist = dist;
                     closestPoint.copy(p);
                     found = true;
                     type = 'MIDPOINT';
                 }
             }
             
             if (found && minDist < SNAP_THRESHOLD) {
                 valid.point.copy(closestPoint);
                 
                 // Visual Debug
                 if (typeof debugSphere !== 'undefined') {
                     debugSphere.position.copy(closestPoint);
                     debugSphere.visible = true;
                     // Color coding
                     if (type === 'VERTEX') debugSphere.material.color.setHex(0xff0000); // Red
                     else debugSphere.material.color.setHex(0x00ff00); // Green
                 }
                 
                 if (window.debugLog) window.debugLog(\`Snapped to \${type} (Dist: \${minDist.toFixed(3)})\`);
             } else {
                 if (typeof debugSphere !== 'undefined') debugSphere.visible = false;
             }
        }
    } catch (e) {
        console.warn("Snapping failed:", e);
        if (window.debugLog) window.debugLog(\`Error: \${e.message}\`);
    }
    return valid;
};`;

// We need to replace the whole function.
// Let's find the start and end of the function in the file.
// We can use the start marker and a known end marker or count braces (hard with regex).
// Since I know the previous content structure, I can use a large chunk replace.

const startMarker = 'const applySnappingToIntersection = (valid: THREE.Intersection | null) => {';
// The function ends before "simpleRaycaster.castRayToObjects ="
const endMarker = 'simpleRaycaster.castRayToObjects =';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex);
    
    // Check if there's any code between the function end and endMarker that we need to preserve.
    // In previous read, there was nothing significant except comments.
    
    content = before + newSnapFunction + '\n\n// Override castRayToObjects\n' + after;
    
    fs.writeFileSync(targetFile, content);
    console.log('Successfully patched main.ts with DEBUG features');
} else {
    console.error('Could not find function bounds');
    console.log('Start:', startIndex, 'End:', endIndex);
    process.exit(1);
}
