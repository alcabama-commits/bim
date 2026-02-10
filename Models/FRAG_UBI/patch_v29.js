const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../LocalViewer/src/main.ts');
console.log(`Reading ${filePath}...`);

let content = fs.readFileSync(filePath, 'utf8');

// 1. Update Version
content = content.replace(/v28-NuclearDebug/g, 'v29-SmartSnap');
content = content.replace(/v2026-02-10-v28-NuclearDebug/g, 'v2026-02-10-v29-SmartSnap');

// 2. Refine Thresholds
// We look for the threshold definitions
const oldThresholds = `const VERTEX_THRESHOLD = 0.6; // Increased to 60cm for v27 // 40cm for Vertices
        const EDGE_THRESHOLD = 0.3; // Increased to 30cm for v27   // 20cm for Edges`;

const newThresholds = `const VERTEX_THRESHOLD = 0.25; // Adjusted to 25cm for v29-SmartSnap
        const EDGE_THRESHOLD = 0.15; // Adjusted to 15cm for v29-SmartSnap`;

if (content.includes(oldThresholds)) {
    content = content.replace(oldThresholds, newThresholds);
    console.log('Successfully updated thresholds.');
} else {
    // Try a more loose match if exact string fails (e.g. spacing)
    console.warn('Exact threshold match failed. Attempting regex replacement...');
    content = content.replace(/const VERTEX_THRESHOLD = 0\.6;.*[\r\n]+.*const EDGE_THRESHOLD = 0\.3;.*/, newThresholds);
}

// 3. Improve Visual Feedback Logic (Optional but good)
// Ensure Green for Vertex, Yellow for Edge is distinct
// The current logic is fine, but let's make sure the "No Snap" case is clean.
// Current: if (bestPoint) ... else visible = false. This is correct.

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done.');
