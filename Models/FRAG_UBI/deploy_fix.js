const fs = require('fs');
const path = require('path');

const sourceDir = 'c:\\Users\\camilo.martinez\\Documents\\GitHub\\bim\\Models\\docs\\VSR_IFC';
const destDir1 = 'c:\\Users\\camilo.martinez\\Documents\\GitHub\\bim\\VSR_IFC';
const destDir2 = 'c:\\Users\\camilo.martinez\\Documents\\GitHub\\bim\\docs\\VSR_IFC';

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
            console.log(`Copied ${item} to ${dest}`);
        }
    }
}

console.log('Starting Manual Deployment...');

try {
    console.log(`Copying to ${destDir1}...`);
    copyRecursive(sourceDir, destDir1);
    
    console.log(`Copying to ${destDir2}...`);
    copyRecursive(sourceDir, destDir2);
    
    console.log('Manual Deployment Complete!');
} catch (e) {
    console.error('Deployment Failed:', e);
}
