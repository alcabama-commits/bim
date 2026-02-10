const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../LocalViewer/src/main.ts');
console.log(`Reading ${filePath}...`);

let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Version
content = content.replace(/v29-SmartSnap/g, 'v30-VisualSnap');
content = content.replace(/v2026-02-10-v29-SmartSnap/g, 'v2026-02-10-v30-VisualSnap');

// 2. Adjust Thresholds (Slightly larger than v29, smaller than v27)
const oldThresholds = `const VERTEX_THRESHOLD = 0.25; // Adjusted to 25cm for v29-SmartSnap
        const EDGE_THRESHOLD = 0.15; // Adjusted to 15cm for v29-SmartSnap`;

const newThresholds = `const VERTEX_THRESHOLD = 0.40; // Increased to 40cm for v30-VisualSnap (Easier snap)
        const EDGE_THRESHOLD = 0.20; // Increased to 20cm for v30-VisualSnap`;

if (content.includes(oldThresholds)) {
    content = content.replace(oldThresholds, newThresholds);
    console.log('Updated thresholds.');
} else {
    // Regex fallback
    content = content.replace(/const VERTEX_THRESHOLD = 0\.25;.*[\r\n]+.*const EDGE_THRESHOLD = 0\.15;.*/, newThresholds);
    console.log('Updated thresholds (regex fallback).');
}

// 3. Update Visuals Logic in applyGlobalSnap
// We need to replace the visual update block.
const oldVisualBlock = `// Visual Update
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
                    }`;

const newVisualBlock = `// Visual Update (v30-VisualSnap)
                    const ds = (window as any).debugSphere; // Edge (Sphere)
                    const dc = (window as any).debugCube;   // Vertex (Cube)
                    
                    if (ds && dc) {
                        if (type === 'VERTEX') {
                            // Show Green Cube
                            dc.position.copy(bestPoint);
                            dc.visible = true;
                            ds.visible = false;
                        } else {
                            // Show Small Yellow Sphere
                            ds.position.copy(bestPoint);
                            ds.visible = true;
                            dc.visible = false;
                            
                            // Ensure Yellow Color & Small Scale
                            ((ds.material) as THREE.MeshBasicMaterial).color.setHex(0xffff00);
                            ds.scale.set(0.5, 0.5, 0.5); // Base radius 0.2 * 0.5 = 0.1m
                        }
                    }`;

if (content.includes(oldVisualBlock)) {
    content = content.replace(oldVisualBlock, newVisualBlock);
    console.log('Updated applyGlobalSnap visual logic.');
} else {
    // Attempt relaxed match if exact string fails (due to whitespace/formatting)
    // We'll search for the core lines
    const startMarker = `// Visual Update`;
    const endMarker = `if ((window as any).debugLog && Math.random() < 0.05) {`;
    
    const startIndex = content.indexOf(startMarker);
    const endIndex = content.indexOf(endMarker);
    
    if (startIndex !== -1 && endIndex !== -1) {
        const pre = content.substring(0, startIndex);
        const post = content.substring(endIndex);
        content = pre + newVisualBlock + '\n\n                    ' + post;
        console.log('Updated applyGlobalSnap visual logic (manual splice).');
    } else {
        console.warn('FAILED to update visual logic block.');
    }
}

// 4. Update 'No Snap' logic to hide BOTH
const oldHideBlock = `} else {
                     if ((window as any).debugSphere) (window as any).debugSphere.visible = false;
                }`;

const newHideBlock = `} else {
                     if ((window as any).debugSphere) (window as any).debugSphere.visible = false;
                     if ((window as any).debugCube) (window as any).debugCube.visible = false;
                }`;

if (content.includes(oldHideBlock)) {
    content = content.replace(oldHideBlock, newHideBlock);
    console.log('Updated hide logic.');
} else {
     // Regex fallback for whitespace
     content = content.replace(/} else {\s+if \(\(window as any\)\.debugSphere\) \(window as any\)\.debugSphere\.visible = false;\s+}/, newHideBlock);
}

// 5. Update setupDebugSphere to create Cube + Sphere
// This is trickier as we need to inject the Cube creation.
const oldSetupBlock = `const setupDebugSphere = (scene: THREE.Scene) => {
    if (debugSphere) return; // Already setup
    const geom = new THREE.SphereGeometry(0.3, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false, transparent: true, opacity: 0.8 });
    debugSphere = new THREE.Mesh(geom, mat); (window as any).debugSphere = debugSphere;
    debugSphere.renderOrder = 9999;
    debugSphere.visible = false;
    scene.add(debugSphere);`;

const newSetupBlock = `const setupDebugSphere = (scene: THREE.Scene) => {
    if (debugSphere) return; // Already setup
    
    // 1. Edge Cursor (Yellow Sphere) - Base Radius 0.2
    const sphereGeom = new THREE.SphereGeometry(0.2, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffff00, depthTest: false, transparent: true, opacity: 0.8 });
    debugSphere = new THREE.Mesh(sphereGeom, sphereMat); 
    (window as any).debugSphere = debugSphere;
    debugSphere.renderOrder = 9999;
    debugSphere.visible = false;
    scene.add(debugSphere);

    // 2. Vertex Cursor (Green Cube) - Size 0.3
    const cubeGeom = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const cubeMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, depthTest: false, transparent: true, opacity: 0.8 });
    const debugCube = new THREE.Mesh(cubeGeom, cubeMat);
    (window as any).debugCube = debugCube;
    debugCube.renderOrder = 9999;
    debugCube.visible = false;
    scene.add(debugCube);`;

if (content.includes(oldSetupBlock)) {
    content = content.replace(oldSetupBlock, newSetupBlock);
    console.log('Updated setupDebugSphere.');
} else {
    // Regex or manual search
    const setupStart = `const setupDebugSphere = (scene: THREE.Scene) => {`;
    const setupEnd = `// Also setup log`;
    
    const sIdx = content.indexOf(setupStart);
    const eIdx = content.indexOf(setupEnd);
    
    if (sIdx !== -1 && eIdx !== -1) {
        const pre = content.substring(0, sIdx);
        const post = content.substring(eIdx);
        content = pre + newSetupBlock + '\n    \n    ' + post;
        console.log('Updated setupDebugSphere (manual splice).');
    } else {
        console.warn('FAILED to update setupDebugSphere.');
    }
}

// 6. Fix the Global Listener logic to hide BOTH if no candidates
const oldGlobalHide = `if (debugSphere) debugSphere.visible = false;`;
const newGlobalHide = `if ((window as any).debugSphere) (window as any).debugSphere.visible = false;
        if ((window as any).debugCube) (window as any).debugCube.visible = false;`;

// Search for the specific block inside the event listener
const listenerBlock = `// NUCLEAR DEBUG: Raycast against EVERYTHING in scene`;
if (content.includes(listenerBlock)) {
    // Find the end of the listener logic
    const endListener = `if (intersects.length > 0) {
        applyGlobalSnap([intersects[0]]);
    } else {`;
    
    // We need to replace the content inside the else block
    // Since simple string replace is risky with short strings, let's use context
    content = content.replace(`} else {
        if (debugSphere) debugSphere.visible = false;
    }`, `} else {
        if ((window as any).debugSphere) (window as any).debugSphere.visible = false;
        if ((window as any).debugCube) (window as any).debugCube.visible = false;
    }`);
    console.log('Updated global listener hide logic.');
}


fs.writeFileSync(filePath, content, 'utf8');
console.log('Done.');
