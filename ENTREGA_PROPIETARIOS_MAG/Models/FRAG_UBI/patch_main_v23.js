const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../LocalViewer/src/main.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Update Version Label
content = content.replace(/v2026-02-10-v22-SnapTriangulation/, 'v2026-02-10-v23-LogEverything');

// Update applySnappingToIntersection
const newSnappingLogic = `// Helper to perform Vertex/Edge snapping on a raw intersection
const applySnappingToIntersection = (valid: THREE.Intersection | null) => {
    // Debug logging for raycast attempts (throttle to avoid spam if needed, but we need to see if it fires)
    // if (window.debugLog && Math.random() < 0.1) window.debugLog("Raycast hit checking...");

    if (!valid || !valid.point) {
        if (debugSphere) debugSphere.visible = false;
        return valid;
    }

    try {
        // STRICT VERTEX SNAPPING LOGIC (Based on User Request: "Puntos Finales")
        // We only look at the vertices of the hit face (Triangulation).
        const SNAP_THRESHOLD = 2.0; // 2.0m Radius (Huge for testing)

        if (valid.face && (valid.object instanceof THREE.Mesh || valid.object instanceof THREE.InstancedMesh)) {
             const geom = (valid.object as any).geometry;
             if (!geom || !geom.attributes.position) return valid;
             
             const pos = geom.attributes.position;
             const indices = [valid.face.a, valid.face.b, valid.face.c];
             
             // Helper to get world coordinates
             const getVertexWorld = (idx: number) => {
                 const tempV = new THREE.Vector3();
                 if (idx >= 0 && idx < pos.count) {
                     tempV.fromBufferAttribute(pos, idx);
                     if (valid.object instanceof THREE.InstancedMesh && valid.instanceId !== undefined) {
                          const instanceMatrix = new THREE.Matrix4();
                          valid.object.getMatrixAt(valid.instanceId, instanceMatrix);
                          tempV.applyMatrix4(instanceMatrix);
                     }
                     // Ensure World Matrix is up to date
                     valid.object.updateMatrixWorld();
                     tempV.applyMatrix4(valid.object.matrixWorld);
                 }
                 return tempV;
             };

             let closestVertex: THREE.Vector3 | null = null;
             let minDist = SNAP_THRESHOLD;

             // Check only the 3 vertices of the hit triangle
             for (const idx of indices) {
                 const vertex = getVertexWorld(idx);
                 const dist = vertex.distanceTo(valid.point); // 3D Distance
                 
                 // Debug distance
                 // if (window.debugLog) window.debugLog(\`Dist to v\${idx}: \${dist.toFixed(3)}\`);

                 if (dist < minDist) {
                     minDist = dist;
                     closestVertex = vertex;
                 }
             }
             
             if (closestVertex) {
                 valid.point.copy(closestVertex);
                 
                 // Visual Debug
                 if (typeof debugSphere !== 'undefined') {
                     debugSphere.position.copy(closestVertex);
                     debugSphere.visible = true;
                     debugSphere.material.color.setHex(0x00ff00); // Green for Snap
                     debugSphere.scale.set(0.8, 0.8, 0.8); // Big sphere
                 }
                 
                 if (window.debugLog) window.debugLog(\`SNAP! Vertex (Dist: \${minDist.toFixed(3)})\`);
             } else {
                 if (typeof debugSphere !== 'undefined') debugSphere.visible = false;
             }
        }
    } catch (e) {
        console.warn("Snapping failed:", e);
        if (window.debugLog) window.debugLog(\`Snap Error: \${e}\`);
    }
    return valid;
};`;

// Use a regex to replace the existing function
// Matches from "const applySnappingToIntersection" down to the closing brace before "// Override castRayToObjects"
const regex = /const applySnappingToIntersection = [\s\S]*?^};/m;

// We need to be careful with the regex matching too much or too little.
// Since we have the exact previous content in mind, let's use a simpler string replacement if possible,
// or a robust regex.
// The previous content ends with "return valid;\n};"

// Let's try replacing the whole block identified by unique start and end markers
const startMarker = "// Helper to perform Vertex/Edge snapping on a raw intersection";
const endMarker = "// Override castRayToObjects";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex);
    content = before + newSnappingLogic + "\n\n" + after;
    fs.writeFileSync(filePath, content);
    console.log("Successfully patched applySnappingToIntersection and version label.");
} else {
    console.error("Could not find the function block to replace.");
    console.log("Start index:", startIndex);
    console.log("End index:", endIndex);
}
