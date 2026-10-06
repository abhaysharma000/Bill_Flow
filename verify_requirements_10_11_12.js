const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== VERIFYING REQUIREMENTS 10, 11, 12 ===\n');

// 1. Load InvoiceEngine and InvoicePrinter
const invoicePrinterJs = fs.readFileSync(path.join(__dirname, 'js', 'invoice-printer.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');

// Mock browser global environment for Node.js
global.window = global;
const invoiceEngineJs = fs.readFileSync(path.join(__dirname, 'js', 'models.js'), 'utf8');
eval(invoiceEngineJs);
global.MiniQRCode = {
    generateSvg: () => '<svg>QR</svg>'
};

// Evaluate InvoicePrinter
eval(invoicePrinterJs);

// ---------------------------------------------------------
// TEST REQUIREMENT 10: Default footer text removed & custom footer option
// ---------------------------------------------------------
console.log('Testing Requirement 10: Footer text removal and custom footer note...');

// Assert hardcoded string is NOT anywhere in invoice-printer.js
const badString = 'STANDARD COMMERCIAL INVOICE • SUITABLE FOR DOT MATRIX';
assert(!invoicePrinterJs.includes(badString), 'FAILURE: Old hardcoded dot-matrix footer text is still present in invoice-printer.js!');
console.log('✔ Passed: Hardcoded default text ("standard commercial invoice, suitable for dot matrix...") completely removed.');

// Test dot matrix rendering with no footer text
const testVoucherEmpty = {
    voucherNo: 'INV-26/001',
    voucherType: 'sales_invoice',
    date: '2026-10-04',
    items: [{ name: 'Item 1', qty: 2, price: 100, taxableAmount: 200, taxRate: 18, total: 236 }],
    subtotal: 200,
    grandTotal: 236,
    paidAmount: 236,
    balanceDue: 0
};
const testCompanyEmpty = {
    businessName: 'My Enterprise',
    address: 'Mumbai, MH',
    phone: '9876543210',
    gstin: '27AABCU9603R1ZM'
};
const testParty = {
    name: 'Reliable Corp',
    billingAddress: 'Pune, MH'
};

const htmlEmpty = InvoicePrinter.renderDotMatrixInternational(testVoucherEmpty, testCompanyEmpty, testParty);
assert(!htmlEmpty.includes('<!-- 7. FOOTER NOTE -->'), 'FAILURE: Empty footer should not render any footer note block!');
assert(!htmlEmpty.includes('STANDARD COMMERCIAL INVOICE'), 'FAILURE: Must not include old string');
console.log('✔ Passed: Empty footerText renders cleanly without any default text.');

// Test dot matrix rendering with custom footerText on voucher
const testVoucherWithFooter = {
    ...testVoucherEmpty,
    footerText: 'Thank you for your business! All disputes subject to Mumbai jurisdiction.'
};
const htmlWithFooter = InvoicePrinter.renderDotMatrixInternational(testVoucherWithFooter, testCompanyEmpty, testParty);
assert(htmlWithFooter.includes('Thank you for your business! All disputes subject to Mumbai jurisdiction.'), 'FAILURE: Custom voucher footerText not rendered in dot matrix template!');
console.log('✔ Passed: Custom voucher.footerText correctly rendered in dot matrix template.');

// Test company-level fallback footerText
const testCompanyWithFooter = {
    ...testCompanyEmpty,
    footerText: 'Default Company Footer Notice'
};
const htmlCompanyFooter = InvoicePrinter.renderDotMatrixInternational(testVoucherEmpty, testCompanyWithFooter, testParty);
assert(htmlCompanyFooter.includes('Default Company Footer Notice'), 'FAILURE: Company fallback footerText not rendered in dot matrix template!');
console.log('✔ Passed: Company-level fallback footerText correctly rendered in dot matrix template.');

// Test Modern GST template
const modernHtml = InvoicePrinter.renderModernGST(testVoucherWithFooter, testCompanyEmpty, testParty);
assert(modernHtml.includes('Thank you for your business! All disputes subject to Mumbai jurisdiction.'), 'FAILURE: Modern GST template missing custom footer text!');
console.log('✔ Passed: Custom footerText correctly rendered in Modern GST template.');

// Verify index.html has #footer-modal (Modal 14) and Edit Footer button
assert(indexHtml.includes('id="footer-modal"'), 'FAILURE: index.html missing #footer-modal');
assert(indexHtml.includes('id="btn-print-edit-footer"'), 'FAILURE: index.html missing #btn-print-edit-footer in print modal toolbar');
assert(indexHtml.includes('id="menu-edit-footer"'), 'FAILURE: index.html missing #menu-edit-footer in More screen menu');
assert(indexHtml.includes('id="footer-textarea"'), 'FAILURE: index.html missing #footer-textarea in footer-modal');
assert(indexHtml.includes('id="footer-set-default"'), 'FAILURE: index.html missing #footer-set-default checkbox in footer-modal');
console.log('✔ Passed: "Edit Footer" UI elements (button in print preview, modal 14 with presets, More menu) present in index.html.');

// ---------------------------------------------------------
// TEST REQUIREMENT 11: Edit Terms & Conditions and Footer during invoice creation in Tax Invoice tab
// ---------------------------------------------------------
console.log('\nTesting Requirement 11: Editable Terms & Conditions and Footer in tax invoice tab...');

assert(indexHtml.includes('id="vform-terms"'), 'FAILURE: index.html missing #vform-terms in voucher-modal');
assert(indexHtml.includes('id="vform-footer"'), 'FAILURE: index.html missing #vform-footer in voucher-modal');
assert(indexHtml.includes('id="btn-vform-terms-standard"'), 'FAILURE: index.html missing #btn-vform-terms-standard preset button');
assert(indexHtml.includes('id="btn-vform-footer-thanks"'), 'FAILURE: index.html missing #btn-vform-footer-thanks preset button');

// Verify app.js handles vform-terms and vform-footer in openVoucherModal and saveVoucher
assert(appJs.includes('vform-terms'), 'FAILURE: app.js does not reference vform-terms');
assert(appJs.includes('vform-footer'), 'FAILURE: app.js does not reference vform-footer');
assert(appJs.includes('openFooterModal'), 'FAILURE: app.js missing openFooterModal method');
assert(appJs.includes('saveFooterModal'), 'FAILURE: app.js missing saveFooterModal method');
assert(appJs.includes('applyFooterPreset'), 'FAILURE: app.js missing applyFooterPreset method');
console.log('✔ Passed: Tax invoice creator tab (#voucher-modal) includes editable terms & footer with quick presets, and app.js handles both.');

// ---------------------------------------------------------
// TEST REQUIREMENT 12: Invoice filename format YYYYMMDD_<invoice number>_<party name>.pdf
// ---------------------------------------------------------
console.log('\nTesting Requirement 12: Invoice PDF filename nomenclature format...');

// Extract getInvoiceFileName from appJs
const fnMatch = appJs.match(/getInvoiceFileName\s*\(voucher\)\s*\{([\s\S]*?)\n    \}/);
assert(fnMatch, 'FAILURE: Could not extract getInvoiceFileName method from app.js');

const getInvoiceFileNameFn = new Function('voucher', fnMatch[1]);
const mockContext = {
    parties: [
        { id: 'party_123', name: 'Apex Engineering Ltd' }
    ]
};
const getInvoiceFileName = getInvoiceFileNameFn.bind(mockContext);

// Case 1: Standard invoice with slash
const v1 = {
    date: '2026-10-04',
    voucherNo: 'INV-26/042',
    partyName: 'Apex Engineering Ltd'
};
const f1 = getInvoiceFileName(v1);
console.log('Test Case 1 Generated Filename:', f1);
assert.strictEqual(f1, '20261004_INV-26-042_Apex_Engineering_Ltd.pdf', 'FAILURE in Case 1 filename format!');

// Case 2: Invoice number with slashes and special characters
const v2 = {
    date: '2026-12-25',
    voucherNo: 'TI/2026-27/007',
    partyName: 'Bharat Electronics & Cables'
};
const f2 = getInvoiceFileName(v2);
console.log('Test Case 2 Generated Filename:', f2);
assert.strictEqual(f2, '20261225_TI-2026-27-007_Bharat_Electronics_&_Cables.pdf', 'FAILURE in Case 2 filename format!');

// Case 3: Party lookup from partyId when partyName missing
const v3 = {
    date: '2026-05-18',
    voucherNo: 'EST/101',
    partyId: 'party_123'
};
const f3 = getInvoiceFileName(v3);
console.log('Test Case 3 Generated Filename:', f3);
assert.strictEqual(f3, '20260518_EST-101_Apex_Engineering_Ltd.pdf', 'FAILURE in Case 3 filename format!');

// Verify generateInvoicePdfBlob, downloadInvoicePdf, and shareInvoicePdf call getInvoiceFileName
assert(appJs.includes('this.getInvoiceFileName(voucher)'), 'FAILURE: generateInvoicePdfBlob or shareInvoicePdf must call this.getInvoiceFileName');
assert(appJs.includes('this.getInvoiceFileName(this.activeVoucherForPrint)'), 'FAILURE: downloadInvoicePdf must call this.getInvoiceFileName');

console.log('✔ Passed: Requirement 12 filename format matches "YYYYMMDD_<invoice number>_<party name>.pdf" across all scenarios.');

console.log('\n=========================================');
console.log('ALL TESTS PASSED SUCCESSFULLY! (100% OK)');
console.log('=========================================');
