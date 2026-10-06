const fs = require('fs');
const path = require('path');
const XLSX = require('./node_modules/xlsx');

console.log('Testing Invoice Excel Export Engine...');

// Mock vouchers for testing
const mockVouchers = [
    {
        id: 'v_001',
        voucherNo: 'INV-26/001',
        voucherType: 'sales_invoice',
        date: '2026-10-02',
        dueDate: '2026-10-16',
        partyName: 'Sharma General Store',
        partyPhone: '9876543210',
        partyGstin: '27AAAAA0000A1Z5',
        paymentStatus: 'paid',
        paymentMode: 'UPI',
        subtotal: 1000,
        overallDiscountAmount: 50,
        taxableTotal: 950,
        cgst: 85.5,
        sgst: 85.5,
        igst: 0,
        totalTax: 171,
        roundOff: 0,
        grandTotal: 1121,
        amountPaid: 1121,
        balanceDue: 0,
        items: [
            { name: 'Parle Gold Biscuits', sku: 'PG-01', hsn: '1905', qty: 50, unit: 'Pcs', price: 10, discountPercent: 0, taxableAmount: 500, taxRate: 18, cgst: 45, sgst: 45, igst: 0, totalTax: 90, totalAmount: 590 },
            { name: 'Dairy Milk Chocolate', sku: 'DM-02', hsn: '1806', qty: 25, unit: 'Pcs', price: 20, discountPercent: 10, taxableAmount: 450, taxRate: 18, cgst: 40.5, sgst: 40.5, igst: 0, totalTax: 81, totalAmount: 531 }
        ]
    },
    {
        id: 'v_002',
        voucherNo: 'INV-26/002',
        voucherType: 'sales_invoice',
        date: '2026-09-22', // ~12 days ago
        dueDate: '2026-10-06',
        partyName: 'Apex Wholesalers',
        partyPhone: '9123456780',
        partyGstin: '27BBBBB1111B1Z2',
        paymentStatus: 'pending',
        paymentMode: 'Bank Transfer',
        subtotal: 5000,
        overallDiscountAmount: 0,
        taxableTotal: 5000,
        cgst: 450,
        sgst: 450,
        igst: 0,
        totalTax: 900,
        roundOff: 0,
        grandTotal: 5900,
        amountPaid: 2000,
        balanceDue: 3900,
        items: [
            { name: 'Basmati Rice 25kg', sku: 'BR-25', hsn: '1006', qty: 4, unit: 'Bag', price: 1250, discountPercent: 0, taxableAmount: 5000, taxRate: 18, cgst: 450, sgst: 450, igst: 0, totalTax: 900, totalAmount: 5900 }
        ]
    },
    {
        id: 'v_003',
        voucherNo: 'INV-26/003',
        voucherType: 'sales_invoice',
        date: '2026-09-08', // ~26 days ago
        dueDate: '2026-09-22',
        partyName: 'Modern Traders',
        partyPhone: '9988776655',
        partyGstin: '',
        paymentStatus: 'paid',
        paymentMode: 'Cash',
        subtotal: 800,
        overallDiscountAmount: 0,
        taxableTotal: 800,
        cgst: 72,
        sgst: 72,
        igst: 0,
        totalTax: 144,
        roundOff: 0,
        grandTotal: 944,
        amountPaid: 944,
        balanceDue: 0,
        items: [
            { name: 'Tata Tea Gold', sku: 'TT-01', hsn: '0902', qty: 2, unit: 'Pcs', price: 400, discountPercent: 0, taxableAmount: 800, taxRate: 18, cgst: 72, sgst: 72, igst: 0, totalTax: 144, totalAmount: 944 }
        ]
    },
    {
        id: 'v_004',
        voucherNo: 'INV-26/004',
        voucherType: 'sales_invoice',
        date: '2026-08-15', // ~50 days ago (outside 30 days, inside 90 days)
        dueDate: '2026-08-30',
        partyName: 'Old Customer',
        partyPhone: '9800000000',
        partyGstin: '',
        paymentStatus: 'paid',
        paymentMode: 'Cash',
        subtotal: 300,
        overallDiscountAmount: 0,
        taxableTotal: 300,
        cgst: 27,
        sgst: 27,
        igst: 0,
        totalTax: 54,
        roundOff: 0,
        grandTotal: 354,
        amountPaid: 354,
        balanceDue: 0,
        items: [
            { name: 'Sugar 5kg', sku: 'SG-05', hsn: '1701', qty: 1, unit: 'Bag', price: 300, discountPercent: 0, taxableAmount: 300, taxRate: 18, cgst: 27, sgst: 27, igst: 0, totalTax: 54, totalAmount: 354 }
        ]
    }
];

function testDateFilter(vouchers, days) {
    const today = new Date('2026-10-04');
    const toDateStr = '2026-10-04';
    if (days === 'all') return vouchers;
    const fromD = new Date(today);
    fromD.setDate(today.getDate() - (days - 1));
    const fromDateStr = fromD.toISOString().split('T')[0];

    return vouchers.filter(v => v.date >= fromDateStr && v.date <= toDateStr);
}

// Test 1: 15 Days Filter
const last15Days = testDateFilter(mockVouchers, 15);
console.log('15 Days Invoices Count:', last15Days.length);
if (last15Days.length !== 2) throw new Error('Expected 2 invoices for 15 days, got ' + last15Days.length);

// Test 2: 30 Days Filter
const last30Days = testDateFilter(mockVouchers, 30);
console.log('30 Days Invoices Count:', last30Days.length);
if (last30Days.length !== 3) throw new Error('Expected 3 invoices for 30 days, got ' + last30Days.length);

