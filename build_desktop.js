const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const desktopDir = path.join(rootDir, 'desktop');
const desktopWwwDir = path.join(desktopDir, 'www');
const desktopSrcDir = path.join(rootDir, 'desktop_src');
const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';

console.log('========================================================');
console.log('  BillFlow - Automated Windows Desktop Software Build');
console.log('========================================================');

// 1. Ensure desktop directories exist
if (!fs.existsSync(desktopDir)) {
    fs.mkdirSync(desktopDir, { recursive: true });
}

// 2. Build www assets
console.log('[1/4] Building latest web assets...');
execSync('node build_www.js', { stdio: 'inherit', cwd: rootDir });

// 3. Sync to desktop/www
console.log('[2/4] Syncing web assets to desktop/www/...');
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
const wwwDir = path.join(rootDir, 'www');
copyDir(wwwDir, desktopWwwDir);

// 4. Ensure assets/icon.ico exists
const iconPath = path.join(rootDir, 'assets', 'icon.ico');
if (!fs.existsSync(iconPath)) {
    console.log('[3/4] Generating icon.ico from assets/icon-512.png...');
    // Generate icon if missing
    const tempIcoCs = path.join(rootDir, 'temp_ico.cs');
    fs.writeFileSync(tempIcoCs, `
using System; using System.Drawing; using System.IO;
class P { static void Main() {
    using (Bitmap b = new Bitmap("assets/icon-512.png"))
    using (Bitmap t = new Bitmap(b, new Size(128, 128)))
    using (Icon ic = Icon.FromHandle(t.GetHicon()))
    using (FileStream fs = new FileStream("assets/icon.ico", FileMode.Create)) {
        ic.Save(fs);
    }
}}`);
    try {
        execSync(`"${cscPath}" /r:System.Drawing.dll /out:temp_ico.exe temp_ico.cs`, { cwd: rootDir });
        execSync('temp_ico.exe', { cwd: rootDir });
        fs.unlinkSync(tempIcoCs);
        fs.unlinkSync(path.join(rootDir, 'temp_ico.exe'));
    } catch (e) {
        console.warn('Icon generation warning:', e.message);
    }
} else {
    console.log('[3/4] assets/icon.ico ready.');
}

// 5. Compile C# executable
console.log('[4/4] Compiling native Windows Desktop executable (BillFlow.exe)...');
const sourceFile = path.join(desktopSrcDir, 'Program.cs');
const targetExe = path.join(desktopDir, 'BillFlow.exe');
const cscCmd = `"${cscPath}" /target:winexe /win32icon:"assets\\icon.ico" /r:System.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Core.dll /r:Microsoft.CSharp.dll /out:"${targetExe}" "${sourceFile}"`;

try {
    execSync(cscCmd, { stdio: 'inherit', cwd: rootDir });
    const stats = fs.statSync(targetExe);
    console.log('========================================================');
    console.log(`  SUCCESS: Windows Desktop software built!`);
    console.log(`  -> Path: ${targetExe} (${(stats.size / 1024).toFixed(1)} KB)`);
    console.log('========================================================');
} catch (err) {
    console.error('ERROR: Failed to compile BillFlow.exe:', err.message);
    process.exit(1);
}
