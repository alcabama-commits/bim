const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../LocalViewer/src/main.ts');
console.log(`Reading ${filePath}...`);

let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Version
content = content.replace(/v30-VisualSnap/g, 'v31-RescueSnap');
content = content.replace(/v2026-02-10-v30-VisualSnap/g, 'v2026-02-10-v31-RescueSnap');

// 2. Fix Initialization of Debug Objects (The Root Cause)
const oldInitBlock = `// --- DEBUG VISUALIZATION ---
const debugSphereGeom = new THREE.SphereGeometry(0.5, 32, 32); // Increased size for v21
const debugSphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false, transparent: true, opacity: 0.8 });
debugSphere = new THREE.Mesh(debugSphereGeom, debugSphereMat);
(window as any).debugSphere = debugSphere; // CRITICAL FIX: Expose to global scope for applyGlobalSnap
debugSphere.renderOrder = 999;
debugSphere.visible = false;
// Correctly add to the scene using the world object
world.scene.three.add(debugSphere);`;

const newInitBlock = `// --- DEBUG VISUALIZATION (v31-RescueSnap) ---
// 1. Edge Cursor (Small Yellow Sphere)
const debugSphereGeom = new THREE.SphereGeometry(0.2, 16, 16); 
const debugSphereMat = new THREE.MeshBasicMaterial({ color: 0xffff00, depthTest: false, transparent: true, opacity: 0.8 });
debugSphere = new THREE.Mesh(debugSphereGeom, debugSphereMat);
(window as any).debugSphere = debugSphere;
debugSphere.renderOrder = 9999;
debugSphere.visible = false;
world.scene.three.add(debugSphere);

// 2. Vertex Cursor (Green Cube)
const debugCubeGeom = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const debugCubeMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false, transparent: true, opacity: 0.8 });
const debugCube = new THREE.Mesh(debugCubeGeom, debugCubeMat);
(window as any).debugCube = debugCube;
debugCube.renderOrder = 9999;
debugCube.visible = false;
world.scene.three.add(debugCube);`;

if (content.includes(oldInitBlock)) {
    content = content.replace(oldInitBlock, newInitBlock);
    console.log('Successfully injected v31-RescueSnap initialization.');
} else {
    // Attempt fallback with relaxed matching
    console.warn('Exact init block match failed. Attempting regex...');
    const regex = /\/\/ --- DEBUG VISUALIZATION ---[\s\S]*?world\.scene\.three\.add\(debugSphere\);/;
    if (regex.test(content)) {
        content = content.replace(regex, newInitBlock);
        console.log('Successfully injected v31-RescueSnap initialization (regex).');
    } else {
        console.error('FAILED to find Debug Visualization block!');
    }
}

// 3. Ensure applyGlobalSnap is robust (just in case)
// The logic I wrote in v30 was: if (ds && dc) ...
// This logic is actually fine IF dc exists. 
// Now that we ensure dc exists, it should work.

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done.');
