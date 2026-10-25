const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;

console.log('########################################################');
console.log('  BillFlow - FULL UPGRADE PIPELINE: APK + DESKTOP');
console.log('########################################################');

const startTime = Date.now();

// Step 1: Build Desktop Software
console.log('\n>>> STEP 1/2: Updating Windows Desktop Software (Windows 10/11)...');
execSync('node build_desktop.js', { stdio: 'inherit', cwd: rootDir });

// Step 2: Build Android APK
console.log('\n>>> STEP 2/2: Updating Android APK (apk/BillFlow.apk)...');
execSync('node build_apk.js', { stdio: 'inherit', cwd: rootDir });

const duration = ((Date.now() - startTime) / 1000).toFixed(1);

const apkPath = path.join(rootDir, 'apk', 'BillFlow.apk');
const desktopPath = path.join(rootDir, 'desktop', 'BillFlow.exe');

const apkSize = fs.existsSync(apkPath) ? (fs.statSync(apkPath).size / (1024 * 1024)).toFixed(2) + ' MB' : 'Not found';
const desktopSize = fs.existsSync(desktopPath) ? (fs.statSync(desktopPath).size / 1024).toFixed(1) + ' KB' : 'Not found';

console.log('\n########################################################');
console.log('  ALL BUILDS UPDATED SUCCESSFULLY in ' + duration + 's!');
console.log('########################################################');
console.log(`  [Android APK]        ${apkPath} (${apkSize})`);
console.log(`  [Windows 10/11 App]  ${desktopPath} (${desktopSize})`);
console.log('########################################################\n');
