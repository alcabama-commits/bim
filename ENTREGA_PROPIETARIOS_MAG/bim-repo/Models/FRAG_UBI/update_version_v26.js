const fs = require('fs');
const path = require('path');

const files = [
    path.join(__dirname, '../LocalViewer/index.html'),
    path.join(__dirname, '../docs/VSR_IFC/index.html'),
    path.join(__dirname, '../../VSR_IFC/index.html'),
    path.join(__dirname, '../../docs/VSR_IFC/index.html')
];

const version = 'v26-EdgeSnap';

files.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        content = content.replace(/content="v[^"]*"/, `content="${version}"`);
        content = content.replace(/<title>.*<\/title>/, `<title>VSR IFC Viewer ${version}</title>`);
        fs.writeFileSync(file, content);
        console.log(`Updated ${file} to ${version}`);
    } else {
        console.warn(`File not found: ${file}`);
    }
});
