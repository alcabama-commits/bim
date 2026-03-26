const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../LocalViewer/src/main.ts');
let content = fs.readFileSync(filePath, 'utf8');

// The error is: const debugSphere = ...
// We want to use the global 'let debugSphere' we added at the top.
// So we replace "const debugSphere =" with "debugSphere ="

// Be careful not to replace other things.
const search = 'const debugSphere = new THREE.Mesh(debugSphereGeom, debugSphereMat);';
const replace = 'debugSphere = new THREE.Mesh(debugSphereGeom, debugSphereMat);';

if (content.includes(search)) {
    content = content.replace(search, replace);
    console.log("Fixed duplicate debugSphere declaration.");
    fs.writeFileSync(filePath, content);
} else {
    // Maybe it has different whitespace or arguments
    console.warn("Could not find exact match for debugSphere declaration. Trying regex.");
    const regex = /const\s+debugSphere\s*=\s*new\s+THREE\.Mesh/;
    if (regex.test(content)) {
        content = content.replace(regex, 'debugSphere = new THREE.Mesh');
        console.log("Fixed duplicate debugSphere declaration (regex).");
        fs.writeFileSync(filePath, content);
    } else {
        console.error("Failed to find debugSphere declaration to fix.");
    }
}
