const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const fragUbiDir = __dirname;
const projectDir = path.resolve(fragUbiDir, '../LocalViewer');

console.log('--- Deploying v37-LoadFix ---');

// 1. Create backup/snapshot of current main_v35.ts as main_v37.ts
console.log('Snapshotting main_v35.ts to main_v37.ts...');
fs.copyFileSync(
    path.join(fragUbiDir, 'main_v35.ts'),
    path.join(fragUbiDir, 'main_v37.ts')
);

// 2. Overwrite LocalViewer main.ts
console.log('Updating LocalViewer/src/main.ts...');
fs.copyFileSync(
    path.join(fragUbiDir, 'main_v37.ts'),
    path.join(projectDir, 'src/main.ts')
);

// 3. Build LocalViewer
console.log('Building LocalViewer...');
try {
    execSync('npm run build', { cwd: projectDir, stdio: 'inherit' });
    console.log('Build successful.');
} catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
}

// 4. Sync dist to Docs/FRAG_UBI
console.log('Syncing dist to Docs/FRAG_UBI...');
const docsDir = path.resolve(fragUbiDir, '../../../Docs/FRAG_UBI');

if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
}

// Copy assets
const distDir = path.join(projectDir, 'dist');
if (fs.existsSync(distDir)) {
    // Copy all files from dist to docsDir
    const copyRecursive = (src, dest) => {
        if (fs.statSync(src).isDirectory()) {
            if (!fs.existsSync(dest)) fs.mkdirSync(dest);
            fs.readdirSync(src).forEach(child => {
                copyRecursive(path.join(src, child), path.join(dest, child));
            });
        } else {
            fs.copyFileSync(src, dest);
        }
    };
    copyRecursive(distDir, docsDir);
    console.log('Sync complete.');
} else {
    console.error('Dist directory not found!');
    process.exit(1);
}

console.log('Deployment v37-LoadFix complete.');
