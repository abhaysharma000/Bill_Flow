const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const apkDir = path.join(rootDir, 'apk');
const androidDir = path.join(rootDir, 'android');

console.log('========================================================');
console.log('  BillFlow - Automated APK Build & Sync');
console.log('========================================================');

// 1. Ensure apk/ folder exists
if (!fs.existsSync(apkDir)) {
    fs.mkdirSync(apkDir, { recursive: true });
    console.log('[1/4] Created apk/ directory.');
} else {
    console.log('[1/4] apk/ directory exists.');
}

// 2. Build www & sync to android
console.log('[2/4] Building web assets and copying to Capacitor Android...');
execSync('node build_www.js', { stdio: 'inherit', cwd: rootDir });
execSync('npx cap copy android', { stdio: 'inherit', cwd: rootDir });

// 3. Compile Android APK via Gradle
console.log('[3/4] Compiling Android APK with Gradle assembleDebug...');
const gradlewCmd = process.platform === 'win32' ? '.\\gradlew.bat assembleDebug' : './gradlew assembleDebug';
execSync(gradlewCmd, { stdio: 'inherit', cwd: androidDir });

// 4. Copy to apk/BillFlow.apk and root BillFlow.apk
const builtApkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const targetApkPath = path.join(apkDir, 'BillFlow.apk');
const rootApkPath = path.join(rootDir, 'BillFlow.apk');

if (fs.existsSync(builtApkPath)) {
    fs.copyFileSync(builtApkPath, targetApkPath);
    fs.copyFileSync(builtApkPath, rootApkPath);
    const stats = fs.statSync(targetApkPath);
    const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

    console.log('[4/4] Successfully copied latest APK:');
    console.log(`   -> Target: ${targetApkPath} (${sizeMb} MB)`);
    console.log(`   -> Root:   ${rootApkPath} (${sizeMb} MB)`);
    console.log('========================================================');
    console.log(`  BUILD SUCCESS: Latest APK placed in 'apk/' folder!`);
    console.log('========================================================');
} else {
    console.error(`ERROR: Built APK not found at ${builtApkPath}`);
    process.exit(1);
}
