/**
 * BillFlow Models & Calculation Engine
 * Indian GST Compliant Calculation, Tax Splitting, Multi-Voucher Lifecycle, and Stock Management
 */

class InvoiceEngine {
    // Format number to Indian Currency style (e.g., ₹ 1,23,456.78)
    static formatCurrency(amount, includeSymbol = true) {
        const val = Number(amount) || 0;
        const formatted = val.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return includeSymbol ? `₹ ${formatted}` : formatted;
    }

    // Format Date from YYYY-MM-DD to DD MMM YYYY (e.g., 25 Mar 2026)
    static formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                const d = new Date(parts[0], parts[1] - 1, parts[2]);
                return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            }
            return dateStr;
        } catch {
            return dateStr;
        }
    }

    // Convert numeric amount to Words in Indian numbering format (Lakhs, Crores)
    static amountToWords(amount) {
        const num = Math.round(Number(amount) || 0);
        if (num === 0) return 'Rupees Zero Only';

        const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
            'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        function convertThreeDigits(n) {
            let str = '';
            if (n >= 100) {
                str += units[Math.floor(n / 100)] + ' Hundred ';
                n %= 100;
            }
            if (n >= 20) {
                str += tens[Math.floor(n / 10)] + ' ';
                n %= 10;
            }
            if (n > 0) {
                str += units[n] + ' ';
            }
            return str;
        }

        let words = '';
        let crores = Math.floor(num / 10000000);
        let rem = num % 10000000;
        let lakhs = Math.floor(rem / 100000);
        rem %= 100000;
        let thousands = Math.floor(rem / 1000);
        let hundreds = rem % 1000;

        if (crores > 0) words += convertThreeDigits(crores) + 'Crore ';
        if (lakhs > 0) words += convertThreeDigits(lakhs) + 'Lakh ';
        if (thousands > 0) words += convertThreeDigits(thousands) + 'Thousand ';
        if (hundreds > 0) words += convertThreeDigits(hundreds);

        return `Rupees ${words.trim()} Only`;
    }

    // Determine GST Type: 'intra' (CGST + SGST) vs 'inter' (IGST)
    static determineTaxType(companyState, partyState) {
        if (!companyState || !partyState) return 'intra';
        const cleanComp = companyState.trim().toLowerCase();
        const cleanParty = partyState.trim().toLowerCase();
        return cleanComp === cleanParty ? 'intra' : 'inter';
    }

    // Calculate line item totals
    static calculateItemTotals(item, taxType = 'intra') {
        const qty = Number(item.qty) || 0;
        const price = Number(item.price) || 0;
        const discountPercent = Number(item.discountPercent) || 0;
        const taxRate = Number(item.taxRate) || 0;

        const gross = qty * price;
        const discountAmount = (gross * discountPercent) / 100;
        const taxableAmount = gross - discountAmount;

        let cgst = 0;
        let sgst = 0;
        let igst = 0;

        if (taxType === 'intra') {
            const halfRate = taxRate / 2;
            cgst = (taxableAmount * halfRate) / 100;
            sgst = (taxableAmount * halfRate) / 100;
        } else {
            igst = (taxableAmount * taxRate) / 100;
        }

        const totalTax = cgst + sgst + igst;
        const totalAmount = taxableAmount + totalTax;

        return {
            gross,
            discountAmount,
            taxableAmount,
            cgst,
            sgst,
            igst,
            totalTax,
            totalAmount
        };
    }

    // Calculate complete voucher totals
    static calculateVoucherTotals(items, taxType = 'intra', overallDiscountType = 'percentage', overallDiscountValue = 0, extraCharges = {}) {
        let subtotal = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;
        let totalTaxable = 0;

        const calculatedItems = items.map(itm => {
            const calcs = this.calculateItemTotals(itm, taxType);
            subtotal += calcs.gross;
            totalTaxable += calcs.taxableAmount;
            totalCgst += calcs.cgst;
            totalSgst += calcs.sgst;
            totalIgst += calcs.igst;

            return {
                ...itm,
                ...calcs
            };
        });

        // Overall discount on voucher
        let discountAmount = 0;
        const discVal = Number(overallDiscountValue) || 0;
        if (overallDiscountType === 'percentage') {
            discountAmount = (totalTaxable * discVal) / 100;
        } else {
            discountAmount = discVal;
        }

        // Adjust tax if overall discount applies
        let finalCgst = totalCgst;
        let finalSgst = totalSgst;
        let finalIgst = totalIgst;
        if (discountAmount > 0 && totalTaxable > 0) {
            const ratio = (totalTaxable - discountAmount) / totalTaxable;
            finalCgst *= ratio;
            finalSgst *= ratio;
            finalIgst *= ratio;
        }

        // Transporter / Freight Charges & GST
        const transporterCost = Number(extraCharges?.transporterCost) || 0;
        const transporterGstRate = Number(extraCharges?.transporterGstRate) || 0;
        let transporterTax = 0;
        let transporterCgst = 0;
        let transporterSgst = 0;
        let transporterIgst = 0;

        if (transporterCost > 0 && transporterGstRate > 0) {
            transporterTax = (transporterCost * transporterGstRate) / 100;
            if (taxType === 'intra') {
                transporterCgst = transporterTax / 2;
                transporterSgst = transporterTax / 2;
            } else {
                transporterIgst = transporterTax;
            }
        }

        const totalTaxableWithCharges = (totalTaxable - discountAmount) + transporterCost;
        finalCgst += transporterCgst;
        finalSgst += transporterSgst;
        finalIgst += transporterIgst;

        const totalTax = finalCgst + finalSgst + finalIgst;
        const rawGrandTotal = totalTaxableWithCharges + totalTax;

        // Auto Round-Off calculation to nearest Rupee
        const roundedGrandTotal = Math.round(rawGrandTotal);
        const roundOff = +(roundedGrandTotal - rawGrandTotal).toFixed(2);

        return {
            items: calculatedItems,
            subtotal,
            overallDiscountAmount: discountAmount,
            taxableTotal: totalTaxableWithCharges,
            itemsTaxableTotal: totalTaxable - discountAmount,
            transporterCost,
            transporterGstRate,
            transporterTax: +transporterTax.toFixed(2),
            transporterCgst: +transporterCgst.toFixed(2),
            transporterSgst: +transporterSgst.toFixed(2),
            transporterIgst: +transporterIgst.toFixed(2),
            cgst: +finalCgst.toFixed(2),
            sgst: +finalSgst.toFixed(2),
            igst: +finalIgst.toFixed(2),
            totalTax: +totalTax.toFixed(2),
            roundOff,
            grandTotal: roundedGrandTotal
        };
    }

    // Build standard Indian UPI QR Link
    static buildUpiPaymentLink(upiId, payeeName, amount, invoiceNo) {
        if (!upiId) return '';
        const cleanUpi = encodeURIComponent(upiId.trim());
        const cleanName = encodeURIComponent((payeeName || 'Merchant').trim());
        const cleanAmt = Number(amount).toFixed(2);
        const note = encodeURIComponent(`Bill ${invoiceNo}`);
        return `upi://pay?pa=${cleanUpi}&pn=${cleanName}&am=${cleanAmt}&cu=INR&tn=${note}`;
    }

    // Build WhatsApp invoice reminder text
    static buildWhatsAppMessage(voucher, company) {
        const partyName = voucher.partyName || 'Customer';
        const invNo = voucher.voucherNo;
        const date = this.formatDate(voucher.date);
        const total = this.formatCurrency(voucher.grandTotal);
        const due = this.formatCurrency(voucher.balanceDue);
        const upiId = company.bankDetails?.upiId || '';

        let msg = `*Invoice from ${company.businessName}*\n\n`;
        msg += `Dear ${partyName},\n`;
        msg += `Please find the details for your bill:\n\n`;
        msg += `📄 *Invoice No:* ${invNo}\n`;
        msg += `📅 *Date:* ${date}\n`;
        msg += `💰 *Total Amount:* ${total}\n`;
        msg += `⚖️ *Balance Due:* ${due}\n`;

        if (voucher.dueDate) {
            msg += `⏳ *Due Date:* ${this.formatDate(voucher.dueDate)}\n`;
        }

        if (voucher.balanceDue > 0 && upiId) {
            msg += `\n*Quick Payment Options:*\n`;
            msg += `• *UPI ID:* \`${upiId}\`\n`;
            if (company.bankDetails?.accountNumber) {
                msg += `• *Bank:* ${company.bankDetails.bankName}\n`;
                msg += `• *A/C No:* \`${company.bankDetails.accountNumber}\`\n`;
                msg += `• *IFSC:* \`${company.bankDetails.ifscCode}\`\n`;
            }
        }

        msg += `\nThank you for your business!\n_${company.businessName}_`;
        return encodeURIComponent(msg);
    }

    // Generate next serial number
    static generateNextVoucherNo(existingVouchers, prefix = 'INV-26/') {
        const matching = existingVouchers
            .map(v => v.voucherNo)
            .filter(no => no && no.startsWith(prefix));

        let maxSeq = 0;
        for (const no of matching) {
            const seqStr = no.replace(prefix, '');
            const seq = parseInt(seqStr, 10);
            if (!isNaN(seq) && seq > maxSeq) {
                maxSeq = seq;
            }
        }
        const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
        return `${prefix}${nextSeq}`;
    }
}

window.InvoiceEngine = InvoiceEngine;
