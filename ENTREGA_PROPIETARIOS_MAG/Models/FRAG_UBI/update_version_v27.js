const fs = require('fs');
const path = require('path');

const files = [
    'c:\\Users\\camilo.martinez\\Documents\\GitHub\\bim\\VSR_IFC\\index.html',
    'c:\\Users\\camilo.martinez\\Documents\\GitHub\\bim\\docs\\VSR_IFC\\index.html',
    'c:\\Users\\camilo.martinez\\Documents\\GitHub\\bim\\Models\\LocalViewer\\index.html'
];

files.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        // Replace any v26-EdgeSnap or v2026...
        content = content.replace(/v26-EdgeSnap/g, 'v27-EventSnap');
        content = content.replace(/v2026-02-10-v26-EdgeSnap/g, 'v2026-02-10-v27-EventSnap');
        fs.writeFileSync(file, content);
        console.log(`Updated ${file}`);
    } else {
        console.log(`File not found: ${file}`);
    }
});
