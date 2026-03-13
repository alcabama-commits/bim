const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../LocalViewer/src/main.ts');

if (!fs.existsSync(targetFile)) {
    console.error('Target file not found:', targetFile);
    process.exit(1);
}

let content = fs.readFileSync(targetFile, 'utf8');

const oldCode = `        // Threshold in units (meters)
        const SNAP_THRESHOLD = 0.4;

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

             // Candidates: Vertices
             const candidates = [vA, vB, vC];

             // Candidates: Midpoints
             candidates.push(vA.clone().add(vB).multiplyScalar(0.5));
             candidates.push(vB.clone().add(vC).multiplyScalar(0.5));
             candidates.push(vC.clone().add(vA).multiplyScalar(0.5));

             let closestPoint = new THREE.Vector3();
             let minDist = Infinity;
             let found = false;

             for (const p of candidates) {
                 const dist = p.distanceTo(valid.point);
                 if (dist < minDist) {
                     minDist = dist;
                     closestPoint.copy(p);
                     found = true;
                 }
             }
             
             if (found && minDist < SNAP_THRESHOLD) {
                 valid.point.copy(closestPoint);
             }
        }`;

const newCode = `        // Threshold in units (meters) - Increased for better detection
        const SNAP_THRESHOLD = 0.5;

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

             // Check all candidates (Vertices, Midpoints, Centroid)
             const allCandidates = [...vertices, ...midpoints, centroid];
             
             for (const p of allCandidates) {
                 const dist = p.distanceTo(valid.point);
                 if (dist < minDist) {
                     minDist = dist;
                     closestPoint.copy(p);
                     found = true;
                 }
             }
             
             if (found && minDist < SNAP_THRESHOLD) {
                 valid.point.copy(closestPoint);
             }
        }`;

if (content.includes(oldCode.trim())) { // Check simplified
    // We might have whitespace issues, let's try a safer replace
    // Actually, exact match is risky.
    // Let's use a regex or just replace the block if we can find unique markers.
    // The markers are: "const SNAP_THRESHOLD = 0.4;" and the end of the block.
    
    // Let's replace the specific SNAP_THRESHOLD line and the candidates logic.
    
    const part1Old = 'const SNAP_THRESHOLD = 0.4;';
    const part1New = 'const SNAP_THRESHOLD = 0.5;';
    
    const part2Old = `// Candidates: Vertices
             const candidates = [vA, vB, vC];

             // Candidates: Midpoints
             candidates.push(vA.clone().add(vB).multiplyScalar(0.5));
             candidates.push(vB.clone().add(vC).multiplyScalar(0.5));
             candidates.push(vC.clone().add(vA).multiplyScalar(0.5));

             let closestPoint = new THREE.Vector3();
             let minDist = Infinity;
             let found = false;

             for (const p of candidates) {
                 const dist = p.distanceTo(valid.point);
                 if (dist < minDist) {
                     minDist = dist;
                     closestPoint.copy(p);
                     found = true;
                 }
             }`;
             
    const part2New = `// Candidates: Vertices (Endpoints)
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

             // Check all candidates
             const allCandidates = [...vertices, ...midpoints, centroid];

             for (const p of allCandidates) {
                 const dist = p.distanceTo(valid.point);
                 if (dist < minDist) {
                     minDist = dist;
                     closestPoint.copy(p);
                     found = true;
                 }
             }`;

    let newContent = content.replace(part1Old, part1New);
    
    // Normalize whitespace for part2 replacement if needed, but try direct first
    // Note: The spaces in the template string must match the file exactly.
    // Based on the Read output, the file has standard indentation.
    
    // We'll construct a regex for part2 to be safe against whitespace variations
    // But exact match from Read output should work if I copied correctly.
    // Let's try replacing the whole logic block using markers.
    
    const startMarker = '// Candidates: Vertices';
    const endMarker = 'if (found && minDist < SNAP_THRESHOLD)';
    
    const startIndex = newContent.indexOf(startMarker);
    const endIndex = newContent.indexOf(endMarker);
    
    if (startIndex !== -1 && endIndex !== -1) {
        const before = newContent.substring(0, startIndex);
        const after = newContent.substring(endIndex);
        
        newContent = before + part2New + '\n             \n             ' + after;
        
        fs.writeFileSync(targetFile, newContent);
        console.log('Successfully patched main.ts');
    } else {
        console.error('Could not find code block to replace');
        // console.log('Content snippet:', newContent.substring(startIndex, startIndex + 100));
        process.exit(1);
    }

} else {
    // If exact match fails, try the marker approach on the original content
     const startMarker = '// Candidates: Vertices';
     const endMarker = 'if (found && minDist < SNAP_THRESHOLD)';
     const startIndex = content.indexOf(startMarker);
     const endIndex = content.indexOf(endMarker);
     
     if (startIndex !== -1 && endIndex !== -1) {
         // Also update threshold
         content = content.replace('const SNAP_THRESHOLD = 0.4;', 'const SNAP_THRESHOLD = 0.5;');
         
         const part2New = `// Candidates: Vertices (Endpoints)
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

             // Check all candidates
             const allCandidates = [...vertices, ...midpoints, centroid];

             for (const p of allCandidates) {
                 const dist = p.distanceTo(valid.point);
                 if (dist < minDist) {
                     minDist = dist;
                     closestPoint.copy(p);
                     found = true;
                 }
             }`;

         const before = content.substring(0, startIndex);
         const after = content.substring(endIndex);
         
         const newContent = before + part2New + '\n             \n             ' + after;
         fs.writeFileSync(targetFile, newContent);
         console.log('Successfully patched main.ts (Marker Method)');
     } else {
         console.error('Could not find code block to replace (Marker Method)');
         process.exit(1);
     }
}
