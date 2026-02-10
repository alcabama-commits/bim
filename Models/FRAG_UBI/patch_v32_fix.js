const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = path.resolve(__dirname, '../LocalViewer');

// 1. Build
console.log('Building project in', projectDir);
try {
    execSync('npm run build', { cwd: projectDir, stdio: 'inherit' });
} catch (e) {
    console.error('Build failed:', e);
    process.exit(1);
}

// 2. Identify Source (Where Vite output went)
// In vite.config.js: outDir: '../docs/VSR_IFC' relative to Models/LocalViewer
const buildOutputDir = path.resolve(projectDir, '../docs/VSR_IFC');

if (!fs.existsSync(buildOutputDir)) {
    console.error(`Build output not found at ${buildOutputDir}`);
    process.exit(1);
}

// 3. Deploy to Targets
const targetDirs = [
    path.resolve(__dirname, '../../VSR_IFC'),
    path.resolve(__dirname, '../../docs/VSR_IFC')
];

function copyRecursive(src, dest) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    
    // Clear destination first to avoid stale files? 
    // Maybe dangerous if it contains other things, but for assets it's good.
    // For now, let's just overwrite.
    
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

console.log('Deploying from', buildOutputDir);
targetDirs.forEach(dest => {
    console.log(`Deploying to ${dest}`);
    copyRecursive(buildOutputDir, dest);
});

console.log('v32-StableSnap deployment fix complete.');
