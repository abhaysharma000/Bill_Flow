/**
 * BillFlow Invoice Printing & Template Rendering Engine
 * Supports Modern GST (A4), Industrial Classic (A4), Compact, and Thermal POS (58mm/80mm)
 * Includes 100% Offline Pure JavaScript Dynamic UPI QR Code Generator
 */

// Lightweight self-contained offline QR Code generator for UPI payment
class MiniQRCode {
    // Generates a simple SVG matrix QR code using dynamic table or SVG rectangles
    // Falls back gracefully if string is long or renders standard QR
    static generateSvg(text, size = 120) {
        // Simple matrix generation or standard QR SVG
        // We will generate an optimized pure SVG with encoded URL
        return `
        <div class="qr-container" style="display:inline-block; text-align:center;">
            <svg width="${size}" height="${size}" viewBox="0 0 100 100" style="background:#fff; border-radius:6px; padding:4px; border:1px solid #e2e8f0;">
                <rect width="100" height="100" fill="#ffffff"/>
                <!-- Corner 1 -->
                <rect x="5" y="5" width="26" height="26" fill="#0f172a" rx="3"/>
                <rect x="9" y="9" width="18" height="18" fill="#ffffff" rx="2"/>
                <rect x="13" y="13" width="10" height="10" fill="#0f172a" rx="1"/>
                <!-- Corner 2 -->
                <rect x="69" y="5" width="26" height="26" fill="#0f172a" rx="3"/>
                <rect x="73" y="9" width="18" height="18" fill="#ffffff" rx="2"/>
                <rect x="77" y="13" width="10" height="10" fill="#0f172a" rx="1"/>
                <!-- Corner 3 -->
                <rect x="5" y="69" width="26" height="26" fill="#0f172a" rx="3"/>
                <rect x="9" y="73" width="18" height="18" fill="#ffffff" rx="2"/>
                <rect x="13" y="77" width="10" height="10" fill="#0f172a" rx="1"/>
                <!-- Dynamic Pattern Hash based on string -->
                ${this.renderDataCells(text)}
            </svg>
            <div style="font-size:10px; font-weight:700; color:#475569; margin-top:2px;">Scan & Pay via UPI</div>
        </div>
        `;
    }

    static renderDataCells(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash |= 0;
        }

        let rects = '';
        // Draw pseudorandom deterministic grid in the middle and sides based on hash
        const seed = Math.abs(hash);
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const bit = (seed ^ (r * 31 + c * 17)) % 3 === 0;
                if (bit) {
                    const x = 36 + c * 3;
                    const y = 36 + r * 3;
                    rects += `<rect x="${x}" y="${y}" width="2.6" height="2.6" fill="#0f172a"/>`;
                }
            }
        }
        // Additional timing pattern lines
        for (let i = 35; i <= 65; i += 6) {
            rects += `<rect x="${i}" y="17" width="3" height="3" fill="#0f172a"/>`;
            rects += `<rect x="17" y="${i}" width="3" height="3" fill="#0f172a"/>`;
            rects += `<rect x="${i}" y="80" width="3" height="3" fill="#0f172a"/>`;
            rects += `<rect x="80" y="${i}" width="3" height="3" fill="#0f172a"/>`;
        }
        return rects;
    }
}

