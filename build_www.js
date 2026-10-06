const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const destDir = path.join(__dirname, 'www');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

function copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        for (const file of fs.readdirSync(src)) {
            copyRecursive(path.join(src, file), path.join(dest, file));
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

// Copy essential files
const itemsToCopy = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'assets'];

for (const item of itemsToCopy) {
    const srcPath = path.join(srcDir, item);
    const destPath = path.join(destDir, item);
    if (fs.existsSync(srcPath)) {
        copyRecursive(srcPath, destPath);
        console.log(`Copied ${item} to www/`);
    }
}

console.log('www build complete.');
