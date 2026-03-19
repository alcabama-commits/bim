const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\camilo.martinez\\Documents\\GitHub\\bim\\Models\\LocalViewer\\src\\main.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Version Label
content = content.replace(/v2026-02-10-v26-EdgeSnap/g, 'v2026-02-10-v27-EventSnap');

// 2. Add Global Mouse Move Listener Logic
// We insert this right after `container` definition or near the end of initialization
// searching for "BUI.Manager.init();" is a good anchor.

const eventListenerCode = `
// --- v27-EventSnap: GLOBAL INDEPENDENT SNAPPING LOOP ---
// This ensures that even if the tool's internal raycaster fails, 
// we perform our own raycast to visualize the snap point and update debugSphere.
container.addEventListener('mousemove', (event) => {
    if (!world || !world.camera || !world.scene) return;
    
    const rect = container.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Create a temporary raycaster to avoid interfering with the tool's instance
    const tempRaycaster = new THREE.Raycaster();
    tempRaycaster.setFromCamera(new THREE.Vector2(x, y), world.camera.three);
    
    // Collect all model meshes
    const candidates: THREE.Object3D[] = [];
    // @ts-ignore
    if (loadedModels) {
        // @ts-ignore
        for (const [_, model] of loadedModels) {
            if (model.object) candidates.push(model.object);
        }
    }
    
    if (candidates.length === 0) return;
    
    // Perform independent raycast
    const intersects = tempRaycaster.intersectObjects(candidates, true);
    
    if (intersects.length > 0) {
        // Apply snap logic to the closest intersection
        // This will update debugSphere position and visibility
        applyGlobalSnap([intersects[0]]);
        
        // HACK: Attempt to force the snapped point into the tool's cursor if accessible
        // Many tools use a "snappingCursor" or similar.
        // If not, at least the user sees the green sphere where the snap IS.
    } else {
        if (debugSphere) debugSphere.visible = false;
    }
});

// --- ENHANCED LOGGING FOR RAYCASTER OVERRIDE ---
`;

if (!content.includes('v27-EventSnap')) {
    const anchor = 'BUI.Manager.init();';
    content = content.replace(anchor, `${anchor}\n${eventListenerCode}`);
}

// 3. Enhance applyGlobalSnap to be more aggressive with thresholds
// Update thresholds in the existing code
content = content.replace(/const VERTEX_THRESHOLD = 0.4;/g, 'const VERTEX_THRESHOLD = 0.6; // Increased to 60cm for v27');
content = content.replace(/const EDGE_THRESHOLD = 0.2;/g, 'const EDGE_THRESHOLD = 0.3; // Increased to 30cm for v27');

// 4. Ensure simpleRaycaster.castRayToObjects override has logging
// Find the override and add a log
const overrideSearch = 'simpleRaycaster.castRayToObjects = (items?: THREE.Object3D[], position?: THREE.Vector2) => {';
const overrideReplace = `simpleRaycaster.castRayToObjects = (items?: THREE.Object3D[], position?: THREE.Vector2) => {
    // if (window.debugLog && Math.random() < 0.01) window.debugLog("Tool Raycast Triggered");`;

if (content.includes(overrideSearch) && !content.includes("Tool Raycast Triggered")) {
    content = content.replace(overrideSearch, overrideReplace);
}

fs.writeFileSync(filePath, content);
console.log('Successfully patched main.ts with v27-EventSnap logic.');
