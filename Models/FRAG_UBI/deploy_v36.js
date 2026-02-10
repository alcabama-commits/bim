const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = path.resolve(__dirname, '../LocalViewer');
const fragUbiDir = __dirname;

// 1. Install Files
console.log('Installing v36-ModelLoader files...');
try {
    // Copy the modified main_v35.ts (which has the v36 changes) to src/main.ts
    // Ideally we should have renamed it, but for now we use the file we just edited.
    // Wait, let's be clean. I'll copy it to main_v36.ts first using fs here.
    
    fs.copyFileSync(
        path.join(fragUbiDir, 'main_v35.ts'),
        path.join(fragUbiDir, 'main_v36.ts')
    );
    
    fs.copyFileSync(
        path.join(fragUbiDir, 'main_v36.ts'),
        path.join(projectDir, 'src/main.ts')
    );
    console.log('Copied main_v36.ts to src/main.ts');
    
} catch (e) {
    console.error('Error copying files:', e);
    process.exit(1);
}

// 2. Build
console.log('Building project in', projectDir);
try {
    execSync('npm run build', { cwd: projectDir, stdio: 'inherit' });
} catch (e) {
    console.error('Build failed:', e);
    process.exit(1);
}

// 3. Deploy
const buildOutputDir = path.resolve(projectDir, '../docs/VSR_IFC');
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

if (!fs.existsSync(buildOutputDir)) {
    console.error(`Build output not found at ${buildOutputDir}`);
    process.exit(1);
}

console.log('Deploying from', buildOutputDir);
targetDirs.forEach(dest => {
    console.log(`Deploying to ${dest}`);
    copyRecursive(buildOutputDir, dest);
});

console.log('v36-ModelLoader deployment complete.');
