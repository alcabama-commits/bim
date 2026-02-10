const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../LocalViewer/src/main.ts');
console.log(`Reading ${filePath}...`);

let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Version
content = content.replace(/v27-EventSnap/g, 'v28-NuclearDebug');
content = content.replace(/v2026-02-10-v27-EventSnap/g, 'v2026-02-10-v28-NuclearDebug');

// 2. Fix Debug Sphere & Add Global Listener
// We look for the Debug Visualization block
const oldBlock = `// --- DEBUG VISUALIZATION ---
const debugSphereGeom = new THREE.SphereGeometry(0.5, 32, 32); // Increased size for v21
const debugSphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false, transparent: true, opacity: 0.8 });
debugSphere = new THREE.Mesh(debugSphereGeom, debugSphereMat);
debugSphere.renderOrder = 999;
debugSphere.visible = false;
// Correctly add to the scene using the world object
world.scene.three.add(debugSphere);`;

const newBlock = `// --- DEBUG VISUALIZATION ---
const debugSphereGeom = new THREE.SphereGeometry(0.5, 32, 32); // Increased size for v21
const debugSphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false, transparent: true, opacity: 0.8 });
debugSphere = new THREE.Mesh(debugSphereGeom, debugSphereMat);
(window as any).debugSphere = debugSphere; // CRITICAL FIX: Expose to global scope for applyGlobalSnap
debugSphere.renderOrder = 999;
debugSphere.visible = false;
// Correctly add to the scene using the world object
world.scene.three.add(debugSphere);

// --- v28-NuclearDebug: GLOBAL INDEPENDENT SNAPPING LOOP ---
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
        if (debugSphere) debugSphere.visible = false;
    }
});`;

if (content.includes(oldBlock)) {
    content = content.replace(oldBlock, newBlock);
    console.log('Successfully injected v28-NuclearDebug logic.');
} else {
    console.warn('Could not find Debug Visualization block. Already patched?');
    // Fallback: check if we need to update existing listener or something
    if (content.includes('v28-NuclearDebug: GLOBAL INDEPENDENT SNAPPING LOOP')) {
        console.log('v28 Logic already present.');
    } else {
        console.error('FAILED to find insertion point!');
    }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done.');