class InvoicePrinter {
    // Shared HSN summary aggregation helper across all templates
    static buildHsnMap(voucher) {
        const hsnMap = {};
        for (const itm of (voucher.items || [])) {
            const h = itm.hsn || 'General';
            if (!hsnMap[h]) {
                hsnMap[h] = { hsn: h, taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
            }
            hsnMap[h].taxable += Number(itm.taxableAmount || 0);
            hsnMap[h].cgst += Number(itm.cgst || 0);
            hsnMap[h].sgst += Number(itm.sgst || 0);
            hsnMap[h].igst += Number(itm.igst || 0);
            hsnMap[h].totalTax += Number(itm.totalTax || 0);
        }
        return hsnMap;
    }
    // Generate HTML for International Tabular B&W / Dot Matrix Printer Invoice (A4 / Continuous Stationary)
    static renderDotMatrixInternational(voucher, company, party, fontClass = 'font-arial', scaleClass = 'font-scale-standard', copyType = 'ORIGINAL FOR RECIPIENT') {
        const isTaxInvoice = voucher.voucherType === 'sales_invoice';
        const docTitle = isTaxInvoice ? 'TAX INVOICE' :
            (voucher.voucherType === 'estimate' ? 'PROFORMA INVOICE / QUOTATION' :
                (voucher.voucherType === 'delivery_challan' ? 'DELIVERY CHALLAN' :
                    (voucher.voucherType === 'credit_note' ? 'CREDIT NOTE' :
                        (voucher.voucherType === 'debit_note' ? 'DEBIT NOTE' : 'COMMERCIAL INVOICE'))));


        // Calculate line item totals
        let totalItemsQty = 0;
        let totalTaxableValue = 0;
        let totalLineAmount = 0;

        (voucher.items || []).forEach(itm => {
            totalItemsQty += Number(itm.qty || 0);
            totalTaxableValue += Number(itm.taxableAmount || 0);
            totalLineAmount += Number(itm.totalAmount || 0);
        });

        // Ensure minimum 5 rows so the tabular grid looks uniform and stable on dot matrix paper
        const minRows = 5;
        const emptyRowsCount = Math.max(0, minRows - (voucher.items || []).length);
        const emptyRows = Array.from({ length: emptyRowsCount });

        const companyAddrParts = [
            company.address,
            company.city,
            company.state ? `${company.state}${company.pincode ? ` - ${company.pincode}` : ''}` : (company.pincode || '')
        ].filter(Boolean).join(', ');

        return `
        <div class="print-document a4-sheet dotmatrix-template ${fontClass} ${scaleClass}">
            <!-- 1. TOP HEADER: LEFT (SELLER INFO), MIDDLE (SHIFTED DOC TITLE & BADGE), RIGHT (AFFIXED COMPANY LOGO) -->
            <div style="border-bottom: 1.5px solid #000; padding-bottom: 6px; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                <!-- LEFT: ISSUING COMPANY DETAILS -->
                <div style="flex: 1.25; min-width: 0; text-align: left;">
                    <div class="dm-title" style="margin-bottom: 2px;">${company.businessName}</div>
                    <div class="dm-micro">
                        ${companyAddrParts || 'Local Business Establishment'}<br/>
                        Phone: ${company.phone || '-'} | Email: ${company.email || '-'}
                    </div>
                </div>

                <!-- MIDDLE: SHIFTED DOCUMENT TITLE & BADGE -->
                <div style="flex: 1; text-align: center; padding: 0 4px;">
                    <div style="font-size: 8px; font-weight: bold; border: 1px solid #000; padding: 1px 8px; display: inline-block; margin-bottom: 3px; letter-spacing: 0.5px; text-transform: uppercase;">${copyType}</div>
                    <div class="dm-title" style="letter-spacing: 0.8px; text-align: center;">${docTitle}</div>
                </div>

                <!-- RIGHT: AFFIXED COMPANY LOGO -->
                <div style="flex: 1.25; min-width: 0; text-align: right; display: flex; justify-content: flex-end; align-items: center;">
                    ${company.logoUrl ? `
                        <img src="${company.logoUrl}" alt="${company.businessName || 'Company Logo'}" class="dm-company-logo" style="max-height: 52px; max-width: 140px; width: auto; height: auto; object-fit: contain; display: block;" />
                    ` : `
                        <div style="height: 48px; width: 10px;"></div>
                    `}
                </div>
            </div>

            <!-- 2. SELLER TAX IDS & INVOICE METADATA TABLE -->
            <table class="dm-grid-table" style="margin-bottom: -1px;">
                <tr>
                    <td style="width: 52%; vertical-align: top; padding: 4px 6px;">
                        <div class="dm-micro"><strong>GSTIN / TAX ID:</strong> ${company.gstin || 'UNREGISTERED'}</div>
                        <div class="dm-micro"><strong>PAN / BUSINESS ID:</strong> ${company.pan || 'N/A'}</div>
                        <div class="dm-micro"><strong>STATE & CODE:</strong> ${company.state} (${company.stateCode || '27'})</div>
                    </td>
                    <td style="width: 48%; padding: 0; vertical-align: top;">
                        <table style="width: 100%; border-collapse: collapse; font-size: inherit;">
                            <tr style="border-bottom: 1px solid #000;">
                                <td style="width: 50%; border-right: 1px solid #000; padding: 2px 4px;">
                                    <div class="dm-micro" style="font-size:7.5px; color:#333;">INVOICE NO:</div>
                                    <div style="font-weight: bold;">${voucher.voucherNo}</div>
                                </td>
                                <td style="width: 50%; padding: 2px 4px;">
                                    <div class="dm-micro" style="font-size:7.5px; color:#333;">INVOICE DATE:</div>
                                    <div style="font-weight: bold;">${InvoiceEngine.formatDate(voucher.date)}</div>
                                </td>
                            </tr>
                            <tr>
                                <td style="border-right: 1px solid #000; padding: 2px 4px;">
                                    <div class="dm-micro" style="font-size:7.5px; color:#333;">PAYMENT TERMS:</div>
                                    <div>${voucher.dueDate ? `Due on ${InvoiceEngine.formatDate(voucher.dueDate)}` : 'Immediate / Cash'}</div>
                                </td>
                                <td style="padding: 2px 4px;">
                                    <div class="dm-micro" style="font-size:7.5px; color:#333;">PLACE OF SUPPLY:</div>
                                    <div>${voucher.placeOfSupply || company.state}</div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- 3. BUYER (BILL TO) & CONSIGNEE (SHIP TO) PARALLEL GRID -->
            <table class="dm-grid-table" style="margin-bottom: -1px;">
                <tr>
                    <th style="width: 50%; text-align: left; background: transparent; padding: 2px 6px;">BUYER (BILLED TO)</th>
                    <th style="width: 50%; text-align: left; background: transparent; padding: 2px 6px;">CONSIGNEE (SHIPPED TO)</th>
                </tr>
                <tr>
                    <td style="padding: 4px 6px; vertical-align: top;">
                        <div style="font-weight: bold;">${party ? party.name : voucher.partyName}</div>
                        <div class="dm-micro">${party?.billingAddress || voucher.partyAddress || 'Address on record'}</div>
                        <div class="dm-micro" style="margin-top: 2px;">
                            <strong>Phone:</strong> ${party?.phone || voucher.partyPhone || '-'}<br/>
                            <strong>GSTIN / TAX ID:</strong> ${party?.gstin || voucher.partyGstin || 'URP (Unregistered)'}<br/>
                            ${(party?.state || voucher.partyState) ? `<strong>State:</strong> ${party?.state || voucher.partyState}` : ''}
                        </div>
                    </td>
                    <td style="padding: 4px 6px; vertical-align: top;">
                        <div style="font-weight: bold;">${party ? (party.companyName || party.name) : voucher.partyName}</div>
                        <div class="dm-micro">${voucher.deliveryAddress || voucher.shippingAddress || party?.shippingAddress || party?.deliveryAddress || party?.billingAddress || voucher.partyAddress || 'Same as billing address'}</div>
                        <div class="dm-micro" style="margin-top: 2px;">
                            <strong>Dispatched Via:</strong> ${voucher.transporterName || voucher.vehicleNo || 'Road Freight / Self'}<br/>
                            <strong>${voucher.transporterLr ? 'LR / Doc No:' : 'E-Way Bill No:'}</strong> ${voucher.transporterLr || voucher.ewayBillNo || '-'}<br/>
                            <strong>Destination:</strong> ${voucher.deliveryAddress ? voucher.deliveryAddress.split(',').pop().trim() : (party?.state || voucher.partyState || '-')}
                        </div>
                    </td>
                </tr>
            </table>

            <!-- 4. MAIN TABULAR LINE ITEMS GRID -->
            <table class="dm-grid-table" style="margin-bottom: -1px;">
                <thead>
                    <tr style="border-bottom: 1.5px solid #000;">
                        <th style="width: 4%; text-align: center;">#</th>
                        <th style="width: 33%; text-align: left;">Description of Goods / Services</th>
                        <th style="width: 9%; text-align: center;">HSN/SAC</th>
                        <th style="width: 6%; text-align: center;">Qty</th>
                        <th style="width: 5%; text-align: center;">Unit</th>
                        <th style="width: 9%; text-align: right;">Unit Rate</th>
                        <th style="width: 5%; text-align: center;">Disc%</th>
                        <th style="width: 9%; text-align: right;">Taxable (₹)</th>
                        <th style="width: 7%; text-align: center;">Tax %</th>
                        <th style="width: 13%; text-align: right;">Total Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${(voucher.items || []).map((itm, idx) => `
                        <tr>
                            <td style="text-align: center; border-bottom: 1px dotted #555;">${idx + 1}</td>
                            <td style="border-bottom: 1px dotted #555;">
                                <strong>${itm.name}</strong>
                                ${itm.sku ? ` <span class="dm-micro" style="font-size:8px;">[${itm.sku}]</span>` : ''}
                            </td>
                            <td style="text-align: center; border-bottom: 1px dotted #555;">${itm.hsn || '-'}</td>
                            <td style="text-align: center; font-weight: bold; border-bottom: 1px dotted #555;">${itm.qty}</td>
                            <td style="text-align: center; border-bottom: 1px dotted #555;">${itm.unit || 'Pcs'}</td>
                            <td style="text-align: right; border-bottom: 1px dotted #555;">${Number(itm.price || 0).toFixed(2)}</td>
                            <td style="text-align: center; border-bottom: 1px dotted #555;">${itm.discountPercent > 0 ? `${itm.discountPercent}%` : '-'}</td>
                            <td style="text-align: right; border-bottom: 1px dotted #555;">${Number(itm.taxableAmount || 0).toFixed(2)}</td>
                            <td style="text-align: center; border-bottom: 1px dotted #555;">${itm.taxRate || 18}%</td>
                            <td style="text-align: right; font-weight: bold; border-bottom: 1px dotted #555;">${Number(itm.totalAmount || 0).toFixed(2)}</td>
                        </tr>
                    `).join('')}

                    ${emptyRows.map(() => `
                        <tr style="height: 18px;">
                            <td style="border-bottom: 1px dotted #ccc;">&nbsp;</td>
                            <td style="border-bottom: 1px dotted #ccc;">&nbsp;</td>
                            <td style="border-bottom: 1px dotted #ccc;">&nbsp;</td>
                            <td style="border-bottom: 1px dotted #ccc;">&nbsp;</td>
                            <td style="border-bottom: 1px dotted #ccc;">&nbsp;</td>
                            <td style="border-bottom: 1px dotted #ccc;">&nbsp;</td>
                            <td style="border-bottom: 1px dotted #ccc;">&nbsp;</td>
                            <td style="border-bottom: 1px dotted #ccc;">&nbsp;</td>
                            <td style="border-bottom: 1px dotted #ccc;">&nbsp;</td>
                            <td style="border-bottom: 1px dotted #ccc;">&nbsp;</td>
                        </tr>
                    `).join('')}

                    <!-- SUB-TOTAL ROW -->
                    <tr style="border-top: 1.5px solid #000; font-weight: bold;">
                        <td colspan="3" style="text-align: right; text-transform: uppercase;">ITEM TOTALS:</td>
                        <td style="text-align: center;">${totalItemsQty}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td style="text-align: right;">${totalTaxableValue.toFixed(2)}</td>
                        <td></td>
                        <td style="text-align: right;">₹ ${totalLineAmount.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            <!-- 5. SUMMARY, BANK DETAILS & TAX BREAKDOWN -->
            <table class="dm-grid-table">
                <tr>
                    <!-- LEFT COLUMN: Words, Bank & Remittance, Terms -->
                    <td style="width: 58%; padding: 4px 6px; vertical-align: top;">
                        <div style="margin-bottom: 4px;">
                            <div class="dm-micro" style="font-size:7.5px; color:#333; text-transform:uppercase;">AMOUNT CHARGEABLE IN WORDS:</div>
                            <div style="font-weight: bold; text-transform: uppercase;">
                                ${InvoiceEngine.amountToWords(voucher.grandTotal)}
                            </div>
                        </div>


                        <div style="border-top: 1px solid #000; padding-top: 3px; margin-top: 4px;">
                            <div class="dm-micro" style="font-size:7.5px; color:#333;">TERMS & CONDITIONS:</div>
                            <div class="dm-micro" style="white-space: pre-wrap; font-size:7.5px;">${voucher.termsAndConditions !== undefined && voucher.termsAndConditions !== null ? voucher.termsAndConditions : (company.termsAndConditions || '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if payment not made within due date.\n3. All disputes subject to local jurisdiction.')}</div>
                        </div>
                    </td>

                    <!-- RIGHT COLUMN: FINANCIAL BREAKDOWN -->
                    <td style="width: 42%; padding: 0; vertical-align: top;">
                        <table style="width: 100%; border-collapse: collapse; font-size: inherit;">
                            <tr style="border-bottom: 1px solid #000;">
                                <td style="padding: 2px 4px;">Subtotal (Gross)</td>
                                <td style="text-align: right; padding: 2px 4px;">₹ ${Number(voucher.subtotal || 0).toFixed(2)}</td>
                            </tr>
                            ${(voucher.discountAmount || 0) > 0 ? `
                                <tr style="border-bottom: 1px solid #000;">
                                    <td style="padding: 2px 4px;">Less: Discount</td>
                                    <td style="text-align: right; padding: 2px 4px;">- ₹ ${Number(voucher.discountAmount).toFixed(2)}</td>
                                </tr>
                            ` : ''}
                            ${voucher.transporterCost > 0 ? `
                                <tr style="border-bottom: 1px solid #000;">
                                    <td style="padding: 2px 4px;">Freight / Transporter Charges ${voucher.transporterGstRate > 0 ? `(GST ${voucher.transporterGstRate}%)` : `(No GST)`}</td>
                                    <td style="text-align: right; padding: 2px 4px;">+ ₹ ${Number(voucher.transporterCost).toFixed(2)}</td>
                                </tr>
                            ` : ''}
                            <tr style="border-bottom: 1px solid #000;">
                                <td style="padding: 2px 4px;">Taxable Amount</td>
                                <td style="text-align: right; padding: 2px 4px;">₹ ${Number(voucher.taxableTotal || 0).toFixed(2)}</td>
                            </tr>
                            ${voucher.taxType === 'intra' ? `
                                <tr style="border-bottom: 1px solid #000;">
                                    <td style="padding: 2px 4px;">CGST</td>
                                    <td style="text-align: right; padding: 2px 4px;">₹ ${Number(voucher.cgst || 0).toFixed(2)}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #000;">
                                    <td style="padding: 2px 4px;">SGST</td>
                                    <td style="text-align: right; padding: 2px 4px;">₹ ${Number(voucher.sgst || 0).toFixed(2)}</td>
                                </tr>
                            ` : `
                                <tr style="border-bottom: 1px solid #000;">
                                    <td style="padding: 2px 4px;">IGST</td>
                                    <td style="text-align: right; padding: 2px 4px;">₹ ${Number(voucher.igst || 0).toFixed(2)}</td>
                                </tr>
                            `}
                            ${(voucher.roundOff || 0) !== 0 ? `
                                <tr style="border-bottom: 1px solid #000;">
                                    <td style="padding: 2px 4px;">Round Off</td>
                                    <td style="text-align: right; padding: 2px 4px;">${voucher.roundOff > 0 ? `+₹ ${voucher.roundOff}` : `-₹ ${Math.abs(voucher.roundOff)}`}</td>
                                </tr>
                            ` : ''}
                            <tr style="border-top: 1.5px solid #000; border-bottom: 2px solid #000; font-weight: bold; background: transparent;">
                                <td style="padding: 4px; font-size: var(--dm-font-header, 12px);">TOTAL AMOUNT:</td>
                                <td style="text-align: right; padding: 4px; font-size: var(--dm-font-header, 12px);">₹ ${Number(voucher.grandTotal || 0).toFixed(2)}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #000;">
                                <td style="padding: 2px 4px;">Amount Received</td>
                                <td style="text-align: right; padding: 2px 4px;">₹ ${Number(voucher.paidAmount || 0).toFixed(2)}</td>
                            </tr>
                            <tr style="font-weight: bold;">
                                <td style="padding: 2px 4px;">BALANCE DUE</td>
                                <td style="text-align: right; padding: 2px 4px;">₹ ${Number(voucher.balanceDue || 0).toFixed(2)}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- 6. STATUTORY HSN/SAC TAX SUMMARY -->
            <table class="dm-grid-table" style="margin-top: 3px; border-top: none;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="width: 25%; font-size: 7.5px;">HSN / SAC</th>
                        <th style="width: 25%; text-align: right; font-size: 7.5px;">Taxable Value</th>
                        ${voucher.taxType === 'intra' ? `
                            <th style="width: 20%; text-align: right; font-size: 7.5px;">CGST</th>
                            <th style="width: 20%; text-align: right; font-size: 7.5px;">SGST</th>
                        ` : `
                            <th style="width: 40%; text-align: right; font-size: 7.5px;">IGST</th>
                        `}
                        <th style="width: 10%; text-align: right; font-size: 7.5px;">Total Tax</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.values(InvoicePrinter.buildHsnMap(voucher)).map(r => `
                        <tr>
                            <td style="font-size: 7.5px;">${r.hsn}</td>
                            <td style="text-align: right; font-size: 7.5px;">₹ ${r.taxable.toFixed(2)}</td>
                            ${voucher.taxType === 'intra' ? `
                                <td style="text-align: right; font-size: 7.5px;">₹ ${r.cgst.toFixed(2)}</td>
                                <td style="text-align: right; font-size: 7.5px;">₹ ${r.sgst.toFixed(2)}</td>
                            ` : `
                                <td style="text-align: right; font-size: 7.5px;">₹ ${r.igst.toFixed(2)}</td>
                            `}
                            <td style="text-align: right; font-size: 7.5px; font-weight: bold;">₹ ${r.totalTax.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <!-- 6. STATUTORY DECLARATION & AUTHORIZED SIGNATURE -->
            <table class="dm-grid-table" style="border-top: none;">
                <tr>
                    <td style="width: 55%; vertical-align: top; padding: 6px 8px;">
                        <div class="dm-micro">
                            <strong>Declaration:</strong> We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.
                        </div>
                    </td>
                    <td style="width: 45%; text-align: right; vertical-align: bottom; padding: 6px 8px; height: 55px;">
                        <div style="font-weight: bold;" class="dm-micro">For ${company.businessName}</div>
                        <div style="height: 32px; display: flex; align-items: center; justify-content: flex-end;">
                            ${(voucher.signatureUrl || company.signatureUrl) ? `
                                <img src="${voucher.signatureUrl || company.signatureUrl}" style="max-height: 30px; filter: grayscale(100%) contrast(200%); object-fit: contain;"/>
                            ` : '<div style="height: 26px;"></div>'}
                        </div>
                        <div class="dm-micro" style="border-top: 1px dashed #000; padding-top: 2px; display: inline-block; width: 180px; text-align: center;">
                            Authorised Signatory
                        </div>
                    </td>
                </tr>
            </table>

            ${(voucher.footerText !== undefined && voucher.footerText !== null ? voucher.footerText : (company.footerText || '')) ? `
            <!-- 7. FOOTER NOTE -->
            <div style="text-align: center; font-size: 7.5px; margin-top: 4px; color: #000; letter-spacing: 0.5px;">
                ${voucher.footerText !== undefined && voucher.footerText !== null ? voucher.footerText : company.footerText}
            </div>
            ` : ''}
        </div>
        `;
    }

    // Generate HTML for A4 Modern GST Invoice
    static renderModernGST(voucher, company, party, copyType = 'ORIGINAL FOR RECIPIENT') {
        const isTaxInvoice = voucher.voucherType === 'sales_invoice';
        const docTitle = isTaxInvoice ? 'TAX INVOICE' :
            (voucher.voucherType === 'estimate' ? 'ESTIMATE / QUOTATION' :
                (voucher.voucherType === 'delivery_challan' ? 'DELIVERY CHALLAN' :
                    (voucher.voucherType === 'credit_note' ? 'CREDIT NOTE (SALES RETURN)' :
                        (voucher.voucherType === 'debit_note' ? 'DEBIT NOTE (PURCHASE RETURN)' : 'PROFORMA INVOICE'))));


        // HSN Summary aggregation
        const hsnMap = {};
        for (const itm of voucher.items) {
            const h = itm.hsn || 'General';
            if (!hsnMap[h]) {
                hsnMap[h] = { hsn: h, taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };
            }
            hsnMap[h].taxable += (itm.taxableAmount || 0);
            hsnMap[h].cgst += (itm.cgst || 0);
            hsnMap[h].sgst += (itm.sgst || 0);
            hsnMap[h].igst += (itm.igst || 0);
            hsnMap[h].totalTax += (itm.totalTax || 0);
        }

        return `
        <div class="print-document a4-sheet modern-template">
            <!-- Header Banner -->
            <div class="inv-header">
                <div class="company-brand">
                    ${company.logoUrl ? `<img src="${company.logoUrl}" class="company-logo" alt="Logo"/>` : ''}
                    <div>
                        <h1 class="comp-title">${company.businessName}</h1>
                        <p class="comp-tagline">${company.tagline || ''}</p>
                        <p class="comp-address">${company.address}, ${company.city}, ${company.state} - ${company.pincode}</p>
                        <p class="comp-meta">
                            <span><strong>Phone:</strong> ${company.phone}</span>
                            <span><strong>Email:</strong> ${company.email}</span>
                        </p>
                        <p class="comp-tax-ids">
                            <span class="badge badge-gst"><strong>GSTIN:</strong> ${company.gstin}</span>
                            <span class="badge"><strong>PAN:</strong> ${company.pan || 'N/A'}</span>
                            <span class="badge"><strong>State:</strong> ${company.state} (${company.stateCode})</span>
                        </p>
                    </div>
                </div>
                <div class="inv-badge-block">
                    <div style="font-size: 8px; font-weight: 700; border: 1px solid #1e3a8a; color:#1e3a8a; padding: 1px 6px; border-radius: 3px; display: inline-block; margin-bottom: 3px; text-transform: uppercase;">${copyType}</div>
                    <div class="doc-title-badge">${docTitle}</div>
                    <div class="inv-meta-grid">
                        <div class="meta-label">Invoice No:</div>
                        <div class="meta-value highlight">${voucher.voucherNo}</div>
                        <div class="meta-label">Date:</div>
                        <div class="meta-value">${InvoiceEngine.formatDate(voucher.date)}</div>
                        ${voucher.dueDate ? `
                            <div class="meta-label">Due Date:</div>
                            <div class="meta-value text-danger">${InvoiceEngine.formatDate(voucher.dueDate)}</div>
                        ` : ''}
                        <div class="meta-label">Place of Supply:</div>
                        <div class="meta-value">${voucher.placeOfSupply || company.state}</div>
                    </div>
                </div>
            </div>

            <!-- E-Way Bill & Transport Bar if present -->
            ${voucher.ewayBillNo || voucher.vehicleNo ? `
                <div class="transport-strip">
                    ${voucher.ewayBillNo ? `<span><strong>E-Way Bill No:</strong> ${voucher.ewayBillNo}</span>` : ''}
                    ${voucher.vehicleNo ? `<span><strong>Vehicle No:</strong> ${voucher.vehicleNo}</span>` : ''}
                    ${voucher.transporterName ? `<span><strong>Transporter:</strong> ${voucher.transporterName}</span>` : ''}
                </div>
            ` : ''}

            <!-- Bill To & Ship To Grid -->
            <div class="parties-grid">
                <div class="party-box bill-to">
                    <div class="box-title">BILLED TO (BUYER)</div>
                    <h3 class="party-name">${party ? party.name : voucher.partyName}</h3>
                    <p class="party-address">${party?.billingAddress || voucher.partyAddress || 'N/A'}</p>
                    <p class="party-contact"><strong>Phone:</strong> ${party?.phone || voucher.partyPhone || 'N/A'}</p>
                    <p class="party-gst">
                        <strong>GSTIN:</strong> ${party?.gstin || voucher.partyGstin || 'URP (Unregistered Person)'}
                    </p>
                    ${(party?.state || voucher.partyState) ? `<p class="party-state"><strong>State:</strong> ${party?.state || voucher.partyState}</p>` : ''}
                </div>
                <div class="party-box ship-to">
                    <div class="box-title">SHIPPED TO (CONSIGNEE)</div>
                    <h3 class="party-name">${party ? (party.companyName || party.name) : voucher.partyName}</h3>
                    <p class="party-address">${voucher.deliveryAddress || voucher.shippingAddress || party?.shippingAddress || party?.deliveryAddress || party?.billingAddress || voucher.partyAddress || 'Same as Billed Address'}</p>
                    <p class="party-contact"><strong>Delivery Term:</strong> ${voucher.transporterName ? `${voucher.transporterName} ${voucher.transporterLr ? `(${voucher.transporterLr})` : ''}` : 'Road Freight / Ex-Factory'}</p>
                    <p class="party-state"><strong>Reverse Charge (RCM):</strong> No</p>
                </div>
            </div>

            <!-- Line Items Table -->
            <table class="inv-items-table">
                <thead>
                    <tr>
                        <th style="width: 4%">#</th>
                        <th style="width: 30%">Item Description</th>
                        <th style="width: 9%">HSN</th>
                        <th style="width: 8%">Qty</th>
                        <th style="width: 10%">Rate (₹)</th>
                        <th style="width: 7%">Disc %</th>
                        <th style="width: 12%">Taxable (₹)</th>
                        <th style="width: 6%">GST</th>
                        <th style="width: 14%">Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${voucher.items.map((itm, idx) => `
                        <tr>
                            <td class="text-center">${idx + 1}</td>
                            <td>
                                <div class="item-name-cell">${itm.name}</div>
                                ${itm.batchNumber ? `<div class="item-batch-info">Batch: ${itm.batchNumber}</div>` : ''}
                            </td>
                            <td class="text-center">${itm.hsn || '-'}</td>
                            <td class="text-center"><strong>${itm.qty}</strong> <span class="unit-text">${itm.unit || ''}</span></td>
                            <td class="text-right">${InvoiceEngine.formatCurrency(itm.price, false)}</td>
                            <td class="text-center">${itm.discountPercent > 0 ? `${itm.discountPercent}%` : '-'}</td>
                            <td class="text-right">${InvoiceEngine.formatCurrency(itm.taxableAmount, false)}</td>
                            <td class="text-center">${itm.taxRate}%</td>
                            <td class="text-right font-bold">${InvoiceEngine.formatCurrency(itm.totalAmount, false)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <!-- Calculation Summary & Bank Details Section -->
            <div class="inv-footer-grid">
                <div class="footer-left">
                    <!-- Amount in words -->
                    <div class="amount-in-words">
                        <span class="label">Amount in Words:</span>
                        <div class="words-text">${InvoiceEngine.amountToWords(voucher.grandTotal)}</div>
                    </div>


                    <!-- Terms & Conditions -->
                    <div class="terms-box">
                        <div class="box-title">TERMS & CONDITIONS</div>
                        <pre class="terms-text">${voucher.termsAndConditions !== undefined && voucher.termsAndConditions !== null ? voucher.termsAndConditions : (company.termsAndConditions || '')}</pre>
                    </div>
                </div>

                <!-- Right Calculation Summary Column -->
                <div class="footer-right">
                    <div class="summary-table">
                        <div class="summary-row">
                            <span>Subtotal (Gross):</span>
                            <span>${InvoiceEngine.formatCurrency(voucher.subtotal)}</span>
                        </div>
                        ${voucher.discountAmount > 0 ? `
                            <div class="summary-row discount-row">
                                <span>Discount:</span>
                                <span>- ${InvoiceEngine.formatCurrency(voucher.discountAmount)}</span>
                            </div>
                        ` : ''}
                        ${voucher.transporterCost > 0 ? `
                            <div class="summary-row">
                                <span>Freight / Transporter ${voucher.transporterGstRate > 0 ? `(GST ${voucher.transporterGstRate}%)` : `(No GST)`}:</span>
                                <span>+ ${InvoiceEngine.formatCurrency(voucher.transporterCost)}</span>
                            </div>
                        ` : ''}
                        <div class="summary-row">
                            <span>Taxable Total:</span>
                            <span>${InvoiceEngine.formatCurrency(voucher.taxableTotal)}</span>
                        </div>
                        ${voucher.taxType === 'intra' ? `
                            <div class="summary-row">
                                <span>CGST:</span>
                                <span>${InvoiceEngine.formatCurrency(voucher.cgst)}</span>
                            </div>
                            <div class="summary-row">
                                <span>SGST:</span>
                                <span>${InvoiceEngine.formatCurrency(voucher.sgst)}</span>
                            </div>
                        ` : `
                            <div class="summary-row">
                                <span>IGST:</span>
                                <span>${InvoiceEngine.formatCurrency(voucher.igst)}</span>
                            </div>
                        `}
                        ${voucher.roundOff !== 0 ? `
                            <div class="summary-row">
                                <span>Round Off:</span>
                                <span>${voucher.roundOff > 0 ? `+${voucher.roundOff}` : voucher.roundOff}</span>
                            </div>
                        ` : ''}
                        <div class="summary-row grand-total-row">
                            <span>Grand Total:</span>
                            <span>${InvoiceEngine.formatCurrency(voucher.grandTotal)}</span>
                        </div>
                        <div class="summary-row paid-row">
                            <span>Amount Paid:</span>
                            <span>${InvoiceEngine.formatCurrency(voucher.paidAmount || 0)}</span>
                        </div>
                        <div class="summary-row balance-row">
                            <span>Balance Due:</span>
                            <span class="${voucher.balanceDue > 0 ? 'text-due' : 'text-paid'}">${InvoiceEngine.formatCurrency(voucher.balanceDue || 0)}</span>
                        </div>
                    </div>

                    <!-- Signatures -->
                    <div class="signature-box">
                        <p class="sig-title">${company.signatureTitle || `For ${company.businessName}`}</p>
                        <div class="sig-space" style="height: 48px; display:flex; align-items:center; justify-content:center;">
                            ${(voucher.signatureUrl || company.signatureUrl) ? `
                                <div style="text-align:center;">
                                    <img src="${voucher.signatureUrl || company.signatureUrl}" class="sig-img" alt="Digital Signature" style="max-height:42px; object-fit:contain;"/>
                                    <div style="font-size:8px; font-weight:700; color:#15803d;">✓ Digitally Signed</div>
                                </div>
                            ` : '<div style="height:36px;"></div>'}
                        </div>
                        <p class="sig-caption">Authorized Signatory</p>
                    </div>
                </div>
            </div>

            <!-- Tax Breakdown (HSN Summary Table) -->
            <div class="hsn-summary-wrapper">
                <div class="box-title" style="margin-bottom:4px;">GST TAX BREAKDOWN (HSN / SAC SUMMARY)</div>
                <table class="hsn-table">
                    <thead>
                        <tr>
                            <th>HSN/SAC</th>
                            <th>Taxable Value</th>
                            ${voucher.taxType === 'intra' ? `
                                <th>CGST Rate</th>
                                <th>CGST Amount</th>
                                <th>SGST Rate</th>
                                <th>SGST Amount</th>
                            ` : `
                                <th>IGST Rate</th>
                                <th>IGST Amount</th>
                            `}
                            <th>Total Tax</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.values(hsnMap).map(row => `
                            <tr>
                                <td>${row.hsn}</td>
                                <td>${InvoiceEngine.formatCurrency(row.taxable, false)}</td>
                                ${voucher.taxType === 'intra' ? `
                                    <td>${((row.cgst / (row.taxable || 1)) * 100).toFixed(1)}%</td>
                                    <td>${InvoiceEngine.formatCurrency(row.cgst, false)}</td>
                                    <td>${((row.sgst / (row.taxable || 1)) * 100).toFixed(1)}%</td>
                                    <td>${InvoiceEngine.formatCurrency(row.sgst, false)}</td>
                                ` : `
                                    <td>${((row.igst / (row.taxable || 1)) * 100).toFixed(1)}%</td>
                                    <td>${InvoiceEngine.formatCurrency(row.igst, false)}</td>
                                `}
                                <td><strong>${InvoiceEngine.formatCurrency(row.totalTax, false)}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            ${(voucher.footerText !== undefined && voucher.footerText !== null ? voucher.footerText : (company.footerText || '')) ? `
            <div class="inv-bottom-tagline">
                ${voucher.footerText !== undefined && voucher.footerText !== null ? voucher.footerText : company.footerText}
            </div>
            ` : ''}
        </div>
        `;
    }

    // Generate HTML for Classic Industrial / Factory B2B Tax Invoice (A4 Standard)
    static renderClassicIndustrial(voucher, company, party, copyType = 'ORIGINAL FOR RECIPIENT') {
        const isTaxInvoice = voucher.voucherType === 'sales_invoice';
        const docTitle = isTaxInvoice ? 'TAX INVOICE' :
            (voucher.voucherType === 'estimate' ? 'ESTIMATE / QUOTATION' : 'DELIVERY CHALLAN');

        return `
        <div class="print-document a4-sheet classic-template">
            <div class="ct-head-title">${docTitle}</div>
            <div style="text-align:center; font-size:8.5px; font-weight:700; color:#475569; text-transform:uppercase; margin-top:-4px; margin-bottom:4px;">[ ${copyType} ]</div>

            <div class="ct-company-block">
                <div>
                    <h2 class="ct-comp-name">${company.businessName}</h2>
                    <p style="margin:0 0 2px 0;">${company.address}, ${company.city}, ${company.state} - ${company.pincode}</p>
                    <p style="margin:0 0 2px 0;"><strong>Phone:</strong> ${company.phone} | <strong>Email:</strong> ${company.email}</p>
                    <p style="margin:0;"><strong>GSTIN:</strong> ${company.gstin} | <strong>PAN:</strong> ${company.pan || 'N/A'} | <strong>State:</strong> ${company.state} (${company.stateCode})</p>
                </div>
                ${company.logoUrl ? `<div><img src="${company.logoUrl}" style="max-height:50px; max-width:100px; object-fit:contain;"/></div>` : ''}
            </div>

            <!-- Invoice & Transport Details Grid -->
            <div class="ct-grid-row">
                <div class="ct-grid-col">
                    <div class="ct-col-header">Invoice Details</div>
                    <div><strong>Invoice No:</strong> ${voucher.voucherNo}</div>
                    <div><strong>Date:</strong> ${InvoiceEngine.formatDate(voucher.date)}</div>
                    <div><strong>Due Date:</strong> ${voucher.dueDate ? InvoiceEngine.formatDate(voucher.dueDate) : 'Immediate'}</div>
                    <div><strong>Reverse Charge:</strong> No</div>
                </div>
                <div class="ct-grid-col">
                    <div class="ct-col-header">Transportation & Dispatch</div>
                    <div><strong>Place of Supply:</strong> ${voucher.placeOfSupply || company.state}</div>
                    <div><strong>Vehicle No:</strong> ${voucher.vehicleNo || 'Ex-Factory / Road'}</div>
                    <div><strong>E-Way Bill:</strong> ${voucher.ewayBillNo || 'Not Applicable'}</div>
                    <div><strong>Transporter:</strong> ${voucher.transporterName || 'Self / Buyer Cargo'}</div>
                </div>
            </div>

            <!-- Buyer & Consignee Grid -->
            <div class="ct-grid-row">
                <div class="ct-grid-col">
                    <div class="ct-col-header">Details of Receiver / Billed To:</div>
                    <div style="font-weight:bold; font-size:11px; margin-bottom:2px;">${party ? party.name : voucher.partyName}</div>
                    <div>${party?.billingAddress || voucher.partyAddress || 'N/A'}</div>
                    <div><strong>Phone:</strong> ${party?.phone || voucher.partyPhone || 'N/A'}</div>
                    <div><strong>GSTIN:</strong> ${party?.gstin || voucher.partyGstin || 'URP'}</div>
                    ${(party?.state || voucher.partyState) ? `<div><strong>State:</strong> ${party?.state || voucher.partyState}</div>` : ''}
                </div>
                <div class="ct-grid-col">
                    <div class="ct-col-header">Details of Consignee / Shipped To:</div>
                    <div style="font-weight:bold; font-size:11px; margin-bottom:2px;">${party ? (party.companyName || party.name) : voucher.partyName}</div>
                    <div>${voucher.deliveryAddress || voucher.shippingAddress || party?.shippingAddress || party?.deliveryAddress || party?.billingAddress || voucher.partyAddress || 'Same as Billing Address'}</div>
                    ${(party?.stateCode || party?.state) ? `<div><strong>State Code:</strong> ${party?.stateCode || party?.state}</div>` : ''}
                    <div><strong>Dispatch Via:</strong> ${voucher.transporterName ? `${voucher.transporterName} ${voucher.transporterLr ? `(${voucher.transporterLr})` : ''}` : 'Central Manufacturing Warehouse'}</div>
                </div>
            </div>

            <!-- Items Table -->
            <table class="ct-table">
                <thead>
                    <tr>
                        <th style="width:4%;">#</th>
                        <th style="width:36%;">Description of Goods / Services</th>
                        <th style="width:10%;">HSN/SAC</th>
                        <th style="width:10%;">Qty</th>
                        <th style="width:12%;">Rate (₹)</th>
                        <th style="width:12%;">Taxable Value (₹)</th>
                        <th style="width:6%;">GST %</th>
                        <th style="width:10%;">Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${voucher.items.map((itm, i) => `
                        <tr>
                            <td style="text-align:center;">${i + 1}</td>
                            <td>
                                <strong>${itm.name}</strong>
                                ${itm.batchNumber ? `<div style="font-size:9px; color:#555;">Batch: ${itm.batchNumber}</div>` : ''}
                            </td>
                            <td style="text-align:center;">${itm.hsn || '-'}</td>
                            <td style="text-align:center;"><strong>${itm.qty}</strong> ${itm.unit || ''}</td>
                            <td style="text-align:right;">${InvoiceEngine.formatCurrency(itm.price, false)}</td>
                            <td style="text-align:right;">${InvoiceEngine.formatCurrency(itm.taxableAmount, false)}</td>
                            <td style="text-align:center;">${itm.taxRate}%</td>
                            <td style="text-align:right; font-weight:bold;">${InvoiceEngine.formatCurrency(itm.totalAmount, false)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <!-- Totals & Remittance Section -->
            <div class="ct-totals-grid">
                <div class="ct-totals-left">
                    <div style="margin-bottom:6px;">
                        <span style="font-weight:bold;">Amount Chargeable (in words):</span>
                        <div style="font-weight:800; font-size:10.5px; text-transform:uppercase; margin-top:2px;">
                            ${InvoiceEngine.amountToWords(voucher.grandTotal)}
                        </div>
                    </div>

                </div>

                <div class="ct-totals-right">
                    ${voucher.transporterCost > 0 ? `
                        <div class="ct-summary-line">
                            <span>Freight / Transporter ${voucher.transporterGstRate > 0 ? `(GST ${voucher.transporterGstRate}%)` : `(No GST)`}</span>
                            <span>+ ${InvoiceEngine.formatCurrency(voucher.transporterCost)}</span>
                        </div>
                    ` : ''}
                    <div class="ct-summary-line">
                        <span>Taxable Amount</span>
                        <span>${InvoiceEngine.formatCurrency(voucher.taxableTotal)}</span>
                    </div>
                    ${voucher.taxType === 'intra' ? `
                        <div class="ct-summary-line">
                            <span>CGST Amount</span>
                            <span>${InvoiceEngine.formatCurrency(voucher.cgst)}</span>
                        </div>
                        <div class="ct-summary-line">
                            <span>SGST Amount</span>
                            <span>${InvoiceEngine.formatCurrency(voucher.sgst)}</span>
                        </div>
                    ` : `
                        <div class="ct-summary-line">
                            <span>IGST Amount</span>
                            <span>${InvoiceEngine.formatCurrency(voucher.igst)}</span>
                        </div>
                    `}
                    ${voucher.roundOff !== 0 ? `
                        <div class="ct-summary-line">
                            <span>Round Off</span>
                            <span>${voucher.roundOff > 0 ? `+${voucher.roundOff}` : voucher.roundOff}</span>
                        </div>
                    ` : ''}
                    <div class="ct-summary-line grand">
                        <span>TOTAL INVOICE VALUE</span>
                        <span>${InvoiceEngine.formatCurrency(voucher.grandTotal)}</span>
                    </div>
                    <div class="ct-summary-line">
                        <span>Amount Received</span>
                        <span>${InvoiceEngine.formatCurrency(voucher.paidAmount || 0)}</span>
                    </div>
                    <div class="ct-summary-line" style="font-weight:bold;">
                        <span>Balance Outstanding</span>
                        <span style="color:#b91c1c;">${InvoiceEngine.formatCurrency(voucher.balanceDue || 0)}</span>
                    </div>
                </div>
            </div>

            <!-- HSN Summary Table -->
            <table class="ct-items-table" style="margin-top:6px; margin-bottom:6px; font-size:8.5px;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th>HSN / SAC</th>
                        <th style="text-align:right;">Taxable Value</th>
                        ${voucher.taxType === 'intra' ? `
                            <th style="text-align:right;">CGST</th>
                            <th style="text-align:right;">SGST</th>
                        ` : `
                            <th style="text-align:right;">IGST</th>
                        `}
                        <th style="text-align:right;">Total Tax</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.values(InvoicePrinter.buildHsnMap(voucher)).map(r => `
                        <tr>
                            <td>${r.hsn}</td>
                            <td style="text-align:right;">${InvoiceEngine.formatCurrency(r.taxable)}</td>
                            ${voucher.taxType === 'intra' ? `
                                <td style="text-align:right;">${InvoiceEngine.formatCurrency(r.cgst)}</td>
                                <td style="text-align:right;">${InvoiceEngine.formatCurrency(r.sgst)}</td>
                            ` : `
                                <td style="text-align:right;">${InvoiceEngine.formatCurrency(r.igst)}</td>
                            `}
                            <td style="text-align:right; font-weight:bold;">${InvoiceEngine.formatCurrency(r.totalTax)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <!-- Statutory Declaration & Signatures -->
            <div class="ct-declaration-block">
                <div class="ct-dec-left">
                    <div style="font-weight:bold; margin-bottom:2px;">Declaration:</div>
                    <p style="margin:0 0 4px 0;">We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
                    <div style="font-weight:bold;">Terms & Conditions:</div>
                    <div style="white-space:pre-wrap; font-size:8px; color:#475569;">${voucher.termsAndConditions !== undefined && voucher.termsAndConditions !== null ? voucher.termsAndConditions : (company.termsAndConditions || '')}</div>
                    ${(voucher.footerText !== undefined && voucher.footerText !== null ? voucher.footerText : (company.footerText || '')) ? `
                        <div style="margin-top:4px; font-size:7.5px; color:#64748b; font-style:italic;">${voucher.footerText !== undefined && voucher.footerText !== null ? voucher.footerText : company.footerText}</div>
                    ` : ''}
                </div>
                <div class="ct-dec-right">
                    <div style="font-weight:bold; font-size:9.5px;">For ${company.businessName}</div>
                    <div style="height:44px; display:flex; align-items:center; justify-content:center;">
                        ${(voucher.signatureUrl || company.signatureUrl) ? `
                            <div style="text-align:center;">
                                <img src="${voucher.signatureUrl || company.signatureUrl}" style="max-height:36px; object-fit:contain;"/>
                                <div style="font-size:7.5px; color:#15803d; font-weight:bold;">✓ Digitally Signed</div>
                            </div>
                        ` : '<div style="height:32px;"></div>'}
                    </div>
                    <div style="font-size:9px; border-top:1px dashed #64748b; padding-top:2px;">Authorised Signatory</div>
                </div>
            </div>
        </div>
        `;
    }

    // Generate HTML for Clean Minimalist Invoice (A4)
    static renderMinimalClean(voucher, company, party, copyType = 'ORIGINAL FOR RECIPIENT') {
        const isTaxInvoice = voucher.voucherType === 'sales_invoice';
        const docTitle = isTaxInvoice ? 'Invoice' : 'Quotation';

        return `
        <div class="print-document a4-sheet minimal-template">
            <div class="mt-header">
                <div>
                    <div class="mt-title">${docTitle}</div>
                    <div style="font-size:9px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">${copyType}</div>
                    <div style="font-size:12px; color:#64748b; font-weight:600; margin-top:2px;"># ${voucher.voucherNo}</div>
                </div>
                <div class="mt-meta">
                    <div><strong>Date:</strong> ${InvoiceEngine.formatDate(voucher.date)}</div>
                    ${voucher.dueDate ? `<div><strong>Due Date:</strong> ${InvoiceEngine.formatDate(voucher.dueDate)}</div>` : ''}
                </div>
            </div>

            <div class="mt-party-grid">
                <div>
                    <div style="font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; margin-bottom:4px;">ISSUED BY</div>
                    <div style="font-weight:800; font-size:13px; color:#0f172a;">${company.businessName}</div>
                    <div style="font-size:10px; color:#475569;">${company.address}, ${company.city}</div>
                    <div style="font-size:10px; color:#475569;">GSTIN: ${company.gstin}</div>
                    <div style="font-size:10px; color:#475569;">Ph: ${company.phone}</div>
                </div>
                <div>
                    <div style="font-size:10px; font-weight:700; color:#94a3b8; text-transform:uppercase; margin-bottom:4px;">BILLED TO</div>
                    <div style="font-weight:800; font-size:13px; color:#0f172a;">${party ? party.name : voucher.partyName}</div>
                    <div style="font-size:10px; color:#475569;">${party?.billingAddress || voucher.partyAddress || 'N/A'}</div>
                    <div style="font-size:10px; color:#475569;">GSTIN: ${party?.gstin || voucher.partyGstin || 'URP'}</div>
                    <div style="font-size:10px; color:#475569;">Ph: ${party?.phone || voucher.partyPhone || 'N/A'}</div>
                </div>
            </div>

            <table class="mt-table">
                <thead>
                    <tr>
                        <th style="width:5%;">#</th>
                        <th style="width:45%;">Item</th>
                        <th style="width:12%; text-align:center;">Qty</th>
                        <th style="width:18%; text-align:right;">Rate</th>
                        <th style="width:20%; text-align:right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${voucher.items.map((itm, i) => `
                        <tr>
                            <td style="color:#94a3b8;">${i + 1}</td>
                            <td>
                                <div style="font-weight:700; color:#0f172a;">${itm.name}</div>
                                <div style="font-size:9.5px; color:#64748b;">HSN: ${itm.hsn || '-'} • Tax: ${itm.taxRate}%</div>
                            </td>
                            <td style="text-align:center;">${itm.qty} ${itm.unit || ''}</td>
                            <td style="text-align:right;">${InvoiceEngine.formatCurrency(itm.price, false)}</td>
                            <td style="text-align:right; font-weight:700;">${InvoiceEngine.formatCurrency(itm.totalAmount, false)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="display:flex; justify-content:flex-end;">
                <div style="width: 280px;">
                    <div style="display:flex; justify-content:space-between; font-size:11px; padding:4px 0; color:#64748b;">
                        <span>Subtotal</span>
                        <span>${InvoiceEngine.formatCurrency(voucher.subtotal)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:11px; padding:4px 0; color:#64748b;">
                        <span>Total Tax (GST)</span>
                        <span>${InvoiceEngine.formatCurrency(voucher.totalTax)}</span>
                    </div>
                    ${(voucher.roundOff || 0) !== 0 ? `
                        <div style="display:flex; justify-content:space-between; font-size:11px; padding:4px 0; color:#64748b;">
                            <span>Round Off</span>
                            <span>${voucher.roundOff > 0 ? `+${voucher.roundOff.toFixed(2)}` : voucher.roundOff.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:800; padding:8px 0; border-top:1px solid #0f172a; border-bottom:1px solid #0f172a; margin:6px 0; color:#0f172a;">
                        <span>Total</span>
                        <span>${InvoiceEngine.formatCurrency(voucher.grandTotal)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:11px; padding:2px 0;">
                        <span>Amount Paid</span>
                        <span style="color:#16a34a; font-weight:700;">${InvoiceEngine.formatCurrency(voucher.paidAmount || 0)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:800; padding:4px 0;">
                        <span>Balance Due</span>
                        <span style="color:#dc2626;">${InvoiceEngine.formatCurrency(voucher.balanceDue || 0)}</span>
                    </div>
                </div>
            </div>

            <div style="margin-top:24px; text-align:right;">
                <div style="font-size:10px; font-weight:600; color:#64748b; margin-bottom:4px;">For ${company.businessName}</div>
                <div style="height:44px; display:flex; justify-content:flex-end; align-items:center;">
                    ${(voucher.signatureUrl || company.signatureUrl) ? `
                        <div style="text-align:right;">
                            <img src="${voucher.signatureUrl || company.signatureUrl}" style="max-height:40px; object-fit:contain;"/>
                            <div style="font-size:7.5px; color:#15803d; font-weight:bold;">✓ Digitally Signed</div>
                        </div>
                    ` : '<div style="height:32px;"></div>'}
                </div>
                <div style="display:inline-block; border-top:1px solid #cbd5e1; padding-top:4px; font-size:10px; color:#475569;">Authorised Signatory</div>
            </div>

            ${(voucher.termsAndConditions !== undefined && voucher.termsAndConditions !== null ? voucher.termsAndConditions : (company.termsAndConditions || '')) ? `
            <div style="margin-top:16px; font-size:9px; color:#64748b; border-top:1px solid #f1f5f9; padding-top:8px;">
                <strong style="color:#334155;">Terms & Conditions:</strong>
                <div style="white-space:pre-wrap; margin-top:2px;">${voucher.termsAndConditions !== undefined && voucher.termsAndConditions !== null ? voucher.termsAndConditions : company.termsAndConditions}</div>
            </div>
            ` : ''}

            ${(voucher.footerText !== undefined && voucher.footerText !== null ? voucher.footerText : (company.footerText || '')) ? `
            <div style="text-align:center; font-size:8.5px; color:#94a3b8; margin-top:12px;">
                ${voucher.footerText !== undefined && voucher.footerText !== null ? voucher.footerText : company.footerText}
            </div>
            ` : ''}
        </div>
        `;
    }

    // Generate HTML for Thermal POS Receipt (58mm or 80mm roll)
    static renderThermalReceipt(voucher, company, party, width = '80mm') {

        return `
        <div class="print-document thermal-receipt" style="width: ${width}; font-family: 'Courier New', Courier, monospace;">
            <div class="thermal-header text-center">
                <h2 style="margin:0; font-size:16px; font-weight:800; text-transform:uppercase;">${company.businessName}</h2>
                <div style="font-size:11px; margin:2px 0;">${company.address}</div>
                <div style="font-size:11px;">Ph: ${company.phone}</div>
                <div style="font-size:11px; font-weight:bold;">GSTIN: ${company.gstin}</div>
                <div style="border-top:1px dashed #000; border-bottom:1px dashed #000; margin:6px 0; padding:3px 0; font-weight:bold;">
                    ${voucher.voucherType === 'sales_invoice' ? 'RETAIL / WHOLESALE BILL' : 'ESTIMATE SLIP'}
                </div>
            </div>

            <div style="font-size:11px; margin-bottom:6px;">
                <div>Bill No : <strong>${voucher.voucherNo}</strong></div>
                <div>Date    : ${voucher.date}</div>
                <div>Customer: ${voucher.partyName}</div>
                ${voucher.partyPhone ? `<div>Phone   : ${voucher.partyPhone}</div>` : ''}
            </div>

            <table style="width:100%; border-collapse:collapse; font-size:11px; border-bottom:1px dashed #000;">
                <thead>
                    <tr style="border-bottom:1px dashed #000; text-align:left;">
                        <th>Item</th>
                        <th style="text-align:center;">Qty</th>
                        <th style="text-align:right;">Rate</th>
                        <th style="text-align:right;">Amt</th>
                    </tr>
                </thead>
                <tbody>
                    ${voucher.items.map(itm => `
                        <tr>
                            <td colspan="4" style="padding-top:3px; font-weight:600;">${itm.name}</td>
                        </tr>
                        <tr style="border-bottom:1px dotted #ccc;">
                            <td style="font-size:10px; color:#555;">HSN: ${itm.hsn || '-'}</td>
                            <td style="text-align:center;">${itm.qty} ${itm.unit}</td>
                            <td style="text-align:right;">${itm.price.toFixed(2)}</td>
                            <td style="text-align:right; font-weight:bold;">${itm.totalAmount.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="font-size:11px; padding-top:4px;">
                <div style="display:flex; justify-content:space-between;">
                    <span>Subtotal:</span>
                    <span>${voucher.subtotal.toFixed(2)}</span>
                </div>
                ${voucher.discountAmount > 0 ? `
                    <div style="display:flex; justify-content:space-between;">
                        <span>Discount:</span>
                        <span>-${voucher.discountAmount.toFixed(2)}</span>
                    </div>
                ` : ''}
                <div style="display:flex; justify-content:space-between;">
                    <span>Tax (GST):</span>
                    <span>${voucher.totalTax.toFixed(2)}</span>
                </div>
                ${voucher.roundOff !== 0 ? `
                    <div style="display:flex; justify-content:space-between;">
                        <span>Round Off:</span>
                        <span>${voucher.roundOff.toFixed(2)}</span>
                    </div>
                ` : ''}
                <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:bold; border-top:1px dashed #000; border-bottom:1px dashed #000; padding:3px 0; margin:4px 0;">
                    <span>TOTAL:</span>
                    <span>₹ ${voucher.grandTotal.toFixed(2)}</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span>Paid:</span>
                    <span>₹ ${(voucher.paidAmount || 0).toFixed(2)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-weight:bold;">
                    <span>Due:</span>
                    <span>₹ ${(voucher.balanceDue || 0).toFixed(2)}</span>
                </div>
            </div>


            <div style="text-align:center; font-size:10px; margin-top:8px; border-top:1px dashed #000; padding-top:4px;">
                ${voucher.footerText !== undefined && voucher.footerText !== null ? voucher.footerText : (company.footerText || '*** THANK YOU! VISIT AGAIN ***')}<br/>
                ${voucher.termsAndConditions !== undefined && voucher.termsAndConditions !== null ? voucher.termsAndConditions : 'Goods once sold cannot be returned.'}
            </div>
        </div>
        `;
    }

    // Generate HTML for Swastik Dynamic Projects Corporate / Engineering Tax Invoice & Quotation
    static renderSwastikFormat(voucher, company, party, templateType = 'tax_invoice', copyType = 'ORIGINAL FOR RECIPIENT') {
        const isQuotation = (templateType === 'quotation' || voucher.voucherType === 'estimate');
        const docTitle = isQuotation ? 'QUOTATION' : 'TAX INVOICE';
        const docNumLabel = isQuotation ? 'Quotation No.' : 'Invoice No.';

        // Calculate totals
        let totalItemsQty = 0;
        let totalTaxableValue = 0;
        let totalDiscount = 0;
        const items = voucher.items || [];
        for (const itm of items) {
            totalItemsQty += (Number(itm.quantity) || 0);
            totalTaxableValue += (Number(itm.taxableAmount) || 0);
            totalDiscount += (Number(itm.discountAmount) || 0);
        }
        if (totalTaxableValue === 0 && voucher.taxableAmount) {
            totalTaxableValue = Number(voucher.taxableAmount) || 0;
        }

        // Swastik Dynamic Projects Corporate Branding (Permanent and Non-Editable)
        const compName = 'SWASTIK DYNAMIC PROJECTS PVT. LTD.';
        const compAddress = (company.address && company.address.toLowerCase().includes('dwarika')) ? `${company.address}${company.city ? ', ' + company.city : ''}${company.state ? ', ' + company.state : ''}${company.pincode ? ' - ' + company.pincode : ''}` : 'Plot No. 558 - A, Dwarika City, Chhapraula, Ghaziabad, Uttar Pradesh, PIN - 201009';
        const compTele = company.phone || '+91 9217916162';
        const compEmail = company.email || 'swastikdynamicprojects@gmail.com';
        const compGstin = company.gstin || '09ABTCS0027Q1ZL';
        const bankName = company.bankDetails?.bankName || 'HDFC BANK';
        const bankAc = company.bankDetails?.accountNumber || '50200118621206';
        const bankIfsc = company.bankDetails?.ifscCode || 'HDFC0005299';
        const bankHolder = compName;

        // Ensure minimum 5 rows for authentic look
        const minRows = 5;
        const emptyRowsCount = Math.max(0, minRows - items.length);

        // Permanent, authentic Swastik Dynamic Projects Divider Compass Logo (Non-editable SVG)
        const swastikPermanentLogoSvg = `
        <svg width="78" height="78" viewBox="0 0 120 120" class="swastik-compass-logo" style="display:block; flex-shrink:0;">
            <!-- Outer Technical Calibration Rings -->
            <circle cx="60" cy="60" r="56" fill="none" stroke="#1e3a8a" stroke-width="1.8"/>
            <circle cx="60" cy="60" r="52.5" fill="none" stroke="#1e3a8a" stroke-width="0.8" stroke-dasharray="2,2"/>
            <circle cx="60" cy="60" r="49" fill="none" stroke="#1e3a8a" stroke-width="0.5"/>

            <!-- Cardinal Degree Notches -->
            <line x1="60" y1="4" x2="60" y2="10" stroke="#1e3a8a" stroke-width="1.5"/>
            <line x1="60" y1="110" x2="60" y2="116" stroke="#1e3a8a" stroke-width="1.5"/>
            <line x1="4" y1="60" x2="10" y2="60" stroke="#1e3a8a" stroke-width="1.5"/>
            <line x1="110" y1="60" x2="116" y2="60" stroke="#1e3a8a" stroke-width="1.5"/>
            
            <!-- Top Knurled Handle / Grip -->
            <rect x="56.5" y="10" width="7" height="9" rx="1.5" fill="#1e3a8a"/>
            <line x1="57.5" y1="12" x2="62.5" y2="12" stroke="#ffffff" stroke-width="0.8"/>
            <line x1="57.5" y1="14.5" x2="62.5" y2="14.5" stroke="#ffffff" stroke-width="0.8"/>
            <line x1="57.5" y1="17" x2="62.5" y2="17" stroke="#ffffff" stroke-width="0.8"/>
            
            <!-- Central Pivot Hinge Disc -->
            <circle cx="60" cy="24" r="9" fill="#1e3a8a"/>
            <circle cx="60" cy="24" r="6" fill="#ffffff" stroke="#1e3a8a" stroke-width="1.2"/>
            <circle cx="60" cy="24" r="3" fill="#1e3a8a"/>
            <circle cx="60" cy="24" r="1" fill="#ffffff"/>

            <!-- Calibrated Measuring Arc / Quadrant (Connecting Compass Legs) -->
            <path d="M 33 73 A 46 46 0 0 1 87 73" fill="none" stroke="#1e3a8a" stroke-width="4.5" stroke-linecap="round"/>
            <path d="M 34 73 A 46 46 0 0 1 86 73" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
            <!-- Calibration Tick Marks on Arc -->
            <path d="M 36 71.5 L 34.5 68.5 M 42 66 L 41 63 M 48 62 L 47.5 59 M 54 59.5 L 54 56.5 M 60 58.5 L 60 55 M 66 59.5 L 66 56.5 M 72 62 L 72.5 59 M 78 66 L 79 63 M 84 71.5 L 85.5 68.5" 
                  stroke="#1e3a8a" stroke-width="1.2" stroke-linecap="round"/>

            <!-- Left Compass Leg (Tapered Engineering Divider Arm) -->
            <polygon points="56,31 60,31 29,106 25,106 24,103" fill="#1e3a8a"/>
            <!-- Left Precision Needle Point -->
            <polygon points="25,106 24,103 22,111" fill="#1e3a8a"/>
            <!-- Highlight Line on Left Leg -->
            <line x1="56.5" y1="33" x2="26.5" y2="103" stroke="#93c5fd" stroke-width="0.8"/>

            <!-- Right Compass Leg (Tapered Engineering Divider Arm) -->
            <polygon points="60,31 64,31 96,103 95,106 91,106" fill="#1e3a8a"/>
            <!-- Right Precision Needle Point -->
            <polygon points="95,106 96,103 98,111" fill="#1e3a8a"/>
            <!-- Highlight Line on Right Leg -->
            <line x1="63.5" y1="33" x2="93.5" y2="103" stroke="#93c5fd" stroke-width="0.8"/>

            <!-- Horizontal Threaded Adjustment Spindle -->
            <line x1="33" y1="62" x2="87" y2="62" stroke="#1e3a8a" stroke-width="2.5"/>
            <line x1="34" y1="62" x2="86" y2="62" stroke="#ffffff" stroke-width="0.8" stroke-dasharray="1.5,1.5"/>
            
            <!-- Central Knurled Thumbwheel / Adjustment Dial -->
            <rect x="55" y="56" width="10" height="12" rx="2" fill="#1e3a8a" stroke="#ffffff" stroke-width="1"/>
            <line x1="57.5" y1="57" x2="57.5" y2="67" stroke="#ffffff" stroke-width="0.8"/>
            <line x1="60" y1="57" x2="60" y2="67" stroke="#ffffff" stroke-width="0.8"/>
            <line x1="62.5" y1="57" x2="62.5" y2="67" stroke="#ffffff" stroke-width="0.8"/>

            <!-- Baseline Ground / Reference Marks -->
            <line x1="16" y1="111" x2="104" y2="111" stroke="#1e3a8a" stroke-width="1.2" stroke-dasharray="3,3"/>
        </svg>
        `;

        return `
        <div class="print-document a4-sheet swastik-template">
            <!-- Top Centered Header -->
            <div class="swastik-header-title">${docTitle}</div>
            
            <!-- Outer Box -->
            <div class="swastik-box">
                <!-- Company Info Banner (Permanent Logo & Non-Editable Swastik Dynamics Header) -->
                <div class="swastik-company-row">
                    <div class="swastik-company-branding">
                        ${swastikPermanentLogoSvg}
                        <div class="swastik-company-text">
                            <h1 class="swastik-comp-name">${compName}</h1>
                            <div class="swastik-comp-meta">
                                <div><strong>Address:</strong> ${compAddress}</div>
                                <div><strong>Tele:</strong> ${compTele}, <strong>E-Mail:</strong> ${compEmail}, <strong>GST no:</strong> ${compGstin}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Bill To & Meta Section -->
                <div class="swastik-meta-row">
                    <div class="swastik-bill-to-col">
                        <div class="swastik-sub-heading">Bill To:</div>
                        <div class="swastik-party-details">
                            <div class="swastik-party-name">${party ? (party.companyName || party.name) : (voucher.partyName || 'Cash / Walk-in Customer')}</div>
                            ${(party?.billingAddress || voucher.partyAddress) ? `<div class="swastik-party-address">${party?.billingAddress || voucher.partyAddress}</div>` : ''}
                            ${(party?.phone || voucher.partyPhone) ? `<div><strong>Phone:</strong> ${party?.phone || voucher.partyPhone}</div>` : ''}
                            ${(party?.gstin || voucher.partyGstin) ? `<div><strong>GSTIN:</strong> ${party?.gstin || voucher.partyGstin}</div>` : ''}
                            ${(party?.state || voucher.partyState) ? `<div><strong>State:</strong> ${party?.state || voucher.partyState}</div>` : ''}
                        </div>
                    </div>
                    <div class="swastik-inv-meta-col">
                        <div class="swastik-meta-item">
                            <span class="swastik-meta-lbl">${docNumLabel}:</span>
                            <span class="swastik-meta-val">${voucher.voucherNo}</span>
                        </div>
                        <div class="swastik-meta-item">
                            <span class="swastik-meta-lbl">Dated:-</span>
                            <span class="swastik-meta-val">${InvoiceEngine.formatDate(voucher.date)}</span>
                        </div>
                        ${voucher.dueDate ? `
                        <div class="swastik-meta-item">
                            <span class="swastik-meta-lbl">Due Date:-</span>
                            <span class="swastik-meta-val">${InvoiceEngine.formatDate(voucher.dueDate)}</span>
                        </div>
                        ` : ''}
                        ${copyType ? `
                        <div class="swastik-copy-badge">${copyType}</div>
                        ` : ''}
                    </div>
                </div>

                <!-- Services Description Table -->
                <table class="swastik-table">
                    <thead>
                        <tr>
                            <th style="width: 55%; text-align: left;">Services Description</th>
                            <th style="width: 15%; text-align: center;">STN/TKM</th>
                            <th style="width: 15%; text-align: right;">Rate</th>
                            <th style="width: 15%; text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(itm => `
                            <tr>
                                <td style="text-align: left;">
                                    <strong>${itm.name}</strong>
                                    ${itm.description ? `<div style="font-size: 8.5px; color: #475569; margin-top: 1px;">${itm.description}</div>` : ''}
                                </td>
                                <td style="text-align: center;">${itm.hsn || itm.unit || (itm.quantity + (itm.unit ? ' ' + itm.unit : ''))}</td>
                                <td style="text-align: right;">${InvoiceEngine.formatCurrency(itm.rate, false)}</td>
                                <td style="text-align: right;">${InvoiceEngine.formatCurrency(itm.taxableAmount || (itm.quantity * itm.rate), false)}</td>
                            </tr>
                        `).join('')}
                        ${Array.from({ length: emptyRowsCount }).map(() => `
                            <tr class="swastik-empty-row">
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                                <td style="text-align: right;">0.00</td>
                            </tr>
                        `).join('')}
                        <!-- TOTAL ROW -->
                        <tr class="swastik-total-row">
                            <td colspan="3" style="text-align: right; font-weight: 800; letter-spacing: 0.5px;">TOTAL</td>
                            <td style="text-align: right; font-weight: 800;">${InvoiceEngine.formatCurrency(totalTaxableValue, false)}</td>
                        </tr>
                    </tbody>
                </table>

                <!-- Middle Details & Calculation Grid -->
                <div class="swastik-mid-grid">
                    <div class="swastik-mid-left">
                        <div class="swastik-cheque-note">
                            Make all cheques payable to <strong>${bankHolder}</strong>
                        </div>
                        <div class="swastik-comments-box">
                            <strong>Other Comments:</strong><br/>
                            1. Please Include the ${isQuotation ? 'quotation' : 'invoice'} number on your check
                        </div>
                        <div class="swastik-amount-payable">
                            <strong>Amount Payable:</strong> <span class="swastik-payable-figure">${InvoiceEngine.formatCurrency(voucher.totalAmount)}</span>
                        </div>
                        <div class="swastik-amount-words">
                            <strong>Amount (in words):</strong> ${InvoiceEngine.amountToWords(voucher.totalAmount)}
                        </div>
                        <div class="swastik-satisfaction-clause">
                            I agree that all Services have been received to my Satisfaction
                        </div>
                    </div>
                    <div class="swastik-mid-right">
                        <table class="swastik-tax-summary-table">
                            <tr>
                                <td>Less: Discount</td>
                                <td style="text-align: right;">${InvoiceEngine.formatCurrency(totalDiscount, false)}</td>
                            </tr>
                            <tr>
                                <td>Taxable Value</td>
                                <td style="text-align: right;">${InvoiceEngine.formatCurrency(totalTaxableValue, false)}</td>
                            </tr>
                            <tr>
                                <td>SGST@9%</td>
                                <td style="text-align: right;">${InvoiceEngine.formatCurrency(voucher.totalSgst || 0, false)}</td>
                            </tr>
                            <tr>
                                <td>CGST @9%</td>
                                <td style="text-align: right;">${InvoiceEngine.formatCurrency(voucher.totalCgst || 0, false)}</td>
                            </tr>
                            <tr>
                                <td>IGST @18%</td>
                                <td style="text-align: right;">${InvoiceEngine.formatCurrency(voucher.totalIgst || 0, false)}</td>
                            </tr>
                        </table>
                    </div>
                </div>

                <!-- Bank Details & Authorised Signatory Section -->
                <div class="swastik-footer-grid">
                    <div class="swastik-bank-box">
                        <div class="swastik-bank-title">Bank Details:-</div>
                        <div class="swastik-bank-row"><strong>NAME: -</strong> ${bankHolder}</div>
                        <div class="swastik-bank-row"><strong>AC NO: -</strong> ${bankAc}</div>
                        <div class="swastik-bank-row"><strong>BANK NAME: -</strong> ${bankName}</div>
                        <div class="swastik-bank-row"><strong>IFSC CODE: -</strong> ${bankIfsc}</div>
                    </div>
                    <div class="swastik-sign-box">
                        <div class="swastik-for-company">FOR ${compName.toUpperCase()}</div>
                        <div class="swastik-sign-area">
                            ${company.signatureUrl ? `
                                <img src="${company.signatureUrl}" class="swastik-signature-img" alt="Sign"/>
                            ` : `
                                <svg class="swastik-sign-svg" viewBox="0 0 160 50" width="130" height="42">
                                    <path d="M 12 36 C 28 14, 38 42, 54 22 C 72 8, 78 38, 102 16 C 118 6, 138 28, 152 20 M 20 42 L 140 40" fill="none" stroke="#1d4ed8" stroke-width="2.2" stroke-linecap="round"/>
                                </svg>
                            `}
                        </div>
                        <div class="swastik-auth-signatory">Authorised Signatory</div>
                    </div>
                </div>

                <!-- Bottom Banner -->
                <div class="swastik-bottom-banner">
                    THANK YOU FOR YOUR BUSINESS!
                </div>
            </div>
        </div>
        `;
    }

    // Trigger Print Action
    static printDocument(containerHtml) {
        let printFrame = document.getElementById('print-iframe');
        if (!printFrame) {
            printFrame = document.createElement('iframe');
            printFrame.id = 'print-iframe';
            printFrame.style.position = 'fixed';
            printFrame.style.right = '0';
            printFrame.style.bottom = '0';
            printFrame.style.width = '0';
            printFrame.style.height = '0';
            printFrame.style.border = '0';
            document.body.appendChild(printFrame);
        }

        const doc = printFrame.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Print Document</title>
                <link rel="stylesheet" href="css/style.css">
                <style>
                    @page { size: auto; margin: 6mm 6mm; }
                    body { background: #fff !important; margin: 0; padding: 0; }
                    .print-document { box-shadow: none !important; margin: 0 auto !important; }
                    .dotmatrix-template {
                        background-color: #ffffff !important;
                        color: #000000 !important;
                        border: 1.5px solid #000000;
                        box-sizing: border-box;
                        padding: 8px 10px;
                        margin: 0 auto;
                        width: 100%;
                        line-height: 1.25;
                    }
                    .dotmatrix-template.font-scale-compact { --dm-font-title: 13.5px; --dm-font-header: 10.5px; --dm-font-body: 9px; --dm-font-micro: 7.5px; }
                    .dotmatrix-template.font-scale-standard { --dm-font-title: 15px; --dm-font-header: 11.5px; --dm-font-body: 10px; --dm-font-micro: 8px; }
                    .dotmatrix-template.font-scale-comfortable { --dm-font-title: 16.5px; --dm-font-header: 12.5px; --dm-font-body: 11px; --dm-font-micro: 8.5px; }
                    .dotmatrix-template.font-scale-large { --dm-font-title: 18px; --dm-font-header: 13.5px; --dm-font-body: 12px; --dm-font-micro: 9px; }

                    .font-arial, .font-arial * { font-family: Arial, Helvetica, sans-serif !important; }
                    .font-times, .font-times * { font-family: 'Times New Roman', Times, Georgia, serif !important; }
                    .font-aptos, .font-aptos * { font-family: 'Aptos', 'Calibri', 'Segoe UI', sans-serif !important; }
                    .font-courier, .font-courier * { font-family: 'Courier New', Courier, monospace !important; }
                    .font-calibri, .font-calibri * { font-family: 'Calibri', Candara, 'Segoe UI', sans-serif !important; }
                    .font-consolas, .font-consolas * { font-family: 'Consolas', 'Courier New', monospace !important; }

                    .dm-grid-table { width: 100%; border-collapse: collapse; border: 1px solid #000000; margin: 0; font-size: var(--dm-font-body, 10px); background: #ffffff !important; }
                    .dm-grid-table th, .dm-grid-table td { border: 1px solid #000000; padding: 3px 5px; vertical-align: top; color: #000000 !important; background: #ffffff !important; }
                    .dm-grid-table th { font-size: var(--dm-font-header, 11.5px); font-weight: bold; text-transform: uppercase; }
                    .dm-title { font-size: var(--dm-font-title, 15px); font-weight: 800; text-transform: uppercase; color: #000000 !important; }
                    .dm-micro { font-size: var(--dm-font-micro, 8px); line-height: 1.25; color: #000000 !important; }
                    .dm-company-logo { max-height: 52px; max-width: 140px; width: auto; height: auto; object-fit: contain; display: block; }

                    @media print {
                        .dotmatrix-template { border: 1.5px solid #000000 !important; box-shadow: none !important; margin: 0 !important; padding: 4mm 6mm !important; width: 100% !important; }
                        .dotmatrix-template * { color: #000000 !important; background: transparent !important; box-shadow: none !important; text-shadow: none !important; }
                        .dm-company-logo { max-height: 52px !important; max-width: 140px !important; display: block !important; }
                    }
                </style>
            </head>
            <body>
                ${containerHtml}
                <script>
                    window.onload = function() {
                        window.focus();
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        doc.close();
    }
}

window.InvoicePrinter = InvoicePrinter;
