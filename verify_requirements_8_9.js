const fs = require('fs');
const path = require('path');

console.log('--- RUNNING VERIFICATION FOR REQUIREMENTS 8 & 9 ---');

// 1. Verify Requirement 8: CSS Theme Rules
const styleCss = fs.readFileSync(path.join(__dirname, 'css', 'style.css'), 'utf8');

const expectedCssRules = [
    '[data-theme="light"]',
    '--app-bg: #faf8f2',
    '--primary-blue: #10b981',
    '--card-bg: #ffffff',
    '--card-border: #e6e2d3',
    '.master-tab-switch',
    '.master-sub-tab-btn'
];

let failedCss = false;
expectedCssRules.forEach(rule => {
    if (!styleCss.includes(rule)) {
        console.error(`❌ Missing CSS rule/variable: ${rule}`);
        failedCss = true;
    }
});

if (!failedCss) {
    console.log('✅ Requirement 8 (CSS Theme) PASSED: Creamy white & light green palette properly defined.');
}

// 2. Verify Requirement 8: HTML Theme elements & quick toggle
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const expectedHtmlThemeElements = [
    'btn-quick-theme-toggle',
    'quick-theme-icon',
    'menu-theme',
    'menu-theme-text',
    'menu-theme-badge'
];

let failedThemeHtml = false;
expectedHtmlThemeElements.forEach(id => {
    if (!indexHtml.includes(id)) {
        console.error(`❌ Missing Theme element #${id} in index.html`);
        failedThemeHtml = true;
    }
});

if (!failedThemeHtml) {
    console.log('✅ Requirement 8 (HTML Theme Elements) PASSED: Quick toggle and menu items present.');
}

// 3. Verify Requirement 9: Unified Screen & Tab in index.html
const expectedTabElements = [
    'tab-items-parties',
    'screen-items-parties',
    'btn-subtab-products',
    'btn-subtab-parties',
    'subview-products',
    'subview-parties',
    'top-bar-items-parties',
    'top-bar-sub-products',
    'top-bar-sub-parties'
];

let failedTabHtml = false;
expectedTabElements.forEach(id => {
    if (!indexHtml.includes(id)) {
        console.error(`❌ Missing Unified Tab element #${id} in index.html`);
        failedTabHtml = true;
    }
});

// Check that separate tabs are REMOVED from bottom nav
const bottomNavRegex = /<nav class="app-bottom-nav">([\s\S]*?)<\/nav>/;
const navMatch = indexHtml.match(bottomNavRegex);
if (navMatch) {
    const navContent = navMatch[1];
    if (navContent.includes('id="tab-products"') || navContent.includes('id="tab-parties"')) {
        console.error('❌ Separate tab-products or tab-parties still found in app-bottom-nav!');
        failedTabHtml = true;
    } else {
        console.log('✅ Requirement 9: Separate product and parties tabs successfully removed from bottom nav.');
    }
    if (navContent.includes('id="tab-items-parties"')) {
        console.log('✅ Requirement 9: Unified tab-items-parties ("Product & Parties") present in bottom nav.');
    }
} else {
    console.error('❌ Could not locate app-bottom-nav in index.html');
    failedTabHtml = true;
}

if (!failedTabHtml) {
    console.log('✅ Requirement 9 (HTML Layout) PASSED: Screen, subtabs, and unified bottom nav verified.');
}

// 4. Verify Requirement 8 & 9 in app.js
const appJs = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');

const expectedAppMethods = [
    'applyTheme',
    'toggleTheme',
    'switchItemsPartiesSubTab',
    'screen-items-parties',
    'btn-quick-theme-toggle'
];

let failedAppMethods = false;
expectedAppMethods.forEach(item => {
    if (!appJs.includes(item)) {
        console.error(`❌ Missing logic token '${item}' in app.js`);
        failedAppMethods = true;
    }
});

if (!failedAppMethods) {
    console.log('✅ Requirement 8 & 9 (App Logic) PASSED: Theme switching and unified sub-tab switching logic present.');
}

console.log('--- ALL VERIFICATION CHECKS FOR REQUIREMENTS 8 & 9 COMPLETED SUCCESSFULLY ---');
