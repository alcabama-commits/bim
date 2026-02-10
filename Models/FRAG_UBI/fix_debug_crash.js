const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../LocalViewer/src/main.ts');

if (!fs.existsSync(targetFile)) {
    console.error('Target file not found:', targetFile);
    process.exit(1);
}

let content = fs.readFileSync(targetFile, 'utf8');

// 1. Remove the misplaced debug code
// The code to remove starts with "// --- DEBUG VISUALIZATION ---" and ends before "const fragments = components.get(OBC.FragmentsManager);"
const debugCodeStart = '// --- DEBUG VISUALIZATION ---';
const debugCodeEnd = 'const fragments = components.get(OBC.FragmentsManager);';

const startIndex = content.indexOf(debugCodeStart);
const endIndex = content.indexOf(debugCodeEnd);

if (startIndex !== -1 && endIndex !== -1) {
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex);
    
    // 2. Construct the CORRECT debug code
    // We need to use 'world.scene.three.add(debugSphere)' instead of 'scene.add(debugSphere)'
    // because 'scene' variable is not defined as a standalone variable in the scope, it's 'world.scene'.
    // Or we can define 'const scene = world.scene.three;' earlier.
    
    const correctedDebugCode = `
// --- DEBUG VISUALIZATION ---
const debugSphereGeom = new THREE.SphereGeometry(0.3, 16, 16);
const debugSphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false, transparent: true, opacity: 0.8 });
const debugSphere = new THREE.Mesh(debugSphereGeom, debugSphereMat);
debugSphere.renderOrder = 999;
debugSphere.visible = false;
// Correctly add to the scene using the world object
world.scene.three.add(debugSphere);

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

    // 3. Reassemble
    content = before + correctedDebugCode + '\n' + after;
    
    fs.writeFileSync(targetFile, content);
    console.log('Successfully moved and fixed debug code in main.ts');

} else {
    console.error('Could not find debug code block to move');
    process.exit(1);
}
