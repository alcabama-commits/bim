
const fs = require('fs');
const path = require('path');

const srcBase = path.resolve(__dirname, '../LocalViewer');
const destBase = path.resolve(__dirname, '../../VSR_IFC');

console.log(`Source: ${srcBase}`);
console.log(`Dest: ${destBase}`);

const filesToCopy = [
    { src: 'src/main.ts', dest: 'src/main.ts' },
    { src: 'index.html', dest: 'index.html' },
    { src: 'vite.config.js', dest: 'vite.config.js' },
    { src: 'package.json', dest: 'package.json' },
    { src: 'src/style.css', dest: 'src/style.css' }
];

filesToCopy.forEach(file => {
    const srcPath = path.join(srcBase, file.src);
    const destPath = path.join(destBase, file.dest);
    
    try {
        if (fs.existsSync(srcPath)) {
            // Ensure dest dir exists
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            
            fs.copyFileSync(srcPath, destPath);
            console.log(`Copied ${file.src} to ${file.dest}`);
        } else {
            console.error(`Source file not found: ${srcPath}`);
        }
    } catch (err) {
        console.error(`Error copying ${file.src}: ${err.message}`);
    }
});

// Update index.html version tag to v17-RootFix
const indexHtmlPath = path.join(destBase, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
    let content = fs.readFileSync(indexHtmlPath, 'utf8');
    content = content.replace(/content="v[^"]*"/, 'content="v17-RootFix-Synced"');
    content = content.replace(/<title>.*<\/title>/, '<title>VSR IFC Viewer v17-RootFix</title>');
    fs.writeFileSync(indexHtmlPath, content);
    console.log('Updated index.html version tag');
}
