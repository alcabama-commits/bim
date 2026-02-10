const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sourceMain = path.resolve(__dirname, 'main_v32.ts');
const targetMain = path.resolve(__dirname, '../LocalViewer/src/main.ts');

// 1. Apply Patch
console.log(`Copying ${sourceMain} to ${targetMain}...`);
fs.copyFileSync(sourceMain, targetMain);

// 2. Build
const projectDir = path.resolve(__dirname, '../LocalViewer');
console.log('Building project in', projectDir);
try {
    execSync('npm run build', { cwd: projectDir, stdio: 'inherit' });
} catch (e) {
    console.error('Build failed:', e);
    process.exit(1);
}

// 3. Deploy (Copy dist)
const distDir = path.join(projectDir, 'dist');
const targetDirs = [
    path.resolve(__dirname, '../../VSR_IFC'),
    path.resolve(__dirname, '../../docs/VSR_IFC')
];

function copyRecursive(src, dest) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const items = fs.readdirSync(src);
    for (const item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
            copyRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log('Deploying to targets...');
targetDirs.forEach(dest => {
    console.log(`Deploying to ${dest}`);
    copyRecursive(distDir, dest);
});

console.log('v32-StableSnap deployment complete.');