// Test 3: 90 Days Filter
const last90Days = testDateFilter(mockVouchers, 90);
console.log('90 Days Invoices Count:', last90Days.length);
if (last90Days.length !== 4) throw new Error('Expected 4 invoices for 90 days, got ' + last90Days.length);

// Test 4: Excel Workbook Generation
const filtered = last30Days;
let sumSubtotal = 0, sumDiscount = 0, sumTaxable = 0, sumCgst = 0, sumSgst = 0, sumIgst = 0, sumTotalTax = 0, sumRoundOff = 0, sumGrandTotal = 0, sumPaid = 0, sumBalanceDue = 0;

const invoiceMasterRows = filtered.map((v, idx) => {
    sumSubtotal += v.subtotal;
    sumDiscount += v.overallDiscountAmount;
    sumTaxable += v.taxableTotal;
    sumCgst += v.cgst;
    sumSgst += v.sgst;
    sumIgst += v.igst;
    sumTotalTax += v.totalTax;
    sumRoundOff += v.roundOff;
    sumGrandTotal += v.grandTotal;
    sumPaid += v.amountPaid;
    sumBalanceDue += v.balanceDue;

    return {
        sno: idx + 1,
        invoiceNo: v.voucherNo,
        date: v.date,
        dueDate: v.dueDate,
        type: v.voucherType.replace('_', ' ').toUpperCase(),
        partyName: v.partyName,
        partyPhone: v.partyPhone,
        partyGstin: v.partyGstin,
        status: v.paymentStatus.toUpperCase(),
        mode: v.paymentMode.toUpperCase(),
        itemsCount: v.items.length,
        itemsSummary: v.items.map(i => `${i.name} (${i.qty} ${i.unit})`).join('; '),
        subtotal: v.subtotal,
        discount: v.overallDiscountAmount,
        taxable: v.taxableTotal,
        cgst: v.cgst,
        sgst: v.sgst,
        igst: v.igst,
        tax: v.totalTax,
        roundOff: v.roundOff,
        grandTotal: v.grandTotal,
        paid: v.amountPaid,
        balanceDue: v.balanceDue
    };
});

const wb = XLSX.utils.book_new();
const header1 = [
    'S.No.', 'Invoice No.', 'Invoice Date', 'Due Date', 'Voucher Type',
    'Customer / Party Name', 'Phone Number', 'GSTIN', 'Payment Status', 'Payment Mode',
    'Items Count', 'Items Summary',
    'Subtotal (₹)', 'Discount (₹)', 'Taxable Amount (₹)',
    'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Total GST Tax (₹)', 'Round Off (₹)',
    'Grand Total (₹)', 'Amount Paid (₹)', 'Balance Due (₹)'
];
const aoa1 = [
    header1,
    ...invoiceMasterRows.map(r => [
        r.sno, r.invoiceNo, r.date, r.dueDate, r.type,
        r.partyName, r.partyPhone, r.partyGstin, r.status, r.mode,
        r.itemsCount, r.itemsSummary,
        r.subtotal, r.discount, r.taxable,
        r.cgst, r.sgst, r.igst, r.tax, r.roundOff,
        r.grandTotal, r.paid, r.balanceDue
    ]),
    [],
    [
        'TOTALS', `${filtered.length} Invoices`, '', '', '', '', '', '', '', '', '', '',
        sumSubtotal, sumDiscount, sumTaxable,
        sumCgst, sumSgst, sumIgst, sumTotalTax, sumRoundOff,
        sumGrandTotal, sumPaid, sumBalanceDue
    ]
];
const ws1 = XLSX.utils.aoa_to_sheet(aoa1);
XLSX.utils.book_append_sheet(wb, ws1, 'Invoices_Summary');

// Sheet 2: Item Breakdown
const itemizedRows = [];
let itemSeq = 1;
let sumItemQty = 0, sumItemTaxable = 0, sumItemTax = 0, sumItemTotal = 0;
filtered.forEach(v => {
    v.items.forEach(itm => {
        sumItemQty += itm.qty;
        sumItemTaxable += itm.taxableAmount;
        sumItemTax += itm.totalTax;
        sumItemTotal += itm.totalAmount;
        itemizedRows.push([
            itemSeq++, v.voucherNo, v.date, v.partyName,
            itm.name, itm.sku, itm.hsn, itm.qty, itm.unit, itm.price, `${itm.discountPercent}%`,
            itm.taxableAmount, `${itm.taxRate}%`, itm.cgst, itm.sgst, itm.igst, itm.totalTax, itm.totalAmount
        ]);
    });
});

const header2 = [
    'S.No.', 'Invoice No.', 'Date', 'Customer Name',
    'Product / Item Name', 'SKU', 'HSN / SAC',
    'Quantity', 'Unit', 'Price / Rate (₹)', 'Discount (%)', 'Taxable Value (₹)',
    'GST Rate (%)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Tax Amount (₹)', 'Line Total (₹)'
];
const aoa2 = [
    header2,
    ...itemizedRows,
    [],
    [
        'TOTALS', `${itemizedRows.length} Items`, '', '', '', '', '',
        sumItemQty, '', '', '', sumItemTaxable,
        '', '', '', '', sumItemTax, sumItemTotal
    ]
];
const ws2 = XLSX.utils.aoa_to_sheet(aoa2);
XLSX.utils.book_append_sheet(wb, ws2, 'Item_Wise_Breakdown');

const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
console.log('✓ Successfully generated multi-sheet Excel file! Size:', xlsxBuffer.length, 'bytes');

// Test 5: CSV Generation
const csvContent = XLSX.utils.sheet_to_csv(ws1);
console.log('✓ Successfully generated CSV! Length:', csvContent.length, 'chars');

console.log('ALL EXCEL & INVOICE EXPORT UNIT TESTS PASSED!');
