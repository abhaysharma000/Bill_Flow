/**
 * BillFlow Native Mobile App Controller
 * Orchestrates 5 Bottom Nav Screens, Top Bars, FAB Actions, and Real-time Invoicing
 * 100% OFFLINE - IndexedDB Powered Local Persistence
 */

class BillFlowMobileApp {
    constructor() {
        this.currentScreen = 'screen-home';
        this.currentBillTab = 'sales';
        this.currentBillFilter = 'all';
        this.currentPartyTab = 'customers';
        this.currentDateFilter = 'year';
        this.productSortMode = 'default';
        this.productFilterMode = 'all';
        this.partySortMode = 'default';
        this.partyFilterMode = 'all';
        this.activeVoucherForPrint = null;
        this.activePrintTemplate = 'dot_matrix_international';
        this.activePrintFont = 'font-arial';
        this.activePrintScale = 'font-scale-standard';
        this.previewFitMode = false;
        this.company = null;
        this.pendingCompanyLogo = null;
        this.items = [];
        this.parties = [];
        this.godowns = [];
        this.vouchers = [];
        // Invoice export filter states
        this.invoiceExportDays = 30;
        this.invoiceExportType = 'sales_invoice';
        this.invoiceExportStatus = 'all';
        this.invoiceExportFromDate = '';
        this.invoiceExportToDate = '';
        // Offline feature state
        this.activeLedgerParty = null;
        this.scannerFacingMode = 'environment';
        this.scannerMediaStream = null;
        this._scannerActive = false;
        this.stockFilterMode = 'all';
        this.activeInvoiceCopy = 'ORIGINAL FOR RECIPIENT';
        this.pendingRestoreData = null;
        this.billsSelectMode = false;
        this.selectedVoucherIds = new Set();
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast-message toast-${type}`;
        const icon = type === 'success' ? '✓' : (type === 'error' ? '⚠️' : 'ℹ️');
        toast.innerHTML = `<span style="font-size:16px;">${icon}</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 3000);
    }

    async init() {
        console.log('Starting BillFlow Mobile Application...');
        window.app = this;

        // Apply saved theme immediately for seamless zero-flash loading
        const savedTheme = localStorage.getItem('billflow_theme') || 'dark';
        this.applyTheme(savedTheme);

        await window.dbService.init();

        // Enforce 100% clean zero state on initial launch
        if (localStorage.getItem('billflow_clean_zero_v3') !== 'true') {
            await window.dbService.resetAllDataToZero();
            localStorage.setItem('billflow_clean_zero_v3', 'true');
        }

        await this.loadAllState();
        this.bindEvents();
        this.initSignaturePad();
        this.switchScreen('screen-home');
        console.log('BillFlow Mobile Application ready & 100% offline.');
    }

    detectStateAndCode(gstin = '', address = '', explicitState = '', explicitCity = '') {
        const GST_STATE_MAP = {
            '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
            '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
            '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
            '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
            '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
            '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
            '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '28': 'Andhra Pradesh',
            '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
            '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
            '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh'
        };

        const STATE_PATTERNS = [
            { name: 'Uttar Pradesh', code: '09', regex: /\b(uttar\s*pradesh|uttar\s*pardesh|u\.?p\.?|noida|lucknow|kanpur|varanasi|agra|ghaziabad|meerut|prayagraj|allahabad|bareilly|aligarh)\b/i },
            { name: 'Maharashtra', code: '27', regex: /\b(maharashtra|mumbai|pune|nagpur|nashik|thane|aurangabad|solapur|kolhapur)\b/i },
            { name: 'Delhi', code: '07', regex: /\b(delhi|new\s*delhi)\b/i },
            { name: 'Gujarat', code: '24', regex: /\b(gujarat|ahmedabad|surat|vadodara|rajkot|gandhinagar|bhavnagar)\b/i },
            { name: 'Rajasthan', code: '08', regex: /\b(rajasthan|jaipur|jodhpur|udaipur|kota|bikaner|ajmer)\b/i },
            { name: 'Haryana', code: '06', regex: /\b(haryana|gurgaon|gurugram|faridabad|panipat|ambala|karnal)\b/i },
            { name: 'Punjab', code: '03', regex: /\b(punjab|ludhiana|amritsar|jalandhar|patiala|bathinda)\b/i },
            { name: 'Madhya Pradesh', code: '23', regex: /\b(madhya\s*pradesh|m\.?p\.?|bhopal|indore|gwalior|jabalpur|ujjain)\b/i },
            { name: 'Bihar', code: '10', regex: /\b(bihar|patna|gaya|bhagalpur|muzaffarpur)\b/i },
            { name: 'West Bengal', code: '19', regex: /\b(west\s*bengal|kolkata|howrah|durgapur|asansol|siliguri)\b/i },
            { name: 'Karnataka', code: '29', regex: /\b(karnataka|bangalore|bengaluru|mysore|mysuru|hubli|mangalore)\b/i },
            { name: 'Tamil Nadu', code: '33', regex: /\b(tamil\s*nadu|chennai|coimbatore|madurai|trichy|salem)\b/i },
            { name: 'Telangana', code: '36', regex: /\b(telangana|hyderabad|warangal|nizamabad)\b/i },
            { name: 'Andhra Pradesh', code: '37', regex: /\b(andhra\s*pradesh|visakhapatnam|vijayawada|guntur|tirupati)\b/i },
            { name: 'Kerala', code: '32', regex: /\b(kerala|kochi|thiruvananthapuram|kozhikode|thrissur)\b/i },
            { name: 'Uttarakhand', code: '05', regex: /\b(uttarakhand|dehradun|haridwar|rishikesh|roorkee)\b/i },
            { name: 'Jharkhand', code: '20', regex: /\b(jharkhand|ranchi|jamshedpur|dhanbad|bokaro)\b/i },
            { name: 'Chhattisgarh', code: '22', regex: /\b(chhattisgarh|raipur|bilaspur|bhilai|durg)\b/i },
            { name: 'Odisha', code: '21', regex: /\b(odisha|bhubaneswar|cuttack|rourkela)\b/i },
            { name: 'Goa', code: '30', regex: /\b(goa|panaji|margao|vasco)\b/i },
            { name: 'Himachal Pradesh', code: '02', regex: /\b(himachal\s*pradesh|shimla|dharamshala|mandi|solan)\b/i },
            { name: 'Jammu & Kashmir', code: '01', regex: /\b(jammu|kashmir|srinagar)\b/i },
            { name: 'Chandigarh', code: '04', regex: /\b(chandigarh)\b/i },
            { name: 'Assam', code: '18', regex: /\b(assam|guwahati|silchar|dibrugarh)\b/i }
        ];

        if (explicitState) {
            const cleanState = explicitState.trim();
            for (const p of STATE_PATTERNS) {
                if (p.regex.test(cleanState) || p.name.toLowerCase() === cleanState.toLowerCase()) {
                    return { state: p.name, code: p.code };
                }
            }
            return { state: cleanState, code: '' };
        }

        const cleanGst = (gstin || '').trim().toUpperCase();
        if (cleanGst.length >= 2 && /^\d{2}/.test(cleanGst)) {
            const code = cleanGst.substring(0, 2);
            if (GST_STATE_MAP[code]) {
                return { state: GST_STATE_MAP[code], code };
            }
        }

        const cleanAddr = (address || '').trim();
        if (cleanAddr) {
            for (const p of STATE_PATTERNS) {
                if (p.regex.test(cleanAddr)) {
                    return { state: p.name, code: p.code };
                }
            }
        }

        return { state: '', code: '' };
    }

    async loadAllState() {
        const companies = await window.dbService.getAll('companies');
        this.company = companies[0] || { id: 'comp_primary', businessName: 'My Enterprise', state: '', invoicePrefix: 'INV-26/' };
        this.items = await window.dbService.getAll('items');
        this.parties = await window.dbService.getAll('parties');
        this.godowns = await window.dbService.getAll('godowns');
        this.vouchers = await window.dbService.getAll('vouchers');

        // Self-heal historical parties that got falsely defaulted to 'Maharashtra' or guessed states
        let partiesUpdated = false;
        for (const p of this.parties) {
            const rawEntered = `${p.billingAddress || ''} ${p.deliveryAddress || ''} ${p.city || ''} ${p.address || ''}`.toLowerCase();
            const currentState = (p.state || '').trim();
            // If party state is set, but user never entered that state in their address or location:
            if (currentState) {
                const stateLower = currentState.toLowerCase();
                if (!rawEntered.includes(stateLower)) {
                    p.state = '';
                    p.stateCode = '';
                    await window.dbService.put('parties', p);
                    partiesUpdated = true;
                }
            }
        }
        if (partiesUpdated) {
            this.parties = await window.dbService.getAll('parties');
        }

        const themeSetting = await window.dbService.get('settings', 'theme');
        if (themeSetting && themeSetting.value) {
            this.applyTheme(themeSetting.value);
        }
    }

    // ==========================================
    // SCREEN SWITCHER & APP BAR MANAGEMENT
    // ==========================================
    switchScreen(screenId, desiredSubTab = null) {
        // Backward compatibility redirects for direct calls to old screen IDs
        if (screenId === 'screen-products') {
            return this.switchScreen('screen-items-parties', 'products');
        }
        if (screenId === 'screen-parties') {
            return this.switchScreen('screen-items-parties', 'parties');
        }

        document.querySelectorAll('.tab-screen').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-tab-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.top-bar-content').forEach(tb => tb.style.display = 'none');

        const screen = document.getElementById(screenId);
        if (screen) screen.classList.add('active');

        // Manage Bottom Bar Active state
        const tabBtn = document.querySelector(`.nav-tab-item[data-screen="${screenId}"]`);
        if (tabBtn) tabBtn.classList.add('active');

        // Manage Top Bar contextual display
        const fabCircle = document.getElementById('global-fab-btn');
        const fabPill = document.getElementById('parties-fab-btn');

        if (screenId === 'screen-home') {
            document.getElementById('top-bar-home').style.display = 'flex';
            if (fabCircle) fabCircle.style.display = 'flex';
            if (fabPill) fabPill.style.display = 'none';
            this.renderHomeScreen();
        } else if (screenId === 'screen-bills') {
            document.getElementById('top-bar-bills').style.display = 'flex';
            if (fabCircle) fabCircle.style.display = 'flex';
            if (fabPill) fabPill.style.display = 'none';
            this.renderBillsScreen();
        } else if (screenId === 'screen-items-parties') {
            document.getElementById('top-bar-items-parties').style.display = 'flex';
            const targetSubTab = desiredSubTab || this.currentItemsPartiesSubTab || 'products';
            this.switchItemsPartiesSubTab(targetSubTab);
        } else if (screenId === 'screen-more') {
            document.getElementById('top-bar-more').style.display = 'flex';
            if (fabCircle) fabCircle.style.display = 'none';
            if (fabPill) fabPill.style.display = 'none';
        }

        this.currentScreen = screenId;
    }

    switchItemsPartiesSubTab(subTab) {
        this.currentItemsPartiesSubTab = subTab;
        const btnProd = document.getElementById('btn-subtab-products');
        const btnParties = document.getElementById('btn-subtab-parties');
        const viewProd = document.getElementById('subview-products');
        const viewParties = document.getElementById('subview-parties');
        const topProd = document.getElementById('top-bar-sub-products');
        const topParties = document.getElementById('top-bar-sub-parties');
        const fabCircle = document.getElementById('global-fab-btn');
        const fabPill = document.getElementById('parties-fab-btn');

        if (subTab === 'products') {
            if (btnProd) btnProd.classList.add('active');
            if (btnParties) btnParties.classList.remove('active');
            if (viewProd) viewProd.style.display = 'block';
            if (viewParties) viewParties.style.display = 'none';
            if (topProd) topProd.style.display = 'flex';
            if (topParties) topParties.style.display = 'none';
            if (fabCircle) fabCircle.style.display = 'flex';
            if (fabPill) fabPill.style.display = 'none';
            this.renderProductsScreen();
        } else {
            if (btnParties) btnParties.classList.add('active');
            if (btnProd) btnProd.classList.remove('active');
            if (viewProd) viewProd.style.display = 'none';
            if (viewParties) viewParties.style.display = 'block';
            if (topProd) topProd.style.display = 'none';
            if (topParties) topParties.style.display = 'flex';
            if (fabCircle) fabCircle.style.display = 'none';
            if (fabPill) fabPill.style.display = 'flex';
            this.renderPartiesScreen();
        }
    }

    // ==========================================
    // 1. HOME SCREEN
    // ==========================================
    renderHomeScreen() {
        let totalSales = 0;
        let totalPurchases = 0;

        for (const v of this.vouchers) {
            if (v.voucherType === 'sales_invoice') {
                totalSales += (v.grandTotal || 0);
            } else if (v.voucherType === 'purchase_invoice') {
                totalPurchases += (v.grandTotal || 0);
            }
        }

        const salesEl = document.getElementById('home-sales-val');
        const purEl = document.getElementById('home-purchases-val');
        if (salesEl) salesEl.textContent = InvoiceEngine.formatCurrency(totalSales);
        if (purEl) purEl.textContent = InvoiceEngine.formatCurrency(totalPurchases);
    }

    // ==========================================
    // 2. BILLS SCREEN & INVOICE MANAGEMENT
    // ==========================================
    getFilteredVouchers(searchQuery = '') {
        let filtered = [...this.vouchers];

        // Top tab filter (Sales vs Purchases vs Quotations vs More)
        if (this.currentBillTab === 'sales') {
            filtered = filtered.filter(v => v.voucherType === 'sales_invoice');
        } else if (this.currentBillTab === 'purchases') {
            filtered = filtered.filter(v => v.voucherType === 'purchase_invoice');
        } else if (this.currentBillTab === 'quotations') {
            filtered = filtered.filter(v => v.voucherType === 'estimate');
        } else if (this.currentBillTab === 'more_bills') {
            filtered = filtered.filter(v => v.voucherType !== 'sales_invoice' && v.voucherType !== 'purchase_invoice' && v.voucherType !== 'estimate');
        }

        // Pill filter (All, Paid, Pending, Cancelled, Drafts)
        if (this.currentBillFilter === 'paid') {
            filtered = filtered.filter(v => v.paymentStatus === 'paid');
        } else if (this.currentBillFilter === 'pending') {
            filtered = filtered.filter(v => (v.balanceDue || 0) > 0);
        }

        // Text search
        const q = (searchQuery || document.getElementById('bills-search-input')?.value || '').toLowerCase().trim();
        if (q) {
            filtered = filtered.filter(v => 
                (v.voucherNo && v.voucherNo.toLowerCase().includes(q)) ||
                (v.partyName && v.partyName.toLowerCase().includes(q))
            );
        }

        filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        return filtered;
    }

    renderBillsScreen(searchQuery = '') {
        let totalAmount = 0;
        let pendingAmount = 0;

        for (const v of this.vouchers) {
            if (v.voucherType === 'sales_invoice') {
                totalAmount += (v.grandTotal || 0);
                pendingAmount += (v.balanceDue || 0);
            }
        }

        const totEl = document.getElementById('bills-total-amt');
        const pendEl = document.getElementById('bills-pending-amt');
        if (totEl) totEl.textContent = InvoiceEngine.formatCurrency(totalAmount);
        if (pendEl) pendEl.textContent = InvoiceEngine.formatCurrency(pendingAmount);

        const container = document.getElementById('bills-cards-container');
        if (!container) return;

        const filtered = this.getFilteredVouchers(searchQuery);
        const q = (searchQuery || document.getElementById('bills-search-input')?.value || '').toLowerCase().trim();

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:var(--text-sub);">
                    <div style="font-size:36px; margin-bottom:10px;">📄</div>
                    <p style="font-size:14px; margin-bottom:14px; color:#cbd5e1;">${q ? 'No invoices match your search.' : 'There are no invoices yet.'}</p>
                    <button class="btn btn-primary btn-sm" id="btn-empty-create-bill" style="padding:8px 16px; font-weight:700;">+ Create Invoice</button>
                </div>
            `;
            document.getElementById('btn-empty-create-bill')?.addEventListener('click', () => this.openVoucherModal('sales_invoice'));
            this.updateBillsSelectionBar();
            return;
        }

        container.innerHTML = filtered.map(v => {
            const isDue = (v.balanceDue || 0) > 0;
            const status = v.paymentStatus || (isDue ? 'unpaid' : 'paid');
            const badgeClass = status === 'paid' ? 'badge-paid' : (status === 'partial' ? 'badge-partial' : 'badge-unpaid');
            const isSelected = this.selectedVoucherIds && this.selectedVoucherIds.has(v.id);

            return `
                <div class="bill-card-item ${isSelected ? 'selected' : ''}" 
                     onclick="${this.billsSelectMode ? `window.app.toggleVoucherSelection('${v.id}')` : `window.app.openPrintModal('${v.id}')`}"
                     style="${isSelected ? 'border-color:#3b82f6; background:rgba(59,130,246,0.09); box-shadow:0 0 0 1px #3b82f6;' : ''}">
                    <div style="display:flex; align-items:flex-start; gap:12px;">
                        ${this.billsSelectMode ? `
                            <div style="padding-top:2px;" onclick="event.stopPropagation(); window.app.toggleVoucherSelection('${v.id}')">
                                <input type="checkbox" ${isSelected ? 'checked' : ''} style="width:20px; height:20px; accent-color:#3b82f6; cursor:pointer;" />
                            </div>
                        ` : ''}
                        <div style="flex:1; min-width:0;">
                            <div class="bill-card-top">
                                <span class="bill-party-name">${v.partyName || 'Customer'}</span>
                                <span class="bill-grand-amt">${InvoiceEngine.formatCurrency(v.grandTotal)}</span>
                            </div>
                            <div class="bill-card-mid">
                                <span>#${v.voucherNo} • ${InvoiceEngine.formatDate(v.date)}</span>
                                <span class="${isDue ? 'text-pending' : 'text-paid'}">${isDue ? `Due: ${InvoiceEngine.formatCurrency(v.balanceDue)}` : 'Fully Paid'}</span>
                            </div>
                            <div class="bill-card-bot" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                                <div style="display:flex; align-items:center; gap:6px;" onclick="event.stopPropagation()">
                                    <select class="bill-status-pill-select ${badgeClass}" 
                                            onchange="window.app.handleBillStatusSelect('${v.id}', this.value)" 
                                            title="Quick change payment status"
                                            style="padding:3px 6px; font-size:10px; font-weight:800; cursor:pointer;">
                                        <option value="paid" ${status === 'paid' ? 'selected' : ''}>🟢 PAID</option>
                                        <option value="partial" ${status === 'partial' ? 'selected' : ''}>🟡 PARTIAL</option>
                                        <option value="unpaid" ${status === 'unpaid' ? 'selected' : ''}>🔴 DUE</option>
                                    </select>
                                    <span style="font-size:11px; color:#94a3b8;">${(v.voucherType || 'sales_invoice').replace('_', ' ').toUpperCase()}</span>
                                </div>
                                <div style="display:flex; align-items:center; gap:6px;">
                                    ${(v.voucherType === 'estimate' || v.voucherType === 'delivery_challan') ? `
                                        <button type="button" class="btn-bill-convert" onclick="event.stopPropagation(); window.app.convertVoucher('${v.id}', 'sales_invoice')" title="Convert to Tax Invoice">
                                            <span>⚡</span><span>To Invoice</span>
                                        </button>
                                    ` : (v.voucherType === 'sales_invoice' ? `
                                        <button type="button" class="btn-bill-convert" onclick="event.stopPropagation(); window.app.convertVoucher('${v.id}', 'delivery_challan')" title="Convert to Delivery Challan">
                                            <span>⚡</span><span>To Challan</span>
                                        </button>
                                    ` : '')}
                                    <button type="button" class="btn-paystatus-chip" onclick="event.stopPropagation(); window.app.openPaymentStatusModal('${v.id}')" style="background:rgba(16,185,129,0.12); color:#34d399; border:1px solid rgba(16,185,129,0.25); border-radius:6px; padding:3px 8px; font-size:11px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:3px;" title="Update payment details / amount">
                                        <span>💳</span><span>Status</span>
                                    </button>
                                    <button type="button" class="btn-modify-bill-chip" onclick="event.stopPropagation(); window.app.editVoucher('${v.id}')" style="background:rgba(59,130,246,0.12); color:#60a5fa; border:1px solid rgba(59,130,246,0.25); border-radius:6px; padding:3px 9px; font-size:11px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:4px;" title="Modify invoice details">
                                        <span>✏️</span><span>Modify</span>
                                    </button>
                                    <button type="button" class="btn-delete-bill-chip" onclick="event.stopPropagation(); window.app.deleteVoucherPrompt('${v.id}')" style="background:rgba(239,68,68,0.12); color:#f87171; border:1px solid rgba(239,68,68,0.25); border-radius:6px; padding:3px 8px; font-size:11px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:3px;" title="Delete this invoice">
                                        <span>🗑️</span><span>Delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.updateBillsSelectionBar();
    }

    toggleBillsSelectMode() {
        this.billsSelectMode = !this.billsSelectMode;
        if (!this.selectedVoucherIds) this.selectedVoucherIds = new Set();
        if (!this.billsSelectMode) {
            this.selectedVoucherIds.clear();
        }
        const btn = document.getElementById('btn-bills-select-mode');
        const text = document.getElementById('btn-bills-select-mode-text');
        if (btn) {
            if (this.billsSelectMode) {
                btn.style.background = '#3b82f6';
                btn.style.color = '#ffffff';
                if (text) text.textContent = 'Cancel';
            } else {
                btn.style.background = 'rgba(59,130,246,0.12)';
                btn.style.color = '#60a5fa';
                if (text) text.textContent = 'Select';
            }
        }
        this.updateBillsSelectionBar();
        this.renderBillsScreen();
    }

    toggleVoucherSelection(vid) {
        if (!this.selectedVoucherIds) this.selectedVoucherIds = new Set();
        if (this.selectedVoucherIds.has(vid)) {
            this.selectedVoucherIds.delete(vid);
        } else {
            this.selectedVoucherIds.add(vid);
        }
        this.updateBillsSelectionBar();
        this.renderBillsScreen();
    }

    selectAllVouchers() {
        if (!this.selectedVoucherIds) this.selectedVoucherIds = new Set();
        const filtered = this.getFilteredVouchers();
        if (this.selectedVoucherIds.size === filtered.length && filtered.length > 0) {
            this.selectedVoucherIds.clear();
        } else {
            filtered.forEach(v => this.selectedVoucherIds.add(v.id));
        }
        this.updateBillsSelectionBar();
        this.renderBillsScreen();
    }

    updateBillsSelectionBar() {
        const bar = document.getElementById('bills-batch-action-bar');
        const countEl = document.getElementById('bills-selected-count');
        const selectAllBtn = document.getElementById('btn-bills-select-all');
        if (!bar) return;

        if (this.billsSelectMode) {
            bar.style.display = 'flex';
            const count = this.selectedVoucherIds ? this.selectedVoucherIds.size : 0;
            if (countEl) countEl.textContent = `${count} selected`;
            const filtered = this.getFilteredVouchers();
            if (selectAllBtn) {
                selectAllBtn.textContent = (count === filtered.length && filtered.length > 0) ? 'Deselect All' : 'Select All';
            }
        } else {
            bar.style.display = 'none';
        }
    }

    async deleteVoucherPrompt(voucherId) {
        const v = this.vouchers.find(x => x.id === voucherId);
        if (!v) {
            this.showToast('Invoice not found.', 'error');
            return;
        }

        const party = this.parties.find(p => p.id === v.partyId);
        const partyName = v.partyName || party?.name || 'Customer';
        const docName = (v.voucherType || 'sales_invoice').replace('_', ' ').toUpperCase();

        const conf = confirm(
            `🗑️ DELETE ${docName} #${v.voucherNo}?\n\n` +
            `Party: ${partyName}\n` +
            `Amount: ${InvoiceEngine.formatCurrency(v.grandTotal)}\n\n` +
            `• Inventory item stocks will be restored.\n` +
            `• Customer / party ledger balance will be updated.\n\n` +
            `Are you sure you want to permanently delete this bill?`
        );
        if (!conf) return;

        await this.executeDeleteVoucher(v);
    }

    async executeDeleteVoucher(v) {
        // 1. Revert inventory stock
        if (v.voucherType === 'sales_invoice' || v.voucherType === 'delivery_challan') {
            for (const line of (v.items || [])) {
                if (line.itemId) {
                    const itm = this.items.find(i => i.id === line.itemId);
                    if (itm) {
                        itm.currentStock = (itm.currentStock || 0) + Number(line.qty || 0);
                        await window.dbService.put('items', itm);
                    }
                }
            }
        } else if (v.voucherType === 'purchase_invoice') {
            for (const line of (v.items || [])) {
                if (line.itemId) {
                    const itm = this.items.find(i => i.id === line.itemId);
                    if (itm) {
                        itm.currentStock = Math.max(0, (itm.currentStock || 0) - Number(line.qty || 0));
                        await window.dbService.put('items', itm);
                    }
                }
            }
        }

        // 2. Revert party ledger balance
        const party = this.parties.find(p => p.id === v.partyId);
        if (party && party.id !== 'cash_sale') {
            if (v.voucherType === 'sales_invoice') {
                party.currentBalance = (party.currentBalance || 0) - Number(v.balanceDue || 0);
                await window.dbService.put('parties', party);
            } else if (v.voucherType === 'purchase_invoice') {
                party.currentBalance = (party.currentBalance || 0) + Number(v.balanceDue || 0);
                await window.dbService.put('parties', party);
            }
        }

        // 3. Remove from IndexedDB
        await window.dbService.delete('vouchers', v.id);

        // 4. Remove from selected set if present
        if (this.selectedVoucherIds) {
            this.selectedVoucherIds.delete(v.id);
        }

        // 5. Close any active modals
        document.getElementById('print-modal')?.classList.remove('active');
        document.getElementById('voucher-modal')?.classList.remove('active');
        this.activeVoucherForPrint = null;

        // 6. Reload and re-render
        await this.loadAllState();
        this.renderHomeScreen();
        this.renderBillsScreen();
        this.renderProductsScreen();
        this.renderPartiesScreen();
        this.updateBillsSelectionBar();

        this.showToast(`✓ Invoice #${v.voucherNo} deleted successfully.`, 'info');
    }

    async deleteSelectedVouchers() {
        if (!this.selectedVoucherIds || this.selectedVoucherIds.size === 0) {
            this.showToast('Please select at least one invoice to delete.', 'warning');
            return;
        }

        const count = this.selectedVoucherIds.size;
        const conf = confirm(
            `🗑️ DELETE ${count} SELECTED INVOICE(S)?\n\n` +
            `This will permanently remove the selected invoices from history and restore item stocks & party ledger balances.\n\n` +
            `Proceed with deleting ${count} bills?`
        );
        if (!conf) return;

        const idsToDelete = Array.from(this.selectedVoucherIds);
        for (const vid of idsToDelete) {
            const v = this.vouchers.find(x => x.id === vid);
            if (!v) continue;

            // Revert stock
            if (v.voucherType === 'sales_invoice' || v.voucherType === 'delivery_challan') {
                for (const line of (v.items || [])) {
                    if (line.itemId) {
                        const itm = this.items.find(i => i.id === line.itemId);
                        if (itm) {
                            itm.currentStock = (itm.currentStock || 0) + Number(line.qty || 0);
                            await window.dbService.put('items', itm);
                        }
                    }
                }
            } else if (v.voucherType === 'purchase_invoice') {
                for (const line of (v.items || [])) {
                    if (line.itemId) {
                        const itm = this.items.find(i => i.id === line.itemId);
                        if (itm) {
                            itm.currentStock = Math.max(0, (itm.currentStock || 0) - Number(line.qty || 0));
                            await window.dbService.put('items', itm);
                        }
                    }
                }
            }

            // Revert party balance
            const party = this.parties.find(p => p.id === v.partyId);
            if (party && party.id !== 'cash_sale') {
                if (v.voucherType === 'sales_invoice') {
                    party.currentBalance = (party.currentBalance || 0) - Number(v.balanceDue || 0);
                    await window.dbService.put('parties', party);
                } else if (v.voucherType === 'purchase_invoice') {
                    party.currentBalance = (party.currentBalance || 0) + Number(v.balanceDue || 0);
                    await window.dbService.put('parties', party);
                }
            }

            await window.dbService.delete('vouchers', vid);
        }

        this.selectedVoucherIds.clear();
        this.billsSelectMode = false;
        const btn = document.getElementById('btn-bills-select-mode');
        const text = document.getElementById('btn-bills-select-mode-text');
        if (btn) {
            btn.style.background = 'rgba(59,130,246,0.12)';
            btn.style.color = '#60a5fa';
            if (text) text.textContent = 'Select';
        }

        await this.loadAllState();
        this.renderHomeScreen();
        this.renderBillsScreen();
        this.renderProductsScreen();
        this.renderPartiesScreen();
        this.updateBillsSelectionBar();

        this.showToast(`✓ ${count} invoice(s) deleted successfully.`, 'info');
    }

    // ==========================================
    // 3. PRODUCTS SCREEN
    // ==========================================
    renderProductsScreen(searchQuery = '') {
        const container = document.getElementById('products-cards-container');
        if (!container) return;

        let filtered = [...this.items];
        const q = (searchQuery || document.getElementById('products-search-input')?.value || '').toLowerCase().trim();
        if (q) {
            filtered = filtered.filter(itm => 
                (itm.name && itm.name.toLowerCase().includes(q)) ||
                (itm.sku && itm.sku.toLowerCase().includes(q)) ||
                (itm.hsn && itm.hsn.toLowerCase().includes(q)) ||
                (itm.category && itm.category.toLowerCase().includes(q))
            );
        }

        // Low stock count badge update
        const lowStockItems = this.items.filter(itm => (itm.currentStock || 0) <= (itm.minStock !== undefined ? itm.minStock : (itm.minStockAlert || 5)));
        const lowBadgeEl = document.getElementById('low-stock-count-badge');
        if (lowBadgeEl) lowBadgeEl.textContent = lowStockItems.length;

        // Filter mode
        if (this.stockFilterMode === 'low_stock' || this.productFilterMode === 'low_stock') {
            filtered = filtered.filter(itm => (itm.currentStock || 0) <= (itm.minStock !== undefined ? itm.minStock : (itm.minStockAlert || 5)));
        }

        // Sort mode
        if (this.productSortMode === 'name_asc') {
            filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        } else if (this.productSortMode === 'price_desc') {
            filtered.sort((a, b) => (b.wholesalePrice || 0) - (a.wholesalePrice || 0));
        } else if (this.productSortMode === 'price_asc') {
            filtered.sort((a, b) => (a.wholesalePrice || 0) - (b.wholesalePrice || 0));
        } else if (this.productSortMode === 'stock_desc') {
            filtered.sort((a, b) => (b.currentStock || 0) - (a.currentStock || 0));
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:var(--text-sub);">
                    <div style="font-size:36px; margin-bottom:10px;">📦</div>
                    <p style="font-size:14px; margin-bottom:14px; color:#cbd5e1;">${q ? 'No products match your search.' : 'No products added yet.'}</p>
                    <button class="btn btn-primary btn-sm" id="btn-empty-add-product" style="padding:8px 16px; font-weight:700;">+ Add Product</button>
                </div>
            `;
            document.getElementById('btn-empty-add-product')?.addEventListener('click', () => this.openItemModal());
            return;
        }

        container.innerHTML = filtered.map(itm => {
            const stock = itm.currentStock || 0;
            const minStock = itm.minStock !== undefined ? itm.minStock : (itm.minStockAlert || 5);
            const isLow = stock <= minStock;

            return `
                <div class="product-card-item" onclick="window.app.openItemModal('${itm.id}')">
                    <div class="product-card-left">
                        <div class="product-icon-sq">🛍️</div>
                        <div class="product-info-wrap">
                            <h4>${itm.name}</h4>
                            <p>${itm.category || 'General'} • HSN: ${itm.hsn || '-'}${itm.barcode ? ` • [${itm.barcode}]` : ''}</p>
                        </div>
                    </div>
                    <div class="product-card-right" style="display:flex; flex-direction:column; align-items:flex-end; gap:2px;">
                        <div class="product-qty-sub">Qty: ${stock.toFixed(2)} ${itm.unit || ''}</div>
                        ${isLow ? `<span class="badge-low-stock">⚠️ Low (${stock})</span>` : ''}
                        <div class="product-price-bold">${InvoiceEngine.formatCurrency(itm.wholesalePrice || itm.retailPrice || 0)}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ==========================================
    // 4. PARTIES SCREEN
    // ==========================================
    renderPartiesScreen(searchQuery = '') {
        let totalCollect = 0;
        let totalPay = 0;

        for (const p of this.parties) {
            const bal = p.currentBalance || 0;
            if (bal > 0) totalCollect += bal;
            else if (bal < 0) totalPay += Math.abs(bal);
        }

        const collectEl = document.getElementById('party-collect-val');
        const payEl = document.getElementById('party-pay-val');
        if (collectEl) collectEl.textContent = InvoiceEngine.formatCurrency(totalCollect);
        if (payEl) payEl.textContent = InvoiceEngine.formatCurrency(totalPay);

        const container = document.getElementById('parties-cards-container');
        if (!container) return;

        let filtered = [...this.parties];
        const isCustomerTab = this.currentPartyTab === 'customers';
        if (isCustomerTab) {
            filtered = filtered.filter(p => p.type === 'customer' || p.type === 'both');
            const fabText = document.getElementById('parties-fab-text');
            if (fabText) fabText.textContent = '+ NEW CUSTOMER';
        } else {
            filtered = filtered.filter(p => p.type === 'supplier');
            const fabText = document.getElementById('parties-fab-text');
            if (fabText) fabText.textContent = '+ NEW VENDOR';
        }

        // Search query
        const q = (searchQuery || document.getElementById('parties-search-input')?.value || '').toLowerCase().trim();
        if (q) {
            filtered = filtered.filter(p =>
                (p.name && p.name.toLowerCase().includes(q)) ||
                (p.phone && p.phone.toLowerCase().includes(q)) ||
                (p.gstin && p.gstin.toLowerCase().includes(q))
            );
        }

        // Filter dues
        if (this.partyFilterMode === 'has_dues') {
            filtered = filtered.filter(p => (p.currentBalance || 0) > 0);
        } else if (this.partyFilterMode === 'has_payables') {
            filtered = filtered.filter(p => (p.currentBalance || 0) < 0);
        }

        // Sort
        if (this.partySortMode === 'name_asc') {
            filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        } else if (this.partySortMode === 'dues_desc') {
            filtered.sort((a, b) => (b.currentBalance || 0) - (a.currentBalance || 0));
        }

        const partyLabel = isCustomerTab ? 'Customer' : 'Vendor';

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:var(--text-sub);">
                    <div style="font-size:36px; margin-bottom:10px;">👥</div>
                    <p style="font-size:14px; margin-bottom:14px; color:#cbd5e1;">${q ? `No ${partyLabel.toLowerCase()}s match your search.` : `No ${partyLabel.toLowerCase()}s added yet.`}</p>
                    <button class="btn btn-primary btn-sm" id="btn-empty-add-party" style="padding:8px 16px; font-weight:700;">+ Add New ${partyLabel}</button>
                </div>
            `;
            document.getElementById('btn-empty-add-party')?.addEventListener('click', () => this.openPartyModal());
            return;
        }

        container.innerHTML = filtered.map(p => {
            const bal = p.currentBalance || 0;
            const initials = p.name ? p.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : 'PT';
            const isDue = bal > 0;

            // Only show location or address that was actually entered by user - never default to Maharashtra
            let locDisplay = '';
            if (p.city && p.state) {
                locDisplay = `${p.city}, ${p.state}`;
            } else if (p.city) {
                locDisplay = p.city;
            } else if (p.state) {
                locDisplay = p.state;
            } else {
                const rawAddr = (p.billingAddress || p.address || p.deliveryAddress || '').replace(/\r?\n+/g, ', ').trim();
                if (rawAddr) {
                    locDisplay = rawAddr.length > 28 ? (rawAddr.substring(0, 26) + '…') : rawAddr;
                }
            }

            const subInfo = [p.phone || 'No phone', locDisplay].filter(Boolean).join(' • ');

            return `
                <div class="party-card-item" onclick="window.app.openPartyModal('${p.id}')">
                    <div class="party-card-left">
                        <div class="party-initials-circle">${initials}</div>
                        <div>
                            <div class="party-name-title">${p.name}</div>
                            <div class="party-phone-sub">${subInfo}</div>
                        </div>
                    </div>
                    <div class="party-card-right" style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                        <div class="party-dues-status ${isDue ? 'has-due' : ''}">
                            ${isDue ? InvoiceEngine.formatCurrency(bal) + ' due' : '₹No dues'}
                        </div>
                        <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:11px; background:rgba(59,130,246,0.1); color:#3b82f6; border:1px solid rgba(59,130,246,0.3); border-radius:4px;" onclick="event.stopPropagation(); window.app.openPartyLedgerModal('${p.id}')">
                            📋 Khata
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ==========================================
    // MODALS: INVOICE / VOUCHER CREATOR
    // ==========================================
    editVoucher(voucherId) {
        const voucher = this.vouchers.find(v => v.id === voucherId);
        if (!voucher) {
            this.showToast('Invoice not found.', 'error');
            return;
        }
        document.getElementById('print-modal')?.classList.remove('active');
        this.openVoucherModal(voucher.voucherType || 'sales_invoice', voucher);
    }

    openVoucherModal(presetType = 'sales_invoice', voucherToEdit = null) {
        const modal = document.getElementById('voucher-modal');
        const form = document.getElementById('voucher-form');
        if (form) form.reset();

        const actualType = voucherToEdit ? (voucherToEdit.voucherType || presetType) : presetType;
        const vtypeElem = document.getElementById('vform-type');
        if (vtypeElem) vtypeElem.value = actualType;

        let prefix = this.company?.invoicePrefix || 'INV-26/';
        let title = 'Create Tax Invoice';
        let partyLabel = 'Select Customer / Buyer *';

        if (actualType === 'estimate') {
            prefix = this.company?.estimatePrefix || 'EST-26/';
            title = 'Create Quotation / Estimate';
        } else if (actualType === 'delivery_challan') {
            prefix = this.company?.dcPrefix || 'DC-26/';
            title = 'Create Delivery Challan';
        } else if (actualType === 'purchase_invoice') {
            prefix = this.company?.poPrefix || 'PUR-26/';
            title = 'Create Purchase Bill';
            partyLabel = 'Select Supplier / Vendor *';
        } else if (actualType === 'credit_note') {
            prefix = 'CN-26/';
            title = 'Create Credit Note';
        } else if (actualType === 'debit_note') {
            prefix = 'DN-26/';
            title = 'Create Debit Note';
            partyLabel = 'Select Supplier / Vendor *';
        } else if (actualType === 'expense') {
            prefix = 'EXP-26/';
            title = 'Record Expense Voucher';
            partyLabel = 'Paid To / Party *';
        } else if (actualType === 'sales_order') {
            prefix = 'SO-26/';
            title = 'Create Sales Order';
        }

        const idElem = document.getElementById('vform-id');
        if (idElem) idElem.value = voucherToEdit ? voucherToEdit.id : '';

        if (voucherToEdit) {
            title = `Modify ${actualType === 'sales_invoice' ? 'Tax Invoice' : actualType.replace('_', ' ').toUpperCase()} #${voucherToEdit.voucherNo}`;
        }

        const titleElem = document.getElementById('voucher-modal-title');
        if (titleElem) titleElem.textContent = title;

        const partyLbl = document.getElementById('vform-party-label');
        if (partyLbl) partyLbl.textContent = partyLabel;

        // Invoice Number
        document.getElementById('vform-no').value = voucherToEdit
            ? voucherToEdit.voucherNo
            : InvoiceEngine.generateNextVoucherNo(this.vouchers, prefix);

        // Date
        document.getElementById('vform-date').value = voucherToEdit
            ? (voucherToEdit.date || new Date().toISOString().split('T')[0])
            : new Date().toISOString().split('T')[0];

        // Due date
        const due = new Date();
        due.setDate(due.getDate() + 30);
        document.getElementById('vform-due-date').value = voucherToEdit
            ? (voucherToEdit.dueDate || '')
            : due.toISOString().split('T')[0];

        // Party selector
        const partySelect = document.getElementById('vform-party-select');
        if (partySelect) {
            partySelect.innerHTML = '<option value="">-- Choose Party --</option><option value="cash_sale">⚡ Cash Sale / Walk-in Customer</option>';
            this.parties.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                const loc = p.city || p.state || (p.billingAddress ? p.billingAddress.slice(0, 20) : '');
                opt.textContent = `${p.name}${p.phone ? ` (${p.phone})` : (loc ? ` (${loc})` : '')}`;
                partySelect.appendChild(opt);
            });
            if (voucherToEdit && voucherToEdit.partyId) {
                partySelect.value = voucherToEdit.partyId;
            }
        }

        // Place of supply
        const placeInput = document.getElementById('vform-place-of-supply');
        if (placeInput) {
            placeInput.value = voucherToEdit ? (voucherToEdit.placeOfSupply || '') : '';
        }

        // Godown selector
        const godownSelect = document.getElementById('vform-godown-select');
        if (godownSelect) {
            godownSelect.innerHTML = '';
            this.godowns.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = `${g.name} (${g.location})`;
                godownSelect.appendChild(opt);
            });
            if (voucherToEdit && voucherToEdit.godownId) {
                godownSelect.value = voucherToEdit.godownId;
            }
        }

        // Delivery Address
        const delivAddressInput = document.getElementById('vform-delivery-address');
        if (delivAddressInput) {
            if (voucherToEdit) {
                delivAddressInput.value = voucherToEdit.deliveryAddress || voucherToEdit.shippingAddress || voucherToEdit.partyAddress || '';
            } else {
                const initialParty = this.parties.find(p => p.id === partySelect?.value);
                delivAddressInput.value = initialParty ? (initialParty.deliveryAddress || initialParty.shippingAddress || initialParty.billingAddress || '') : '';
            }
        }

        // Transporter Section
        const hasTransporterCheck = document.getElementById('vform-has-transporter');
        const transSec = document.getElementById('vform-transporter-section');
        const transNameInput = document.getElementById('vform-transporter-name');
        const transLrInput = document.getElementById('vform-transporter-lr');
        const transCostInput = document.getElementById('vform-transporter-cost');
        const transGstSelect = document.getElementById('vform-transporter-gst');

        if (voucherToEdit && (voucherToEdit.hasTransporter || (voucherToEdit.transporterCost > 0))) {
            if (hasTransporterCheck) hasTransporterCheck.checked = true;
            if (transSec) transSec.style.display = 'block';
            if (transNameInput) transNameInput.value = voucherToEdit.transporterName || '';
            if (transLrInput) transLrInput.value = voucherToEdit.transporterLr || voucherToEdit.vehicleNo || voucherToEdit.ewayBillNo || '';
            if (transCostInput) transCostInput.value = voucherToEdit.transporterCost ? voucherToEdit.transporterCost : '';
            if (transGstSelect) transGstSelect.value = voucherToEdit.transporterGstRate !== undefined ? String(voucherToEdit.transporterGstRate) : '0';
        } else {
            if (hasTransporterCheck) hasTransporterCheck.checked = false;
            if (transSec) transSec.style.display = 'none';
            if (transNameInput) transNameInput.value = '';
            if (transLrInput) transLrInput.value = '';
            if (transCostInput) transCostInput.value = '';
            if (transGstSelect) transGstSelect.value = '0';
        }

        // Line Items
        const tbody = document.getElementById('vform-items-tbody');
        if (tbody) {
            tbody.innerHTML = '';
            if (voucherToEdit && voucherToEdit.items && voucherToEdit.items.length > 0) {
                voucherToEdit.items.forEach(itm => this.addItemRowToVoucher(itm));
            } else {
                this.addItemRowToVoucher();
            }
        }

        // Paid amount
        const paidInput = document.getElementById('vform-paid-amount');
        if (paidInput) {
            paidInput.value = voucherToEdit && typeof voucherToEdit.paidAmount === 'number'
                ? voucherToEdit.paidAmount.toFixed(2)
                : '0.00';
        }

        // Terms & Conditions and Footer Text (per-invoice editable)
        const vformTerms = document.getElementById('vform-terms');
        if (vformTerms) {
            vformTerms.value = voucherToEdit
                ? (voucherToEdit.termsAndConditions !== undefined ? voucherToEdit.termsAndConditions : (this.company?.termsAndConditions || ''))
                : (this.company?.termsAndConditions || '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be levied if payment not made within due date.\n3. All disputes subject to local jurisdiction.');
        }

        const vformFooter = document.getElementById('vform-footer');
        if (vformFooter) {
            vformFooter.value = voucherToEdit
                ? (voucherToEdit.footerText !== undefined ? voucherToEdit.footerText : (this.company?.footerText || ''))
                : (this.company?.footerText || '');
        }

        // Delete button visibility in voucher modal
        const delBtn = document.getElementById('btn-vform-delete-voucher');
        if (delBtn) {
            if (voucherToEdit) {
                delBtn.style.display = 'inline-flex';
                delBtn.onclick = () => this.deleteVoucherPrompt(voucherToEdit.id);
            } else {
                delBtn.style.display = 'none';
                delBtn.onclick = null;
            }
        }

        this.updateVoucherCalculations();
        modal.classList.add('active');
    }

    addItemRowToVoucher(initialData = null) {
        const tbody = document.getElementById('vform-items-tbody');
        if (!tbody) return;
        const tr = document.createElement('tr');
        tr.className = 'vform-item-row';

        let itemOptions = '<option value="">-- Choose Item --</option>';
        this.items.forEach(itm => {
            const isSel = initialData && initialData.itemId === itm.id ? 'selected' : '';
            itemOptions += `<option value="${itm.id}" ${isSel}>${itm.name} (₹${itm.wholesalePrice})</option>`;
        });

        const customName = (initialData?.name && !this.items.some(i => i.id === initialData.itemId && i.name === initialData.name))
            ? initialData.name
            : (initialData?.customName || '');
        const hsn = initialData?.hsn || '';
        const qty = initialData ? Number(initialData.qty || 1) : 1;
        const price = initialData ? Number(initialData.price || 0) : 0;
        const disc = initialData ? Number(initialData.discountPercent || 0) : 0;
        const taxRate = initialData ? Number(initialData.taxRate || 18) : 18;

        tr.innerHTML = `
            <td>
                <select class="form-control vrow-item-select" onchange="window.app.onVoucherItemSelect(this)" style="font-size:11px;">
                    ${itemOptions}
                </select>
                <input type="text" class="form-control vrow-custom-name" placeholder="Custom name" value="${customName ? customName.replace(/"/g, '&quot;') : ''}" style="margin-top:2px; font-size:10px; height:24px;"/>
            </td>
            <td><input type="text" class="form-control vrow-hsn" placeholder="7318" value="${hsn}"/></td>
            <td><input type="number" class="form-control vrow-qty" value="${qty}" min="1" oninput="window.app.updateVoucherCalculations()"/></td>
            <td><input type="number" step="0.01" class="form-control vrow-price" value="${price.toFixed(2)}" oninput="window.app.updateVoucherCalculations()"/></td>
            <td><input type="number" step="0.1" class="form-control vrow-disc" value="${disc}" min="0" max="100" oninput="window.app.updateVoucherCalculations()"/></td>
            <td>
                <select class="form-control vrow-tax-rate" onchange="window.app.updateVoucherCalculations()">
                    <option value="0" ${taxRate === 0 ? 'selected' : ''}>0%</option>
                    <option value="5" ${taxRate === 5 ? 'selected' : ''}>5%</option>
                    <option value="12" ${taxRate === 12 ? 'selected' : ''}>12%</option>
                    <option value="18" ${taxRate === 18 ? 'selected' : ''}>18%</option>
                    <option value="28" ${taxRate === 28 ? 'selected' : ''}>28%</option>
                </select>
            </td>
            <td style="text-align:right; font-weight:700;" class="vrow-total-amt">₹ 0.00</td>
            <td style="text-align:center;">
                <button type="button" class="btn-icon" style="color:#ef4444; width:24px; height:24px;" onclick="window.app.removeItemRow(this)">&times;</button>
            </td>
        `;

        tbody.appendChild(tr);
    }

    removeItemRow(buttonElem) {
        const row = buttonElem.closest('tr');
        if (row) {
            row.remove();
            this.updateVoucherCalculations();
        }
    }

    onVoucherItemSelect(selectElem) {
        const itemId = selectElem.value;
        const row = selectElem.closest('tr');
        if (!itemId || !row) return;

        const itm = this.items.find(i => i.id === itemId);
        if (!itm) return;

        row.querySelector('.vrow-hsn').value = itm.hsn || '';
        row.querySelector('.vrow-price').value = itm.wholesalePrice || itm.retailPrice || 0;
        row.querySelector('.vrow-tax-rate').value = itm.taxRate || 18;

        this.updateVoucherCalculations();
    }

    onVoucherPartyChange() {
        const partyId = document.getElementById('vform-party-select')?.value;
        const placeInput = document.getElementById('vform-place-of-supply');
        const delivAddressInput = document.getElementById('vform-delivery-address');
        if (!partyId) return;

        if (partyId === 'cash_sale') {
            if (placeInput) placeInput.value = this.company?.state || '';
            if (delivAddressInput) delivAddressInput.value = 'Counter Delivery / Walk-in Customer';
            this.updateVoucherCalculations();
            return;
        }

        const party = this.parties.find(p => p.id === partyId);
        if (party) {
            if (placeInput) placeInput.value = party.placeOfSupply || party.state || party.city || '';
            if (delivAddressInput) {
                delivAddressInput.value = party.deliveryAddress || party.shippingAddress || party.billingAddress || '';
            }
        }
        this.updateVoucherCalculations();
    }

    updateVoucherCalculations() {
        const compState = this.company?.state || '';
        const placeOfSupply = document.getElementById('vform-place-of-supply')?.value?.trim() || compState;
        const taxType = InvoiceEngine.determineTaxType(compState, placeOfSupply);

        const rows = document.querySelectorAll('.vform-item-row');
        let subtotal = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;

        rows.forEach(row => {
            const qty = Number(row.querySelector('.vrow-qty')?.value) || 0;
            const price = Number(row.querySelector('.vrow-price')?.value) || 0;
            const disc = Number(row.querySelector('.vrow-disc')?.value) || 0;
            const taxRate = Number(row.querySelector('.vrow-tax-rate')?.value) || 0;

            const line = InvoiceEngine.calculateItemTotals({ qty, price, discountPercent: disc, taxRate }, taxType);
            const totalCell = row.querySelector('.vrow-total-amt');
            if (totalCell) totalCell.textContent = InvoiceEngine.formatCurrency(line.totalAmount);

            subtotal += line.taxableAmount;
            totalCgst += line.cgst;
            totalSgst += line.sgst;
            totalIgst += line.igst;
        });

        // Transporter / Freight Charges
        const hasTransporter = document.getElementById('vform-has-transporter')?.checked || false;
        const transCost = hasTransporter ? (Number(document.getElementById('vform-transporter-cost')?.value) || 0) : 0;
        const transGstRate = hasTransporter ? (Number(document.getElementById('vform-transporter-gst')?.value) || 0) : 0;

        let transTax = 0;
        let transCgst = 0;
        let transSgst = 0;
        let transIgst = 0;

        if (transCost > 0 && transGstRate > 0) {
            transTax = (transCost * transGstRate) / 100;
            if (taxType === 'intra') {
                transCgst = transTax / 2;
                transSgst = transTax / 2;
            } else {
                transIgst = transTax;
            }
        }

        const transRow = document.getElementById('vcalc-transporter-row');
        const transLabel = document.getElementById('vcalc-transporter-label');
        const transCostEl = document.getElementById('vcalc-transporter-cost');
        const transHint = document.getElementById('vform-transporter-tax-hint');

        if (transRow) {
            if (hasTransporter && transCost > 0) {
                transRow.style.display = 'flex';
                if (transLabel) transLabel.textContent = `Freight / Transporter (${transGstRate > 0 ? `GST ${transGstRate}%` : 'No GST'}):`;
                if (transCostEl) transCostEl.textContent = InvoiceEngine.formatCurrency(transCost);
            } else {
                transRow.style.display = 'none';
            }
        }

        if (transHint) {
            if (transCost > 0) {
                transHint.textContent = transGstRate > 0
                    ? `Freight: ₹${transCost.toFixed(2)} + GST (${transGstRate}%): ₹${transTax.toFixed(2)} = Total ₹${(transCost + transTax).toFixed(2)} added to invoice.`
                    : `Freight: ₹${transCost.toFixed(2)} (Without GST) added to invoice.`;
            } else {
                transHint.textContent = 'Transporter cost will be added to the invoice total.';
            }
        }

        const totalTaxable = subtotal + transCost;
        const finalCgst = totalCgst + transCgst;
        const finalSgst = totalSgst + transSgst;
        const finalIgst = totalIgst + transIgst;
        const finalTotalTax = finalCgst + finalSgst + finalIgst;

        const rawGrand = totalTaxable + finalTotalTax;
        const roundedGrand = Math.round(rawGrand);
        const roundOff = roundedGrand - rawGrand;

        const subEl = document.getElementById('vcalc-subtotal');
        const cgstEl = document.getElementById('vcalc-cgst-sgst');
        const igstEl = document.getElementById('vcalc-igst');
        const roundEl = document.getElementById('vcalc-roundoff');
        const grandEl = document.getElementById('vcalc-grand-total');

        if (subEl) subEl.textContent = InvoiceEngine.formatCurrency(subtotal);
        if (roundEl) roundEl.textContent = InvoiceEngine.formatCurrency(roundOff);
        if (grandEl) grandEl.textContent = InvoiceEngine.formatCurrency(roundedGrand);

        const cgstRow = document.getElementById('vcalc-cgst-sgst-row');
        const igstRow = document.getElementById('vcalc-igst-row');

        if (taxType === 'intra') {
            if (cgstRow) cgstRow.style.display = 'flex';
            if (igstRow) igstRow.style.display = 'none';
            if (cgstEl) cgstEl.textContent = InvoiceEngine.formatCurrency(finalCgst + finalSgst);
        } else {
            if (cgstRow) cgstRow.style.display = 'none';
            if (igstRow) igstRow.style.display = 'flex';
            if (igstEl) igstEl.textContent = InvoiceEngine.formatCurrency(finalIgst);
        }

        const paidInput = document.getElementById('vform-paid-amount');
        const paidAmount = Number(paidInput?.value) || 0;
        const balanceDue = Math.max(0, roundedGrand - paidAmount);
        const balEl = document.getElementById('vcalc-balance-due');
        if (balEl) balEl.textContent = InvoiceEngine.formatCurrency(balanceDue);
    }

    async saveVoucher(openPrintAfter = false) {
        const partyId = document.getElementById('vform-party-select')?.value;
        const voucherNo = document.getElementById('vform-no')?.value?.trim();
        if (!partyId) {
            alert('Please select a Customer or Party.');
            return;
        }
        if (!voucherNo) {
            alert('Please enter an Invoice / Document Number.');
            return;
        }

        const existingId = document.getElementById('vform-id')?.value?.trim();
        const existingVoucher = existingId ? this.vouchers.find(v => v.id === existingId) : null;

        // If modifying existing voucher, revert its previous stock impact first
        if (existingVoucher) {
            if (existingVoucher.voucherType === 'sales_invoice') {
                for (const oldLine of (existingVoucher.items || [])) {
                    if (oldLine.itemId) {
                        const itm = this.items.find(i => i.id === oldLine.itemId);
                        if (itm) {
                            itm.currentStock = (itm.currentStock || 0) + Number(oldLine.qty || 0);
                            await window.dbService.put('items', itm);
                        }
                    }
                }
            } else if (existingVoucher.voucherType === 'purchase_invoice') {
                for (const oldLine of (existingVoucher.items || [])) {
                    if (oldLine.itemId) {
                        const itm = this.items.find(i => i.id === oldLine.itemId);
                        if (itm) {
                            itm.currentStock = Math.max(0, (itm.currentStock || 0) - Number(oldLine.qty || 0));
                            await window.dbService.put('items', itm);
                        }
                    }
                }
            }

            // Revert previous party balance
            const oldParty = this.parties.find(p => p.id === existingVoucher.partyId);
            if (oldParty && oldParty.id !== 'cash_sale') {
                if (existingVoucher.voucherType === 'sales_invoice') {
                    oldParty.currentBalance = (oldParty.currentBalance || 0) - Number(existingVoucher.balanceDue || 0);
                    await window.dbService.put('parties', oldParty);
                } else if (existingVoucher.voucherType === 'purchase_invoice') {
                    oldParty.currentBalance = (oldParty.currentBalance || 0) + Number(existingVoucher.balanceDue || 0);
                    await window.dbService.put('parties', oldParty);
                }
            }
        }

        const compState = this.company?.state || '';
        const party = partyId === 'cash_sale'
            ? { id: 'cash_sale', name: 'Cash / Walk-in Customer', partyType: 'customer', state: compState, stateCode: this.company?.stateCode || '', gstin: '', phone: '', address: 'Counter Sale' }
            : this.parties.find(p => p.id === partyId);

        const placeOfSupply = document.getElementById('vform-place-of-supply')?.value?.trim() || party?.placeOfSupply || party?.state || party?.city || compState;
        const taxType = InvoiceEngine.determineTaxType(compState, placeOfSupply);
        const godownId = document.getElementById('vform-godown-select')?.value || 'godown_primary';

        const items = [];
        const rows = document.querySelectorAll('.vform-item-row');
        rows.forEach(row => {
            const select = row.querySelector('.vrow-item-select');
            const customName = row.querySelector('.vrow-custom-name')?.value?.trim();
            const itemId = select?.value;
            const itm = this.items.find(i => i.id === itemId);

            const name = customName || (itm ? itm.name : 'Custom Item');
            const hsn = row.querySelector('.vrow-hsn')?.value?.trim() || '8544';
            const qty = Number(row.querySelector('.vrow-qty')?.value) || 1;
            const price = Number(row.querySelector('.vrow-price')?.value) || 0;
            const discountPercent = Number(row.querySelector('.vrow-disc')?.value) || 0;
            const taxRate = Number(row.querySelector('.vrow-tax-rate')?.value) || 0;

            const calcs = InvoiceEngine.calculateItemTotals({ qty, price, discountPercent, taxRate }, taxType);

            items.push({
                itemId,
                name,
                hsn,
                qty,
                price,
                discountPercent,
                taxRate,
                ...calcs
            });
        });

        const editedDeliveryAddress = document.getElementById('vform-delivery-address')?.value?.trim();
        const hasTransporter = document.getElementById('vform-has-transporter')?.checked || false;
        const transporterName = hasTransporter ? (document.getElementById('vform-transporter-name')?.value?.trim() || '') : '';
        const transporterLr = hasTransporter ? (document.getElementById('vform-transporter-lr')?.value?.trim() || '') : '';
        const transporterCost = hasTransporter ? (Number(document.getElementById('vform-transporter-cost')?.value) || 0) : 0;
        const transporterGstRate = hasTransporter ? (Number(document.getElementById('vform-transporter-gst')?.value) || 0) : 0;

        const totals = InvoiceEngine.calculateVoucherTotals(items, taxType, 'percentage', 0, {
            transporterCost,
            transporterGstRate
        });
        const paidAmount = Number(document.getElementById('vform-paid-amount')?.value) || 0;
        const balanceDue = Math.max(0, totals.grandTotal - paidAmount);
        const paymentStatus = balanceDue === 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid');
        const voucherType = document.getElementById('vform-type')?.value || 'sales_invoice';
        const nowIso = new Date().toISOString();

        const termsElem = document.getElementById('vform-terms');
        const footerElem = document.getElementById('vform-footer');
        const termsAndConditions = termsElem ? termsElem.value.trim() : (existingVoucher?.termsAndConditions || this.company?.termsAndConditions || '');
        const footerText = footerElem ? footerElem.value.trim() : (existingVoucher?.footerText || this.company?.footerText || '');

        const voucher = {
            id: existingId || ('vch_' + Date.now()),
            createdAt: existingVoucher?.createdAt || existingVoucher?.date || nowIso,
            updatedAt: nowIso,
            lastModified: nowIso,
            voucherNo,
            voucherType,
            date: document.getElementById('vform-date')?.value || nowIso.split('T')[0],
            dueDate: document.getElementById('vform-due-date')?.value || '',
            partyId,
            partyName: party ? party.name : 'Customer',
            partyPhone: party?.phone,
            partyGstin: party?.gstin,
            partyAddress: party?.billingAddress || '',
            billingAddress: party?.billingAddress || '',
            partyState: party?.state || '',
            partyStateCode: party?.stateCode || '',
            deliveryAddress: editedDeliveryAddress || party?.deliveryAddress || party?.shippingAddress || party?.billingAddress || '',
            shippingAddress: editedDeliveryAddress || party?.shippingAddress || party?.deliveryAddress || party?.billingAddress || '',
            hasTransporter,
            transporterName,
            transporterLr,
            vehicleNo: transporterLr,
            transporterCost: totals.transporterCost,
            transporterGstRate: totals.transporterGstRate,
            transporterTax: totals.transporterTax,
            transporterCgst: totals.transporterCgst,
            transporterSgst: totals.transporterSgst,
            transporterIgst: totals.transporterIgst,
            placeOfSupply,
            taxType,
            godownId,
            items: totals.items,
            subtotal: totals.subtotal,
            taxableTotal: totals.taxableTotal,
            cgst: totals.cgst,
            sgst: totals.sgst,
            igst: totals.igst,
            totalTax: totals.totalTax,
            roundOff: totals.roundOff,
            grandTotal: totals.grandTotal,
            paidAmount,
            balanceDue,
            paymentStatus,
            termsAndConditions,
            footerText
        };

        // 1. Save voucher to offline IndexedDB
        await window.dbService.put('vouchers', voucher);

        // 2. Adjust stock
        if (voucher.voucherType === 'sales_invoice') {
            for (const line of items) {
                if (line.itemId) {
                    const itm = this.items.find(i => i.id === line.itemId);
                    if (itm) {
                        itm.currentStock = Math.max(0, (itm.currentStock || 0) - line.qty);
                        await window.dbService.put('items', itm);
                    }
                }
            }
        } else if (voucher.voucherType === 'purchase_invoice') {
            for (const line of items) {
                if (line.itemId) {
                    const itm = this.items.find(i => i.id === line.itemId);
                    if (itm) {
                        itm.currentStock = (itm.currentStock || 0) + line.qty;
                        await window.dbService.put('items', itm);
                    }
                }
            }
        }

        // 3. Update party balance
        if (party && party.id !== 'cash_sale') {
            if (voucher.voucherType === 'sales_invoice') {
                party.currentBalance = (party.currentBalance || 0) + balanceDue;
                await window.dbService.put('parties', party);
            } else if (voucher.voucherType === 'purchase_invoice') {
                party.currentBalance = (party.currentBalance || 0) - balanceDue;
                await window.dbService.put('parties', party);
            }
        }

        document.getElementById('voucher-modal')?.classList.remove('active');
        await this.loadAllState();
        this.showToast(existingId ? `Invoice #${voucher.voucherNo} modified successfully!` : `Invoice #${voucher.voucherNo} saved successfully!`, 'success');

        if (openPrintAfter) {
            this.openPrintModal(voucher.id);
        } else {
            this.switchScreen('screen-bills');
        }
    }

    // ==========================================
    // PAYMENT STATUS CONTROLLER (Paid / Partial / Due)
    // ==========================================
    async handleBillStatusSelect(voucherId, selectedStatus) {
        if (selectedStatus === 'partial') {
            this.openPaymentStatusModal(voucherId);
        } else {
            await this.updateVoucherPaymentStatus(voucherId, selectedStatus);
        }
    }

    openPaymentStatusModal(voucherId) {
        const voucher = this.vouchers.find(v => v.id === voucherId);
        if (!voucher) return;

        const modal = document.getElementById('payment-status-modal');
        if (!modal) return;

        const vIdInput = document.getElementById('paystatus-voucher-id');
        const grandTotalEl = document.getElementById('paystatus-grand-total');
        const partyNameEl = document.getElementById('paystatus-party-name');
        const paidInput = document.getElementById('paystatus-paid-input');

        if (vIdInput) vIdInput.value = voucher.id;
        if (grandTotalEl) grandTotalEl.textContent = InvoiceEngine.formatCurrency(voucher.grandTotal);
        if (partyNameEl) partyNameEl.textContent = voucher.partyName || 'Customer';

        const grandTotal = Number(voucher.grandTotal || 0);
        const currentStatus = voucher.paymentStatus || (Number(voucher.balanceDue || 0) <= 0 ? 'paid' : 'unpaid');
        let currentPaid = Number(voucher.paidAmount ?? voucher.amountPaid ?? 0);
        if (currentStatus === 'paid' && currentPaid === 0) currentPaid = grandTotal;

        if (paidInput) {
            paidInput.value = currentPaid > 0 ? currentPaid.toFixed(2) : (currentStatus === 'paid' ? grandTotal.toFixed(2) : '');
        }

        this.setPaymentStatusModalActiveState(currentStatus, grandTotal, currentPaid);
        modal.classList.add('active');
    }

    setPaymentStatusModalActiveState(status, grandTotal, paidAmount) {
        this.currentModalPayStatus = status;

        const btnPaid = document.getElementById('btn-paystatus-paid');
        const btnPartial = document.getElementById('btn-paystatus-partial');
        const btnDue = document.getElementById('btn-paystatus-due');
        const paidInput = document.getElementById('paystatus-paid-input');
        const balanceDueEl = document.getElementById('paystatus-balance-due');

        [btnPaid, btnPartial, btnDue].forEach(b => {
            if (b) {
                b.style.opacity = '0.5';
                b.style.transform = 'scale(0.96)';
                b.style.boxShadow = 'none';
            }
        });

        if (status === 'paid') {
            if (btnPaid) {
                btnPaid.style.opacity = '1';
                btnPaid.style.transform = 'scale(1.02)';
                btnPaid.style.boxShadow = '0 0 0 2px #16a34a';
            }
            if (paidInput) paidInput.value = grandTotal.toFixed(2);
            if (balanceDueEl) balanceDueEl.textContent = '₹ 0.00';
        } else if (status === 'unpaid') {
            if (btnDue) {
                btnDue.style.opacity = '1';
                btnDue.style.transform = 'scale(1.02)';
                btnDue.style.boxShadow = '0 0 0 2px #dc2626';
            }
            if (paidInput) paidInput.value = '0.00';
            if (balanceDueEl) balanceDueEl.textContent = InvoiceEngine.formatCurrency(grandTotal);
        } else { // partial
            if (btnPartial) {
                btnPartial.style.opacity = '1';
                btnPartial.style.transform = 'scale(1.02)';
                btnPartial.style.boxShadow = '0 0 0 2px #d97706';
            }
            const p = Number(paidInput?.value) || paidAmount || 0;
            const bal = Math.max(0, grandTotal - p);
            if (balanceDueEl) balanceDueEl.textContent = InvoiceEngine.formatCurrency(bal);
        }
    }

    async updateVoucherPaymentStatus(voucherId, newStatus, customPaidAmount = null) {
        const voucher = this.vouchers.find(v => v.id === voucherId);
        if (!voucher) {
            this.showToast('Voucher not found', 'error');
            return;
        }

        const grandTotal = Number(voucher.grandTotal || 0);
        let paidAmount = 0;
        let balanceDue = grandTotal;
        let status = newStatus;

        if (status === 'paid') {
            paidAmount = grandTotal;
            balanceDue = 0;
        } else if (status === 'unpaid') {
            paidAmount = 0;
            balanceDue = grandTotal;
        } else if (status === 'partial') {
            const entered = Number(customPaidAmount);
            if (isNaN(entered) || entered <= 0) {
                paidAmount = 0;
                balanceDue = grandTotal;
                status = 'unpaid';
            } else if (entered >= grandTotal) {
                paidAmount = grandTotal;
                balanceDue = 0;
                status = 'paid';
            } else {
                paidAmount = Math.round(entered * 100) / 100;
                balanceDue = Math.max(0, Math.round((grandTotal - paidAmount) * 100) / 100);
                status = 'partial';
            }
        }

        const oldBalanceDue = Number(voucher.balanceDue || 0);
        const diffBalance = balanceDue - oldBalanceDue;

        voucher.paymentStatus = status;
        voucher.paidAmount = paidAmount;
        voucher.balanceDue = balanceDue;
        voucher.updatedAt = new Date().toISOString();
        voucher.lastModified = new Date().toISOString();

        await window.dbService.put('vouchers', voucher);

        // Adjust party balance if applicable
        if (voucher.partyId && voucher.partyId !== 'cash_sale' && diffBalance !== 0) {
            const party = this.parties.find(p => p.id === voucher.partyId);
            if (party) {
                if (voucher.voucherType === 'sales_invoice') {
                    party.currentBalance = (party.currentBalance || 0) + diffBalance;
                } else if (voucher.voucherType === 'purchase_invoice') {
                    party.currentBalance = (party.currentBalance || 0) - diffBalance;
                }
                await window.dbService.put('parties', party);
            }
        }

        await this.loadAllState();
        this.renderBillsScreen();

        // If the print modal is open with this voucher, update preview
        if (this.activeVoucherForPrint && this.activeVoucherForPrint.id === voucher.id) {
            this.activeVoucherForPrint = voucher;
            const party = this.parties.find(p => p.id === voucher.partyId);
            this.renderPrintDocument(voucher, this.company, party);
        }

        const statusDisplay = status === 'paid' ? 'Paid' : (status === 'partial' ? 'Partially Paid' : 'Due');
        this.showToast(`Invoice #${voucher.voucherNo} status updated to ${statusDisplay}!`, 'success');
    }

    // ==========================================
    // PRINT & PREVIEW MODAL
    // ==========================================
    openPrintModal(voucherId) {
        const voucher = this.vouchers.find(v => v.id === voucherId);
        if (!voucher) return;

        this.activeVoucherForPrint = voucher;
        const party = this.parties.find(p => p.id === voucher.partyId);

        const selector = document.getElementById('print-template-selector');
        if (voucher.voucherType === 'estimate') {
            if (selector) selector.value = 'swastik_quotation';
            this.activePrintTemplate = 'swastik_quotation';
        } else {
            if (selector && selector.value === 'swastik_quotation') {
                selector.value = 'swastik_tax_invoice';
            }
            this.activePrintTemplate = selector?.value || 'swastik_tax_invoice';
        }

        const fontSelector = document.getElementById('print-font-selector');
        this.activePrintFont = fontSelector?.value || 'font-arial';

        const scaleSelector = document.getElementById('print-font-size-selector');
        this.activePrintScale = scaleSelector?.value || 'font-scale-standard';

        this.renderPrintDocument(voucher, this.company, party);
        document.getElementById('print-modal')?.classList.add('active');
    }

    renderPrintDocument(voucher, company, party) {
        const host = document.getElementById('invoice-preview-host');
        if (!host) return;

        const fontClass = this.activePrintFont || 'font-arial';
        const scaleClass = this.activePrintScale || 'font-scale-standard';
        const copyType = document.getElementById('print-copy-selector')?.value || this.activeInvoiceCopy || 'ORIGINAL FOR RECIPIENT';

        if (this.activePrintTemplate === 'swastik_tax_invoice') {
            host.innerHTML = InvoicePrinter.renderSwastikFormat(voucher, company, party, 'tax_invoice', copyType);
        } else if (this.activePrintTemplate === 'swastik_quotation') {
            host.innerHTML = InvoicePrinter.renderSwastikFormat(voucher, company, party, 'quotation', copyType);
        } else if (this.activePrintTemplate === 'dot_matrix_international') {
            host.innerHTML = InvoicePrinter.renderDotMatrixInternational(voucher, company, party, fontClass, scaleClass, copyType);
        } else if (this.activePrintTemplate === 'thermal_80mm') {
            host.innerHTML = InvoicePrinter.renderThermalReceipt(voucher, company, party, '80mm');
        } else if (this.activePrintTemplate === 'thermal_58mm') {
            host.innerHTML = InvoicePrinter.renderThermalReceipt(voucher, company, party, '58mm');
        } else if (this.activePrintTemplate === 'classic_industrial') {
            host.innerHTML = InvoicePrinter.renderClassicIndustrial(voucher, company, party, copyType);
        } else if (this.activePrintTemplate === 'minimal_clean') {
            host.innerHTML = InvoicePrinter.renderMinimalClean(voucher, company, party, copyType);
        } else {
            host.innerHTML = InvoicePrinter.renderModernGST(voucher, company, party, copyType);
        }
        setTimeout(() => this.initPreviewZoomEngine(), 50);
    }

    triggerPrint() {
        const host = document.getElementById('invoice-preview-host');
        if (host) {
            InvoicePrinter.printDocument(host.innerHTML);
        }
    }

    // ==========================================
    // INVOICE PREVIEW FINGER PINCH-TO-ZOOM ENGINE
    // ==========================================
    initPreviewZoomEngine() {
        const host = document.getElementById('invoice-preview-host');
        const badge = document.getElementById('preview-zoom-badge');
        const badgeText = document.getElementById('preview-zoom-text');
        if (!host) return;

        // Clean up previous listeners if any
        if (this._zoomEngineCleanup) {
            this._zoomEngineCleanup();
            this._zoomEngineCleanup = null;
        }

        const doc = host.querySelector('.print-document');
        if (!doc) return;

        doc.style.transformOrigin = '0 0';
        doc.style.willChange = 'transform';

        const hostW = host.clientWidth || 360;
        const hostH = host.clientHeight || 500;
        const docW = doc.offsetWidth || 580;
        const docH = doc.offsetHeight || 800;

        // Calculate fit scale so width fits comfortably inside host with small padding
        const fitScale = Math.min(1.0, (hostW - 12) / docW);
        const minScale = fitScale * 0.75;
        const maxScale = Math.max(fitScale * 5.0, 3.5);

        let scale = fitScale;
        let panX = Math.round((hostW - docW * fitScale) / 2);
        let panY = 10;

        let isPinching = false;
        let isPanning = false;
        let startDist = 0;
        let startScale = fitScale;
        let startMidX = 0;
        let startMidY = 0;
        let startPanX = 0;
        let startPanY = 0;
        let touchStartX = 0;
        let touchStartY = 0;
        let lastTapTime = 0;
        let badgeTimeout = null;

        const applyTransform = (withTransition = false) => {
            if (withTransition) {
                doc.style.transition = 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)';
            } else {
                doc.style.transition = 'none';
            }
            doc.style.transform = `translate3d(${Math.round(panX)}px, ${Math.round(panY)}px, 0) scale(${scale})`;
        };

        const clampPan = (withTransition = false) => {
            const currentW = docW * scale;
            const currentH = docH * scale;

            if (currentW <= hostW) {
                panX = (hostW - currentW) / 2;
            } else {
                const minX = hostW - currentW - 16;
                const maxX = 16;
                panX = Math.max(minX, Math.min(maxX, panX));
            }

            if (currentH <= hostH) {
                panY = Math.max(10, (hostH - currentH) / 2);
            } else {
                const minY = hostH - currentH - 30;
                const maxY = 10;
                panY = Math.max(minY, Math.min(maxY, panY));
            }

            applyTransform(withTransition);
        };

        const updateBadge = (showHint = false) => {
            if (!badge || !badgeText) return;
            if (badgeTimeout) clearTimeout(badgeTimeout);

            badge.style.display = 'flex';
            badge.style.opacity = '1';

            if (showHint) {
                badgeText.textContent = 'Pinch with 2 fingers to zoom 🔍';
                badgeTimeout = setTimeout(() => {
                    if (scale <= fitScale * 1.05 && badge) {
                        badge.style.opacity = '0';
                        setTimeout(() => { if (scale <= fitScale * 1.05 && badge) badge.style.display = 'none'; }, 260);
                    }
                }, 2800);
            } else {
                const pct = Math.round((scale / fitScale) * 100);
                if (scale > fitScale * 1.05) {
                    badgeText.textContent = `${pct}% • Tap to Reset ↺`;
                } else {
                    badgeText.textContent = 'Fit Screen • Double-tap to Zoom 🔍';
                    badgeTimeout = setTimeout(() => {
                        if (scale <= fitScale * 1.05 && badge) {
                            badge.style.opacity = '0';
                            setTimeout(() => { if (scale <= fitScale * 1.05 && badge) badge.style.display = 'none'; }, 260);
                        }
                    }, 2200);
                }
            }
        };

        const resetToFit = (animate = true) => {
            scale = fitScale;
            panX = Math.round((hostW - docW * fitScale) / 2);
            panY = 10;
            applyTransform(animate);
            updateBadge();
        };

        const onBadgeClick = (e) => {
            e.stopPropagation();
            resetToFit(true);
        };
        badge?.addEventListener('click', onBadgeClick);

        const onTouchStart = (e) => {
            if (e.touches.length === 2) {
                isPinching = true;
                isPanning = false;
                startDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                startScale = scale;
                startMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                startMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                startPanX = panX;
                startPanY = panY;
                doc.style.transition = 'none';
                e.preventDefault();
            } else if (e.touches.length === 1) {
                isPinching = false;
                isPanning = true;

                // Double-tap detection
                const now = Date.now();
                if (now - lastTapTime < 320) {
                    const hostRect = host.getBoundingClientRect();
                    const tapX = e.touches[0].clientX - hostRect.left;
                    const tapY = e.touches[0].clientY - hostRect.top;

                    if (scale > fitScale * 1.1) {
                        resetToFit(true);
                    } else {
                        // Smooth zoom in 2.2x centered on tap
                        const targetScale = Math.min(fitScale * 2.5, maxScale);
                        panX = tapX - ((tapX - panX) * (targetScale / scale));
                        panY = tapY - ((tapY - panY) * (targetScale / scale));
                        scale = targetScale;
                        clampPan(true);
                        updateBadge();
                    }
                    lastTapTime = 0;
                    e.preventDefault();
                    return;
                }
                lastTapTime = now;

                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                startPanX = panX;
                startPanY = panY;
                doc.style.transition = 'none';
            }
        };

        const onTouchMove = (e) => {
            if (isPinching && e.touches.length === 2) {
                e.preventDefault();
                const currentDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                if (startDist <= 0) return;

                const ratio = currentDist / startDist;
                let newScale = startScale * ratio;
                newScale = Math.max(minScale, Math.min(maxScale, newScale));

                const hostRect = host.getBoundingClientRect();
                const currentMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const currentMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                const focalX = startMidX - hostRect.left;
                const focalY = startMidY - hostRect.top;

                panX = focalX - ((focalX - startPanX) * (newScale / startScale)) + (currentMidX - startMidX);
                panY = focalY - ((focalY - startPanY) * (newScale / startScale)) + (currentMidY - startMidY);
                scale = newScale;

                applyTransform(false);
                updateBadge();
            } else if (!isPinching && e.touches.length === 1 && isPanning) {
                const dx = e.touches[0].clientX - touchStartX;
                const dy = e.touches[0].clientY - touchStartY;

                e.preventDefault();
                panX = startPanX + dx;
                panY = startPanY + dy;
                applyTransform(false);
            }
        };

        const onTouchEnd = (e) => {
            if (isPinching && e.touches.length < 2) {
                isPinching = false;
                if (scale < fitScale) {
                    resetToFit(true);
                } else {
                    clampPan(true);
                    updateBadge();
                }
            } else if (e.touches.length === 0) {
                isPanning = false;
                if (scale < fitScale) {
                    resetToFit(true);
                } else {
                    clampPan(true);
                    updateBadge();
                }
            }
        };

        host.addEventListener('touchstart', onTouchStart, { passive: false });
        host.addEventListener('touchmove', onTouchMove, { passive: false });
        host.addEventListener('touchend', onTouchEnd, { passive: false });
        host.addEventListener('touchcancel', onTouchEnd, { passive: false });

        this._zoomEngineCleanup = () => {
            host.removeEventListener('touchstart', onTouchStart);
            host.removeEventListener('touchmove', onTouchMove);
            host.removeEventListener('touchend', onTouchEnd);
            host.removeEventListener('touchcancel', onTouchEnd);
            badge?.removeEventListener('click', onBadgeClick);
        };

        resetToFit(false);
        updateBadge(true);
    }

    // ==========================================
    // INVOICE PDF GENERATION & SHARING ENGINE
    // ==========================================
    getInvoiceFileName(voucher) {
        if (!voucher) return 'Invoice.pdf';

        // 1. Format YYYYMMDD from voucher.date or today
        let dateStr = '';
        if (voucher.date) {
            const cleanDate = String(voucher.date).replace(/[^0-9]/g, '');
            if (cleanDate.length >= 8) {
                dateStr = cleanDate.substring(0, 8);
            }
        }
        if (!dateStr || dateStr.length !== 8) {
            const d = new Date();
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            dateStr = `${yyyy}${mm}${dd}`;
        }

        // 2. Invoice number: replace slashes and filesystem-unsafe chars with '-'
        const rawInvNo = (voucher.voucherNo || 'INV').trim();
        const cleanInvNo = rawInvNo.replace(/[/\\?%*:|"<> ]/g, '-');

        // 3. Party name: look up partyName or find party by partyId
        let rawParty = (voucher.partyName || '').trim();
        if (!rawParty && voucher.partyId && this.parties) {
            const found = this.parties.find(p => p.id === voucher.partyId);
            if (found) rawParty = found.name;
        }
        if (!rawParty) rawParty = 'Customer';
        const cleanParty = rawParty.replace(/[/\\?%*:|"<> ]/g, '_').trim();

        return `${dateStr}_${cleanInvNo}_${cleanParty}.pdf`;
    }

    async generateInvoicePdfBlob() {
        const host = document.getElementById('invoice-preview-host');
        if (!host || !host.innerHTML.trim()) {
            throw new Error('Invoice preview is not ready');
        }
        const voucher = this.activeVoucherForPrint;
        if (!voucher) throw new Error('No active voucher selected');

        const filename = this.getInvoiceFileName(voucher);

        if (!window.html2pdf) {
            throw new Error('PDF generator engine not loaded. Please restart the app.');
        }

        // Target the rendered invoice print document
        const sourceDoc = host.querySelector('.print-document') || host;

        // Clone element into an isolated wrapper at top: 0, left: 0 with positive coordinates
        // Using opacity: 0.01 and pointer-events: none so html2canvas renders perfectly without layout clip
        const wrapper = document.createElement('div');
        wrapper.id = 'pdf-render-scratch-wrapper';
        wrapper.style.position = 'absolute';
        wrapper.style.top = '0';
        wrapper.style.left = '0';
        wrapper.style.width = '794px'; // Standard A4 width at 96 DPI
        wrapper.style.background = '#ffffff';
        wrapper.style.color = '#000000';
        wrapper.style.opacity = '0.01';
        wrapper.style.pointerEvents = 'none';
        wrapper.style.zIndex = '-9999';
        wrapper.innerHTML = sourceDoc.outerHTML;

        // Ensure cloned document takes exactly 794px width without any mobile zoom/transform
        const clonedDoc = wrapper.querySelector('.print-document') || wrapper.firstElementChild;
        if (clonedDoc) {
            clonedDoc.style.boxShadow = 'none';
            clonedDoc.style.margin = '0 auto';
            clonedDoc.style.maxWidth = '794px';
            clonedDoc.style.width = '794px';
            clonedDoc.style.minWidth = '794px';
            clonedDoc.style.transform = 'none';
            clonedDoc.style.webkitTransform = 'none';
        }

        document.body.appendChild(wrapper);

        try {
            const opt = {
                margin: [4, 4, 4, 4],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    width: 794,
                    windowWidth: 794,
                    backgroundColor: '#ffffff',
                    scrollX: 0,
                    scrollY: 0
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            const pdfBlob = await window.html2pdf().set(opt).from(clonedDoc || wrapper).outputPdf('blob');
            if (!pdfBlob || pdfBlob.size < 200) {
                throw new Error('Generated PDF is empty or corrupt');
            }
            return { blob: pdfBlob, filename };
        } finally {
            if (wrapper.parentNode) {
                wrapper.parentNode.removeChild(wrapper);
            }
        }
    }

    async downloadInvoicePdf() {
        if (!this.activeVoucherForPrint) return;
        const filename = this.getInvoiceFileName(this.activeVoucherForPrint);
        try {
            this.showToast('Generating Invoice PDF...', 'info');
            const { blob } = await this.generateInvoicePdfBlob();

            // 1. Android Native Downloader via BridgeActivity interface
            if (window.NativeDownloader && typeof window.NativeDownloader.saveBase64File === 'function') {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result.substring(reader.result.indexOf(',') + 1);
                    window.NativeDownloader.saveBase64File(base64, 'application/pdf', filename);
                };
                reader.readAsDataURL(blob);
                this.showToast(`Invoice PDF saved: ${filename}!`, 'success');
                return;
            }

            // 2. Capacitor Filesystem plugin
            if (window.Capacitor && window.Capacitor.isPluginAvailable('Filesystem')) {
                const Filesystem = window.Capacitor.Plugins.Filesystem;
                const base64Data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.substring(reader.result.indexOf(',') + 1));
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });

                let savedFile;
                try {
                    savedFile = await Filesystem.writeFile({
                        path: filename,
                        data: base64Data,
                        directory: 'DOCUMENTS'
                    });
                } catch (e) {
                    savedFile = await Filesystem.writeFile({
                        path: filename,
                        data: base64Data,
                        directory: 'CACHE'
                    });
                }

                if (window.Capacitor.isPluginAvailable('Share')) {
                    const Share = window.Capacitor.Plugins.Share;
                    Share.share({
                        title: `Invoice #${this.activeVoucherForPrint.voucherNo}`,
                        files: [savedFile.uri],
                        dialogTitle: 'Save / Open Invoice PDF'
                    }).catch(() => {});
                }
                this.showToast(`Invoice PDF saved: ${filename}!`, 'success');
                return;
            }

            // 3. Browser download fallback
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast(`Invoice PDF downloaded: ${filename}`, 'success');
        } catch (err) {
            console.error('PDF Download Error:', err);
            this.showToast('PDF generation error: ' + err.message, 'error');
        }
    }

    async shareInvoicePdf() {
        if (!this.activeVoucherForPrint) return;
        const voucher = this.activeVoucherForPrint;
        const companyName = this.company?.businessName || 'Business';
        const filename = this.getInvoiceFileName(voucher);
        const subject = `Invoice #${voucher.voucherNo}`;
        const shareText = `Please find attached Invoice #${voucher.voucherNo} from ${companyName}. Grand Total: ${InvoiceEngine.formatCurrency(voucher.grandTotal)}`;

        try {
            this.showToast('Generating Invoice PDF for sending...', 'info');
            const { blob } = await this.generateInvoicePdfBlob();

            // 1. Android Native Share via BridgeActivity interface (Direct Intent with FileProvider stream)
            if (window.NativeDownloader && typeof window.NativeDownloader.shareBase64File === 'function') {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result.substring(reader.result.indexOf(',') + 1);
                    window.NativeDownloader.shareBase64File(base64, 'application/pdf', filename, subject, shareText);
                };
                reader.readAsDataURL(blob);
                this.showToast('Opening Share menu with PDF attached...', 'success');
                return;
            }

            // 2. Android Native Share via Capacitor Plugins (Filesystem + Share)
            if (window.Capacitor && window.Capacitor.isPluginAvailable('Share') && window.Capacitor.isPluginAvailable('Filesystem')) {
                const Filesystem = window.Capacitor.Plugins.Filesystem;
                const Share = window.Capacitor.Plugins.Share;

                const base64Data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.substring(reader.result.indexOf(',') + 1));
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });

                const savedFile = await Filesystem.writeFile({
                    path: filename,
                    data: base64Data,
                    directory: 'CACHE'
                });

                Share.share({
                    title: subject,
                    text: shareText,
                    files: [savedFile.uri],
                    dialogTitle: 'Send Invoice PDF via'
                }).catch(err => {
                    console.warn('Share dismissed or cancelled:', err);
                });
                this.showToast('Opening Share menu with PDF attached...', 'success');
                return;
            }

            // 3. Web Share API with File object
            const file = new File([blob], filename, { type: 'application/pdf' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: subject,
                    text: shareText,
                    files: [file]
                });
                this.showToast('Invoice PDF shared successfully!', 'success');
                return;
            }

            // 4. Fallback: Download the PDF file directly and open WhatsApp conversation
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            const phone = voucher.partyPhone ? voucher.partyPhone.replace(/\D/g, '') : '';
            const encoded = InvoiceEngine.buildWhatsAppMessage(voucher, this.company);
            const waUrl = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
            window.open(waUrl, '_blank');
            this.showToast('PDF downloaded! Attach file in the opened WhatsApp chat.', 'info');

        } catch (err) {
            console.error('PDF Share Error:', err);
            this.showToast('Sharing error: ' + err.message, 'error');
        }
    }

    // ==========================================
    // TERMS & CONDITIONS MANAGEMENT
    // ==========================================
    openTermsModal() {
        const textarea = document.getElementById('terms-textarea');
        if (textarea) {
            textarea.value = (this.activeVoucherForPrint && this.activeVoucherForPrint.termsAndConditions !== undefined)
                ? this.activeVoucherForPrint.termsAndConditions
                : (this.company?.termsAndConditions || 
                    '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if payment not made within due date.\n3. All disputes subject to local jurisdiction.');
        }
        document.getElementById('terms-conditions-modal')?.classList.add('active');
    }

    async saveTermsModal() {
        const textarea = document.getElementById('terms-textarea');
        if (!textarea) return;
        const newTerms = textarea.value.trim();
        if (!this.company) this.company = {};
        this.company.termsAndConditions = newTerms;

        // Persist to IndexedDB
        await window.dbService.put('companies', this.company);

        // Sync with doc-settings modal textarea if present
        const docTerms = document.getElementById('doc-terms');
        if (docTerms) docTerms.value = newTerms;

        // Sync with voucher form if open
        const vformTerms = document.getElementById('vform-terms');
        if (vformTerms) vformTerms.value = newTerms;

        // Immediately update voucher and preview if print modal is currently open
        if (this.activeVoucherForPrint) {
            this.activeVoucherForPrint.termsAndConditions = newTerms;
            await window.dbService.put('vouchers', this.activeVoucherForPrint);
            const party = this.parties.find(p => p.id === this.activeVoucherForPrint.partyId);
            this.renderPrintDocument(this.activeVoucherForPrint, this.company, party);
        }

        document.getElementById('terms-conditions-modal')?.classList.remove('active');
        this.showToast('Terms & conditions saved successfully!', 'success');
    }

    applyTermsPreset(presetKey) {
        const textarea = document.getElementById('terms-textarea');
        if (!textarea) return;
        const presets = {
            standard: '1. Goods once sold will not be taken back or exchanged.\n2. Payment terms: 30 days net from invoice date.\n3. Interest @ 18% p.a. will be levied on overdue payments.\n4. All disputes are subject to local jurisdiction only.',
            international: '1. Goods sold under International Commercial Terms (Incoterms 2020).\n2. Wire transfer / remittance charges to be borne by remitter.\n3. Any discrepancies must be notified within 7 days of arrival.\n4. Payment terms: Clean documents against payment (D/P) or net 30 days.',
            services: '1. Invoices are payable upon receipt or milestone completion.\n2. Intellectual property transfers upon receipt of full settlement.\n3. Service warranty valid for 30 days from sign-off.\n4. All disputes subject to arbitration under local jurisdiction.',
            retail: '1. Goods once sold will not be returned.\n2. Exchange permitted within 7 days with original invoice copy.\n3. Warranty coverage as per manufacturer policy only.\n4. E. & O.E. (Errors and Omissions Excepted).'
        };
        if (presets[presetKey]) {
            textarea.value = presets[presetKey];
            this.showToast(`Applied ${presetKey} terms preset`, 'info');
        }
    }

    // ==========================================
    // INVOICE FOOTER MANAGEMENT
    // ==========================================
    openFooterModal() {
        const textarea = document.getElementById('footer-textarea');
        const defaultCheck = document.getElementById('footer-set-default');
        const currentFooter = this.activeVoucherForPrint
            ? (this.activeVoucherForPrint.footerText !== undefined ? this.activeVoucherForPrint.footerText : (this.company?.footerText || ''))
            : (this.company?.footerText || '');
        if (textarea) textarea.value = currentFooter;
        if (defaultCheck) defaultCheck.checked = false;
        document.getElementById('footer-modal')?.classList.add('active');
    }

    applyFooterPreset(presetKey) {
        const textarea = document.getElementById('footer-textarea');
        if (!textarea) return;
        const presets = {
            blank: '',
            thanks: 'Thank you for your business! We appreciate your partnership.',
            jurisdiction: 'All disputes are subject to local jurisdiction only.',
            computer: 'This is a computer generated invoice and requires no physical signature.',
            eoe: 'Errors and Omissions Excepted (E.&O.E.).'
        };
        if (presets[presetKey] !== undefined) {
            textarea.value = presets[presetKey];
            this.showToast(presets[presetKey] ? `Applied ${presetKey} footer preset` : 'Cleared footer text', 'info');
        }
    }

    async saveFooterModal() {
        const textarea = document.getElementById('footer-textarea');
        const defaultCheck = document.getElementById('footer-set-default');
        const newFooter = textarea ? textarea.value.trim() : '';

        // 1. Update active voucher if in print/preview mode
        if (this.activeVoucherForPrint) {
            this.activeVoucherForPrint.footerText = newFooter;
            await window.dbService.put('vouchers', this.activeVoucherForPrint);
            const party = this.parties.find(p => p.id === this.activeVoucherForPrint.partyId);
            this.renderPrintDocument(this.activeVoucherForPrint, this.company, party);
        }

        // 2. Set as company default if checked or if not editing specific voucher
        if (defaultCheck?.checked || !this.activeVoucherForPrint) {
            if (!this.company) this.company = {};
            this.company.footerText = newFooter;
            await window.dbService.put('companies', this.company);
        }

        // 3. Sync with voucher form if open
        const vformFooter = document.getElementById('vform-footer');
        if (vformFooter) vformFooter.value = newFooter;

        document.getElementById('footer-modal')?.classList.remove('active');
        this.showToast('Footer text updated successfully!', 'success');
    }

    // ==========================================
    // DIGITAL SIGNATURE SYSTEM
    // ==========================================
    initSignaturePad() {
        const canvas = document.getElementById('signature-canvas');
        if (!canvas) return;

        this.signaturePad = new BillFlowSignaturePad('signature-canvas', {
            penColor: '#1e3a8a',
            lineWidth: 3
        });

        // Tab switching (Draw vs Type vs Upload)
        document.querySelectorAll('.sig-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sig-tab-btn').forEach(b => {
                    b.classList.remove('btn-primary', 'active');
                    b.classList.add('btn-secondary');
                });
                btn.classList.add('btn-primary', 'active');
                btn.classList.remove('btn-secondary');

                const mode = btn.dataset.sigMode;
                document.getElementById('sig-mode-draw-container').style.display = mode === 'draw' ? 'block' : 'none';
                document.getElementById('sig-mode-type-container').style.display = mode === 'type' ? 'block' : 'none';
                document.getElementById('sig-mode-upload-container').style.display = mode === 'upload' ? 'block' : 'none';
                this.activeSigMode = mode;

                if (mode === 'draw') {
                    setTimeout(() => this.signaturePad.initCanvas(), 100);
                }
            });
        });

        // Pen color dots
        document.querySelectorAll('.sig-color-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                document.querySelectorAll('.sig-color-dot').forEach(d => {
                    d.style.border = '1px solid #475569';
                    d.classList.remove('active');
                });
                dot.style.border = '2px solid #fff';
                dot.classList.add('active');
                const color = dot.dataset.color;
                this.signaturePad.setPenColor(color);
                const preview = document.getElementById('sig-cursive-preview');
                if (preview) preview.style.color = color;
            });
        });

        // Type Name input live preview
        const typeInput = document.getElementById('sig-type-input');
        if (typeInput) {
            typeInput.addEventListener('input', (e) => {
                const text = e.target.value.trim();
                const preview = document.getElementById('sig-cursive-preview');
                if (preview) {
                    preview.textContent = text || '(Type name above)';
                }
            });
        }

        // Upload file input
        const uploadInput = document.getElementById('sig-upload-input');
        if (uploadInput) {
            uploadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (evt) => {
                    await this.signaturePad.loadSignatureImage(evt.target.result);
                };
                reader.readAsDataURL(file);
            });
        }

        // Clear button
        document.getElementById('btn-clear-sig')?.addEventListener('click', () => {
            this.signaturePad.clear();
            const typeIn = document.getElementById('sig-type-input');
            if (typeIn) typeIn.value = '';
            const preview = document.getElementById('sig-cursive-preview');
            if (preview) preview.textContent = '(Type name above)';
        });

        // Save & Apply Signature button
        document.getElementById('btn-save-sig')?.addEventListener('click', async () => {
            await this.applySignature();
        });
    }

    openSignatureModal(target = 'company') {
        this.signatureTarget = target;
        const modal = document.getElementById('signature-modal');
        if (!modal) return;

        modal.classList.add('active');
        document.getElementById('tab-sig-draw')?.click();

        setTimeout(() => {
            this.signaturePad.initCanvas();
            const currentSig = this.company?.signatureUrl;
            if (currentSig && this.signaturePad.isEmpty()) {
                this.signaturePad.loadSignatureImage(currentSig);
            }
        }, 150);
    }

    async applySignature() {
        let sigDataUrl = '';

        if (this.activeSigMode === 'type') {
            const name = document.getElementById('sig-type-input')?.value.trim();
            if (!name) {
                alert('Please type a name for your signature.');
                return;
            }
            this.signaturePad.renderTypedSignature(name);
            sigDataUrl = this.signaturePad.toDataURL();
        } else {
            if (this.signaturePad.isEmpty()) {
                alert('Please draw, type, or upload a signature before applying.');
                return;
            }
            sigDataUrl = this.signaturePad.toDataURL();
        }

        if (!this.company) this.company = { id: 'comp_primary' };
        this.company.signatureUrl = sigDataUrl;
        await window.dbService.put('companies', this.company);

        if (this.activeVoucherForPrint) {
            this.activeVoucherForPrint.signatureUrl = sigDataUrl;
            await window.dbService.put('vouchers', this.activeVoucherForPrint);
            const party = this.parties.find(p => p.id === this.activeVoucherForPrint.partyId);
            this.renderPrintDocument(this.activeVoucherForPrint, this.company, party);
        }

        document.getElementById('signature-modal')?.classList.remove('active');
        this.showToast('Digital Signature saved & applied successfully!', 'success');
    }

    // Reset All Data to Zero
    async resetAllDataToZeroPrompt() {
        const conf = confirm(
            '⚠️ RESET ALL DATA TO ZERO?\n\n' +
            'This will delete all invoices, inventory products, and customer/vendor parties.\n' +
            'Your app will be completely fresh and reset to 0.\n\n' +
            'Proceed?'
        );
        if (!conf) return;

        await window.dbService.resetAllDataToZero();
        await this.loadAllState();
        this.switchScreen('screen-home');
        this.renderHomeScreen();
        this.renderBillsScreen();
        this.renderProductsScreen();
        this.renderPartiesScreen();
        this.showToast('✓ App has been completely reset to 0! Clean fresh start ready.', 'info');
    }

    // ==========================================
    // ITEM & PARTY CRUD MODALS
    // ==========================================
    openItemModal(itemId = null) {
        const modal = document.getElementById('item-modal');
        const form = document.getElementById('item-form');
        if (form) form.reset();

        const godownSelect = document.getElementById('iform-godown');
        if (godownSelect) {
            godownSelect.innerHTML = '';
            this.godowns.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = `${g.name} (${g.location})`;
                godownSelect.appendChild(opt);
            });
        }

        const delBtn = document.getElementById('btn-delete-item');

        if (itemId) {
            const itm = this.items.find(i => i.id === itemId);
            if (itm) {
                document.getElementById('iform-id').value = itm.id;
                document.getElementById('iform-name').value = itm.name;
                document.getElementById('iform-sku').value = itm.sku || '';
                document.getElementById('iform-hsn').value = itm.hsn || '';
                document.getElementById('iform-category').value = itm.category || '';
                document.getElementById('iform-tax-rate').value = itm.taxRate !== undefined ? itm.taxRate : 18;
                document.getElementById('iform-unit').value = itm.unit || 'Pcs';
                document.getElementById('iform-wholesale-price').value = itm.wholesalePrice || 0;
                document.getElementById('iform-retail-price').value = itm.retailPrice || 0;
                document.getElementById('iform-opening-stock').value = itm.currentStock || 0;
                document.getElementById('iform-barcode').value = itm.barcode || itm.sku || '';
                document.getElementById('iform-min-stock').value = itm.minStock !== undefined ? itm.minStock : (itm.minStockAlert || 5);
                document.getElementById('item-modal-title').textContent = 'Edit Product';

                if (delBtn) {
                    delBtn.style.display = 'inline-block';
                    delBtn.onclick = () => this.deleteItem(itemId);
                }
            }
        } else {
            document.getElementById('iform-id').value = '';
            document.getElementById('iform-barcode').value = '';
            document.getElementById('iform-min-stock').value = '5';
            document.getElementById('item-modal-title').textContent = 'Add Product';
            if (delBtn) delBtn.style.display = 'none';
        }

        modal.classList.add('active');
        setTimeout(() => document.getElementById('iform-name')?.focus(), 150);
    }

    async saveItem(event) {
        if (event && event.preventDefault) event.preventDefault();
        const nameInput = document.getElementById('iform-name');
        const name = nameInput ? nameInput.value.trim() : '';
        if (!name) {
            alert('Please enter a product name.');
            nameInput?.focus();
            return;
        }

        const id = document.getElementById('iform-id')?.value || ('item_' + Date.now());
        const stockQty = Number(document.getElementById('iform-opening-stock')?.value) || 0;
        const wholesalePrice = Number(document.getElementById('iform-wholesale-price')?.value) || 0;
        const retailPrice = Number(document.getElementById('iform-retail-price')?.value) || wholesalePrice;
        const taxRate = Number(document.getElementById('iform-tax-rate')?.value) || 18;
        const minStockVal = Number(document.getElementById('iform-min-stock')?.value) || 5;

        const itemData = {
            id,
            name,
            sku: document.getElementById('iform-sku')?.value?.trim() || ('SKU-' + Math.floor(100 + Math.random() * 900)),
            hsn: document.getElementById('iform-hsn')?.value?.trim() || '8544',
            barcode: document.getElementById('iform-barcode')?.value?.trim() || '',
            category: document.getElementById('iform-category')?.value?.trim() || 'General',
            taxRate,
            unit: document.getElementById('iform-unit')?.value || 'Pcs',
            wholesalePrice,
            retailPrice,
            currentStock: stockQty,
            minStock: minStockVal,
            minStockAlert: minStockVal,
            godownId: document.getElementById('iform-godown')?.value || 'godown_primary'
        };

        await window.dbService.put('items', itemData);
        document.getElementById('item-modal')?.classList.remove('active');
        await this.loadAllState();
        this.renderProductsScreen();
        this.showToast(`Product "${itemData.name}" saved successfully!`, 'success');
    }

    async deleteItem(itemId) {
        const itm = this.items.find(i => i.id === itemId);
        if (!itm) return;
        if (!confirm(`Are you sure you want to delete product "${itm.name}"?`)) return;

        await window.dbService.delete('items', itemId);
        document.getElementById('item-modal')?.classList.remove('active');
        await this.loadAllState();
        this.renderProductsScreen();
        this.showToast(`Product "${itm.name}" deleted.`, 'info');
    }

    syncPartyAddressFields() {
        const billingEl = document.getElementById('pform-billing-address') || document.getElementById('pform-address');
        const deliveryEl = document.getElementById('pform-delivery-address');
        const sameCheck = document.getElementById('pform-same-address');
        const legacyEl = document.getElementById('pform-address');

        if (!billingEl || !deliveryEl || !sameCheck) return;

        if (legacyEl && legacyEl !== billingEl) {
            legacyEl.value = billingEl.value;
        }

        if (sameCheck.checked) {
            deliveryEl.value = billingEl.value;
            deliveryEl.readOnly = true;
            deliveryEl.style.backgroundColor = 'var(--bg-card-sub, #f8fafc)';
            deliveryEl.style.color = 'var(--text-sub, #64748b)';
            deliveryEl.style.cursor = 'not-allowed';
        } else {
            deliveryEl.readOnly = false;
            deliveryEl.style.backgroundColor = '';
            deliveryEl.style.color = '';
            deliveryEl.style.cursor = '';
        }
    }

    openPartyModal(partyId = null) {
        const modal = document.getElementById('party-modal');
        const form = document.getElementById('party-form');
        if (form) form.reset();

        const delBtn = document.getElementById('btn-delete-party');
        const billingEl = document.getElementById('pform-billing-address') || document.getElementById('pform-address');
        const deliveryEl = document.getElementById('pform-delivery-address');
        const sameCheck = document.getElementById('pform-same-address');
        const stateEl = document.getElementById('pform-state');
        const cityEl = document.getElementById('pform-city');

        if (partyId) {
            const p = this.parties.find(x => x.id === partyId);
            if (p) {
                document.getElementById('pform-id').value = p.id;
                document.getElementById('pform-type').value = p.type || 'customer';
                document.getElementById('pform-name').value = p.name;
                document.getElementById('pform-phone').value = p.phone || '';
                document.getElementById('pform-gstin').value = p.gstin || '';
                if (stateEl) stateEl.value = p.state || '';
                if (cityEl) cityEl.value = p.city || '';

                const billAddr = p.billingAddress || '';
                const delivAddr = p.deliveryAddress || p.shippingAddress || '';

                if (billingEl) billingEl.value = billAddr;

                const isSame = p.sameAddressAsBilling !== undefined
                    ? !!p.sameAddressAsBilling
                    : (!delivAddr || delivAddr === billAddr);

                if (sameCheck) sameCheck.checked = isSame;
                if (deliveryEl) deliveryEl.value = isSame ? billAddr : delivAddr;
                this.syncPartyAddressFields();

                document.getElementById('party-modal-title').textContent = 'Edit Party';

                const ledgerBtn = document.getElementById('btn-party-view-ledger');
                if (ledgerBtn) {
                    ledgerBtn.style.display = 'inline-block';
                    ledgerBtn.onclick = () => {
                        modal.classList.remove('active');
                        this.openPartyLedgerModal(partyId);
                    };
                }

                if (delBtn) {
                    delBtn.style.display = 'inline-block';
                    delBtn.onclick = () => this.deleteParty(partyId);
                }
            }
        } else {
            document.getElementById('pform-id').value = '';
            const isVendor = this.currentPartyTab === 'vendors';
            document.getElementById('pform-type').value = isVendor ? 'supplier' : 'customer';
            document.getElementById('party-modal-title').textContent = isVendor ? 'Add New Vendor' : 'Add New Customer';

            const ledgerBtn = document.getElementById('btn-party-view-ledger');
            if (ledgerBtn) ledgerBtn.style.display = 'none';

            if (billingEl) billingEl.value = '';
            if (deliveryEl) deliveryEl.value = '';
            if (sameCheck) sameCheck.checked = true;
            if (stateEl) stateEl.value = '';
            if (cityEl) cityEl.value = '';
            this.syncPartyAddressFields();

            if (delBtn) delBtn.style.display = 'none';
        }

        modal.classList.add('active');
        setTimeout(() => document.getElementById('pform-name')?.focus(), 150);
    }

    async saveParty(event) {
        if (event && event.preventDefault) event.preventDefault();
        const nameInput = document.getElementById('pform-name');
        const name = nameInput ? nameInput.value.trim() : '';
        if (!name) {
            alert('Please enter party name.');
            nameInput?.focus();
            return;
        }

        const id = document.getElementById('pform-id')?.value || ('party_' + Date.now());
        const existing = this.parties.find(p => p.id === id);

        const billingEl = document.getElementById('pform-billing-address') || document.getElementById('pform-address');
        const deliveryEl = document.getElementById('pform-delivery-address');
        const sameCheck = document.getElementById('pform-same-address');

        const billingAddress = billingEl ? billingEl.value.trim() : '';
        const sameAddressAsBilling = sameCheck ? sameCheck.checked : false;
        const deliveryAddress = sameAddressAsBilling
            ? billingAddress
            : (deliveryEl ? deliveryEl.value.trim() : billingAddress);

        const explicitState = document.getElementById('pform-state')?.value?.trim() || '';
        const explicitCity = document.getElementById('pform-city')?.value?.trim() || '';
        const gstin = document.getElementById('pform-gstin')?.value?.trim() || '';

        // Save ONLY what the user explicitly entered - never default to Maharashtra or guess state
        const partyData = {
            id,
            type: document.getElementById('pform-type')?.value || 'customer',
            name,
            phone: document.getElementById('pform-phone')?.value?.trim() || '',
            gstin,
            state: explicitState,
            stateCode: '',
            city: explicitCity,
            address: billingAddress,
            billingAddress: billingAddress,
            deliveryAddress: deliveryAddress,
            shippingAddress: deliveryAddress,
            sameAddressAsBilling: sameAddressAsBilling,
            currentBalance: existing ? (existing.currentBalance || 0) : 0
        };

        await window.dbService.put('parties', partyData);
        document.getElementById('party-modal')?.classList.remove('active');
        await this.loadAllState();
        this.renderPartiesScreen();

        // Refresh party dropdown in voucher modal if active
        const partySelect = document.getElementById('vform-party-select');
        if (partySelect) {
            partySelect.innerHTML = '<option value="">-- Choose Party --</option><option value="cash_sale">⚡ Cash Sale / Walk-in Customer</option>';
            this.parties.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                const loc = p.city || p.state || (p.billingAddress ? p.billingAddress.slice(0, 20) : '');
                opt.textContent = `${p.name}${p.phone ? ` (${p.phone})` : (loc ? ` (${loc})` : '')}`;
                if (p.id === partyData.id) opt.selected = true;
                partySelect.appendChild(opt);
            });
            this.onVoucherPartyChange();
        }

        this.showToast(`Party "${partyData.name}" saved successfully!`, 'success');
    }

    async deleteParty(partyId) {
        const p = this.parties.find(x => x.id === partyId);
        if (!p) return;
        if (!confirm(`Are you sure you want to delete "${p.name}"?`)) return;

        await window.dbService.delete('parties', partyId);
        document.getElementById('party-modal')?.classList.remove('active');
        await this.loadAllState();
        this.renderPartiesScreen();
        this.showToast(`Party "${p.name}" deleted.`, 'info');
    }

    openCompanyModal() {
        if (!this.company) this.company = { id: 'comp_primary' };
        this.pendingCompanyLogo = this.company.logoUrl || '';

        const imgPreview = document.getElementById('company-logo-img-preview');
        const placeholder = document.getElementById('company-logo-placeholder-icon');
        const removeBtn = document.getElementById('btn-remove-company-logo');
        const fileInput = document.getElementById('set-company-logo-file');

        if (fileInput) fileInput.value = '';

        if (this.pendingCompanyLogo) {
            if (imgPreview) {
                imgPreview.src = this.pendingCompanyLogo;
                imgPreview.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';
            if (removeBtn) removeBtn.style.display = 'inline-flex';
        } else {
            if (imgPreview) {
                imgPreview.src = '';
                imgPreview.style.display = 'none';
            }
            if (placeholder) placeholder.style.display = 'block';
            if (removeBtn) removeBtn.style.display = 'none';
        }

        document.getElementById('set-business-name').value = this.company.businessName || '';
        document.getElementById('set-gstin').value = this.company.gstin || '';
        document.getElementById('set-state').value = this.company.state || '';
        document.getElementById('set-phone').value = this.company.phone || '';
        document.getElementById('set-email').value = this.company.email || '';
        document.getElementById('set-address').value = this.company.address || '';

        document.getElementById('company-modal')?.classList.add('active');
    }

    async saveCompanyProfile(event) {
        if (event && event.preventDefault) event.preventDefault();
        const bizInput = document.getElementById('set-business-name');
        const bName = bizInput ? bizInput.value.trim() : '';
        if (!bName) {
            alert('Please enter your business or company name.');
            bizInput?.focus();
            return;
        }

        const logoToSave = (this.pendingCompanyLogo !== null && this.pendingCompanyLogo !== undefined)
            ? this.pendingCompanyLogo
            : (this.company.logoUrl || '');

        this.company = {
            ...this.company,
            id: 'comp_primary',
            businessName: bName,
            logoUrl: logoToSave,
            gstin: document.getElementById('set-gstin')?.value?.trim() || '',
            state: document.getElementById('set-state')?.value?.trim() || '',
            phone: document.getElementById('set-phone')?.value?.trim() || '',
            email: document.getElementById('set-email')?.value?.trim() || '',
            address: document.getElementById('set-address')?.value?.trim() || ''
        };

        await window.dbService.put('companies', this.company);
        document.getElementById('company-modal')?.classList.remove('active');
        this.showToast('Company settings saved successfully!', 'success');
        await this.loadAllState();

        // If print modal is currently open with a voucher, re-render it to show updated logo
        if (this.activeVoucherForPrint && document.getElementById('print-modal')?.classList.contains('active')) {
            const party = this.parties.find(p => p.id === this.activeVoucherForPrint.partyId);
            this.renderPrintDocument(this.activeVoucherForPrint, this.company, party);
        }
    }

    // ==========================================
    // DOCUMENT SETTINGS MODAL
    // ==========================================
    openDocSettingsModal() {
        const modal = document.getElementById('doc-settings-modal');
        if (!modal) return;
        document.getElementById('doc-inv-prefix').value = this.company?.invoicePrefix || 'INV-26/';
        document.getElementById('doc-est-prefix').value = this.company?.estimatePrefix || 'EST-26/';
        document.getElementById('doc-dc-prefix').value = this.company?.dcPrefix || 'DC-26/';
        document.getElementById('doc-po-prefix').value = this.company?.poPrefix || 'PUR-26/';
        document.getElementById('doc-terms').value = this.company?.termsAndConditions || '1. Goods once sold will not be taken back.\n2. Payment terms as agreed.\n3. E.&O.E.';
        document.getElementById('doc-footer').value = this.company?.footerText || '';
        document.getElementById('doc-sig-title').value = this.company?.signatureTitle || 'Authorised Signatory';
        modal.classList.add('active');
    }

    async saveDocSettings(event) {
        if (event && event.preventDefault) event.preventDefault();
        if (!this.company) this.company = { id: 'comp_primary' };
        this.company.invoicePrefix = document.getElementById('doc-inv-prefix')?.value?.trim() || 'INV-26/';
        this.company.estimatePrefix = document.getElementById('doc-est-prefix')?.value?.trim() || 'EST-26/';
        this.company.dcPrefix = document.getElementById('doc-dc-prefix')?.value?.trim() || 'DC-26/';
        this.company.poPrefix = document.getElementById('doc-po-prefix')?.value?.trim() || 'PUR-26/';
        this.company.termsAndConditions = document.getElementById('doc-terms')?.value?.trim();
        this.company.footerText = document.getElementById('doc-footer')?.value?.trim() || '';
        this.company.signatureTitle = document.getElementById('doc-sig-title')?.value?.trim() || 'Authorised Signatory';

        await window.dbService.put('companies', this.company);
        document.getElementById('doc-settings-modal')?.classList.remove('active');
        this.showToast('Document settings saved successfully!', 'success');
    }

    // ==========================================
    // BUSINESS INSIGHTS MODAL (100% Offline)
    // ==========================================
    openInsightsModal() {
        const modal = document.getElementById('insights-modal');
        if (!modal) return;

        let totalSales = 0;
        let totalPurchases = 0;
        let totalDues = 0;
        let stockValuation = 0;

        for (const v of this.vouchers) {
            if (v.voucherType === 'sales_invoice') {
                totalSales += (v.grandTotal || 0);
                totalDues += (v.balanceDue || 0);
            } else if (v.voucherType === 'purchase_invoice') {
                totalPurchases += (v.grandTotal || 0);
            }
        }

        for (const itm of this.items) {
            const qty = itm.currentStock || 0;
            const rate = itm.wholesalePrice || itm.retailPrice || 0;
            stockValuation += (qty * rate);
        }

        const sEl = document.getElementById('insight-sales-val');
        const pEl = document.getElementById('insight-purchases-val');
        const dEl = document.getElementById('insight-due-val');
        const stEl = document.getElementById('insight-stock-val');

        if (sEl) sEl.textContent = InvoiceEngine.formatCurrency(totalSales);
        if (pEl) pEl.textContent = InvoiceEngine.formatCurrency(totalPurchases);
        if (dEl) dEl.textContent = InvoiceEngine.formatCurrency(totalDues);
        if (stEl) stEl.textContent = InvoiceEngine.formatCurrency(stockValuation);

        const vCnt = document.getElementById('insight-vouchers-count');
        const iCnt = document.getElementById('insight-items-count');
        const pCnt = document.getElementById('insight-parties-count');

        if (vCnt) vCnt.textContent = this.vouchers.length;
        if (iCnt) iCnt.textContent = this.items.length;
        if (pCnt) pCnt.textContent = this.parties.length;

        modal.classList.add('active');
    }

    // ==========================================
    // E-WAY BILL / E-INVOICE MODAL (100% Offline)
    // ==========================================
    openEwayModal() {
        const modal = document.getElementById('eway-modal');
        if (!modal) return;
        const select = document.getElementById('eway-voucher-select');
        if (select) {
            select.innerHTML = '<option value="">-- Choose Invoice --</option>';
            this.vouchers.filter(v => v.voucherType === 'sales_invoice').forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.id;
                opt.textContent = `#${v.voucherNo} - ${v.partyName} (${InvoiceEngine.formatCurrency(v.grandTotal)})`;
                select.appendChild(opt);
            });
        }
        modal.classList.add('active');
    }

    generateEwaySlip() {
        const vId = document.getElementById('eway-voucher-select')?.value;
        const v = this.vouchers.find(x => x.id === vId);
        if (!v) {
            alert('Please select an invoice first.');
            return;
        }
        const vehicleNo = document.getElementById('eway-vehicle-no')?.value?.trim() || 'MH-12-TR-0001';
        const dist = document.getElementById('eway-distance')?.value || '50';

        document.getElementById('eway-modal')?.classList.remove('active');
        this.showToast(`✓ E-Way Slip generated for #${v.voucherNo} (${vehicleNo}, ${dist} KM)!`, 'success');
        this.openPrintModal(v.id);
    }

    // ==========================================
    // UI SEARCH & FILTER CONTROLS
    // ==========================================
    toggleProductSearch() {
        const bar = document.getElementById('products-search-bar');
        if (!bar) return;
        const isHidden = bar.style.display === 'none' || !bar.style.display;
        bar.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) {
            document.getElementById('products-search-input')?.focus();
        } else {
            document.getElementById('products-search-input').value = '';
            this.renderProductsScreen();
        }
    }

    togglePartySearch() {
        const bar = document.getElementById('parties-search-bar');
        if (!bar) return;
        const isHidden = bar.style.display === 'none' || !bar.style.display;
        bar.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) {
            document.getElementById('parties-search-input')?.focus();
        } else {
            document.getElementById('parties-search-input').value = '';
            this.renderPartiesScreen();
        }
    }

    cycleProductSort() {
        const modes = ['default', 'name_asc', 'price_desc', 'price_asc', 'stock_desc'];
        const labels = {
            default: 'Default',
            name_asc: 'Name (A-Z)',
            price_desc: 'Price (High-Low)',
            price_asc: 'Price (Low-High)',
            stock_desc: 'Stock (High-Low)'
        };
        const curIdx = modes.indexOf(this.productSortMode);
        this.productSortMode = modes[(curIdx + 1) % modes.length];
        const lbl = document.getElementById('prod-sort-label');
        if (lbl) lbl.textContent = labels[this.productSortMode];
        this.renderProductsScreen();
        this.showToast(`Products sorted by: ${labels[this.productSortMode]}`, 'info');
    }

    cycleProductFilter() {
        this.productFilterMode = this.productFilterMode === 'all' ? 'low_stock' : 'all';
        const lbl = document.getElementById('prod-filter-label');
        if (lbl) lbl.textContent = this.productFilterMode === 'low_stock' ? 'Low Stock (<=10)' : 'Filter';
        this.renderProductsScreen();
        this.showToast(`Products filtered: ${this.productFilterMode === 'low_stock' ? 'Low Stock Only' : 'All Products'}`, 'info');
    }

    cyclePartySort() {
        const modes = ['default', 'name_asc', 'dues_desc'];
        const labels = {
            default: 'Default',
            name_asc: 'Name (A-Z)',
            dues_desc: 'Due Balance'
        };
        const curIdx = modes.indexOf(this.partySortMode);
        this.partySortMode = modes[(curIdx + 1) % modes.length];
        const lbl = document.getElementById('party-sort-label');
        if (lbl) lbl.textContent = labels[this.partySortMode];
        this.renderPartiesScreen();
        this.showToast(`Parties sorted by: ${labels[this.partySortMode]}`, 'info');
    }

    cyclePartyFilter() {
        const modes = ['all', 'has_dues', 'has_payables'];
        const labels = {
            all: 'Filter',
            has_dues: 'Receivables Only',
            has_payables: 'Payables Only'
        };
        const curIdx = modes.indexOf(this.partyFilterMode);
        this.partyFilterMode = modes[(curIdx + 1) % modes.length];
        const lbl = document.getElementById('party-filter-label');
        if (lbl) lbl.textContent = labels[this.partyFilterMode];
        this.renderPartiesScreen();
        this.showToast(`Parties filtered: ${labels[this.partyFilterMode]}`, 'info');
    }

    filterPartiesCollect() {
        this.partyFilterMode = this.partyFilterMode === 'has_dues' ? 'all' : 'has_dues';
        const lbl = document.getElementById('party-filter-label');
        if (lbl) lbl.textContent = this.partyFilterMode === 'has_dues' ? 'You Collect' : 'Filter';
        this.renderPartiesScreen();
        this.showToast(this.partyFilterMode === 'has_dues' ? 'Filtered parties with dues' : 'Showing all parties', 'info');
    }

    filterPartiesPay() {
        this.partyFilterMode = this.partyFilterMode === 'has_payables' ? 'all' : 'has_payables';
        const lbl = document.getElementById('party-filter-label');
        if (lbl) lbl.textContent = this.partyFilterMode === 'has_payables' ? 'You Pay' : 'Filter';
        this.renderPartiesScreen();
        this.showToast(this.partyFilterMode === 'has_payables' ? 'Filtered vendor payables' : 'Showing all parties', 'info');
    }

    cycleDateFilter() {
        const modes = ['year', 'month', 'today', 'all'];
        const labels = {
            year: 'This Year',
            month: 'This Month',
            today: 'Today',
            all: 'All Time'
        };
        const curIdx = modes.indexOf(this.currentDateFilter);
        this.currentDateFilter = modes[(curIdx + 1) % modes.length];

        const dateSpans = document.querySelectorAll('.dropdown-filter-btn span');
        dateSpans.forEach(s => s.textContent = labels[this.currentDateFilter]);
        this.renderBillsScreen();
        this.showToast(`Date filter: ${labels[this.currentDateFilter]}`, 'info');
    }

    showPreferencesInfo() {
        alert(
            '⚙️ APP & OFFLINE PREFERENCES\n\n' +
            '• Storage: 100% Offline IndexedDB / SQLite\n' +
            '• Privacy: Complete. Zero data sent to internet.\n' +
            '• Currency: ₹ Indian Rupee (INR)\n' +
            '• Printer Support: A4 GST, Thermal 80mm & 58mm\n' +
            '• App Version: v4.0.0 (Native Offline Build)'
        );
    }

    openTemplatesSelector() {
        if (this.vouchers.length > 0) {
            this.openPrintModal(this.vouchers[0].id);
        } else {
            this.showToast('Create an invoice first to preview templates.', 'info');
            this.openVoucherModal('sales_invoice');
        }
    }

    applyTheme(theme) {
        const body = document.body;
        body.setAttribute('data-theme', theme);
        localStorage.setItem('billflow_theme', theme);

        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.setAttribute('content', theme === 'light' ? '#faf8f2' : '#121418');
        }

        const quickIcon = document.getElementById('quick-theme-icon');
        if (quickIcon) quickIcon.textContent = theme === 'light' ? '☀️' : '🌙';

        const quickIconMore = document.querySelector('.quick-theme-icon-more');
        if (quickIconMore) quickIconMore.textContent = theme === 'light' ? '☀️' : '🌙';

        const menuText = document.getElementById('menu-theme-text');
        if (menuText) {
            menuText.textContent = theme === 'light' ? 'App Theme: Light (Cream & Green)' : 'App Theme: Dark Mode';
        }

        const menuBadge = document.getElementById('menu-theme-badge');
        if (menuBadge) {
            menuBadge.textContent = theme === 'light' ? 'Cream & Green' : 'Dark';
            menuBadge.style.background = theme === 'light' ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)';
            menuBadge.style.color = '#10b981';
        }
    }

    async toggleTheme() {
        const current = document.body.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        this.applyTheme(next);
        await window.dbService.put('settings', { key: 'theme', value: next });
        this.showToast(`Switched to ${next === 'light' ? 'Cream & Green Light' : 'Dark'} Theme`, 'info');
    }

    // ==========================================
    // OFFLINE BACKUP & RESTORE DATA
    // ==========================================
    openBackupRestoreModal() {
        const statsEl = document.getElementById('backup-stats-summary');
        if (statsEl) {
            const compName = this.company?.businessName || '1 Business';
            statsEl.textContent = `🏢 ${compName}  •  👥 ${this.parties.length} Parties  •  📦 ${this.items.length} Products  •  📄 ${this.vouchers.length} Invoices`;
        }
        const pBox = document.getElementById('restore-preview-box');
        if (pBox) pBox.style.display = 'none';
        this.pendingRestoreData = null;
        document.getElementById('backup-restore-modal')?.classList.add('active');
    }

    async exportBackup() {
        try {
            const jsonStr = await window.dbService.exportBackup();
            const fileName = `BillFlow_Offline_Backup_${new Date().toISOString().split('T')[0]}.json`;
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast('Offline JSON backup exported successfully!', 'success');
        } catch (err) {
            console.error('Backup error:', err);
            alert('Failed to export backup: ' + err.message);
        }
    }

    async shareBackup() {
        try {
            const jsonStr = await window.dbService.exportBackup();
            const fileName = `BillFlow_Offline_Backup_${new Date().toISOString().split('T')[0]}.json`;
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const file = new File([blob], fileName, { type: 'application/json' });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'BillFlow Database Backup',
                    text: 'Offline business data backup from BillFlow',
                    files: [file]
                });
                this.showToast('Backup shared successfully!', 'success');
            } else {
                this.exportBackup();
            }
        } catch (err) {
            this.exportBackup();
        }
    }

    handleRestoreFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.version || !data.companies) {
                    throw new Error('Invalid backup file structure.');
                }
                this.pendingRestoreData = e.target.result;
                const pBox = document.getElementById('restore-preview-box');
                const pDetails = document.getElementById('restore-preview-details');
                if (pBox && pDetails) {
                    const comp = (data.companies && data.companies[0]) ? data.companies[0].businessName : 'Company Profile';
                    const expDate = data.exportDate ? new Date(data.exportDate).toLocaleString('en-IN') : 'Recent';
                    pDetails.innerHTML = `
                        <strong>File:</strong> ${file.name}<br/>
                        <strong>Backup Date:</strong> ${expDate}<br/>
                        <strong>Contents:</strong> ${comp} • ${(data.parties || []).length} Parties • ${(data.items || []).length} Products • ${(data.vouchers || []).length} Invoices
                    `;
                    pBox.style.display = 'block';
                }
            } catch (err) {
                alert('Invalid backup file: ' + err.message);
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    }

    async confirmRestoreData() {
        if (!this.pendingRestoreData) {
            alert('Please select a backup file first.');
            return;
        }
        if (!confirm('⚠️ CONFIRM RESTORE?\n\nThis will restore all records from the selected backup file. Any current records on this device will be replaced with the backup data.\n\nDo you want to proceed?')) {
            return;
        }

        try {
            await window.dbService.restoreBackup(this.pendingRestoreData);
            await this.loadAllState();
            this.renderHomeScreen();
            this.renderBillsScreen();
            this.renderProductsScreen();
            this.renderPartiesScreen();
            document.getElementById('backup-restore-modal')?.classList.remove('active');
            this.pendingRestoreData = null;
            this.showToast('✅ Database restored successfully! All data loaded.', 'success');
        } catch (err) {
            alert('Restore failed: ' + err.message);
        }
    }

    // ==========================================
    // 1-CLICK DOCUMENT CONVERSION (Offline)
    // ==========================================
    convertVoucher(voucherId, targetType = 'sales_invoice') {
        const source = this.vouchers.find(v => v.id === voucherId);
        if (!source) {
            this.showToast('Source voucher not found.', 'error');
            return;
        }

        let prefix = 'INV-26/';
        if (targetType === 'estimate') prefix = 'EST-26/';
        else if (targetType === 'delivery_challan') prefix = 'DC-26/';
        else if (targetType === 'credit_note') prefix = 'CN-26/';
        else if (targetType === 'debit_note') prefix = 'DN-26/';

        const newVoucherNo = InvoiceEngine.generateNextVoucherNo(this.vouchers, prefix);
        const cloned = {
            ...JSON.parse(JSON.stringify(source)),
            id: 'vch_' + Date.now(),
            voucherNo: newVoucherNo,
            voucherType: targetType,
            date: new Date().toISOString().split('T')[0],
            paymentStatus: targetType === 'sales_invoice' ? 'unpaid' : 'paid',
            paidAmount: 0,
            balanceDue: source.grandTotal
        };

        const typeLabel = targetType === 'sales_invoice' ? 'Tax Invoice' :
            (targetType === 'delivery_challan' ? 'Delivery Challan' : 'Quotation');

        this.openVoucherModal(targetType, cloned);
        this.showToast(`Converted to ${typeLabel}! Review details and tap Save.`, 'info');
    }

    // ==========================================
    // PARTY ACCOUNT LEDGER / KHATA (100% Offline)
    // ==========================================
    openPartyLedgerModal(partyId) {
        const party = this.parties.find(p => p.id === partyId);
        if (!party) return;

        this.activeLedgerParty = party;
        document.getElementById('ledger-party-name').textContent = party.name + ' - Statement / Khata';
        document.getElementById('ledger-party-sub').textContent = [
            party.phone ? `Ph: ${party.phone}` : '',
            party.gstin ? `GSTIN: ${party.gstin}` : '',
            party.city || party.state || ''
        ].filter(Boolean).join(' • ');

        // Find all vouchers for this party
        const partyVouchers = this.vouchers.filter(v => v.partyId === party.id || v.partyName === party.name);
        partyVouchers.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        let totalBilled = 0;
        let totalPaid = 0;
        let runningBalance = Number(party.openingBalance || 0);

        const rows = [];
        if (party.openingBalance) {
            rows.push(`
                <tr style="background:rgba(255,255,255,0.02);">
                    <td>-</td>
                    <td><strong>OPENING</strong></td>
                    <td>Opening Balance</td>
                    <td style="text-align:right;">${runningBalance > 0 ? InvoiceEngine.formatCurrency(runningBalance) : '-'}</td>
                    <td style="text-align:right;">${runningBalance < 0 ? InvoiceEngine.formatCurrency(Math.abs(runningBalance)) : '-'}</td>
                    <td style="text-align:right; font-weight:700;">${InvoiceEngine.formatCurrency(runningBalance)}</td>
                </tr>
            `);
        }

        for (const v of partyVouchers) {
            const isInvoice = v.voucherType === 'sales_invoice';
            const isCreditNote = v.voucherType === 'credit_note';
            const grandTotal = Number(v.grandTotal || 0);
            const paid = Number(v.paidAmount || 0);

            let debit = 0;
            let credit = 0;

            if (isInvoice) {
                debit = grandTotal;
                credit = paid;
                runningBalance = runningBalance + debit - credit;
                totalBilled += debit;
                totalPaid += credit;
            } else if (isCreditNote) {
                credit = grandTotal;
                runningBalance = runningBalance - credit;
            } else {
                debit = grandTotal;
            }

            rows.push(`
                <tr>
                    <td>${InvoiceEngine.formatDate(v.date)}</td>
                    <td><strong style="color:var(--primary, #3b82f6);">${v.voucherNo}</strong></td>
                    <td><span style="font-size:10px; text-transform:uppercase; padding:2px 6px; border-radius:4px; background:rgba(255,255,255,0.05);">${(v.voucherType || '').replace('_', ' ')}</span></td>
                    <td style="text-align:right; color:#ef4444;">${debit > 0 ? InvoiceEngine.formatCurrency(debit) : '-'}</td>
                    <td style="text-align:right; color:#22c55e;">${credit > 0 ? InvoiceEngine.formatCurrency(credit) : '-'}</td>
                    <td style="text-align:right; font-weight:700;">${InvoiceEngine.formatCurrency(runningBalance)}</td>
                </tr>
            `);
        }

        const tbody = document.getElementById('ledger-table-body');
        if (tbody) {
            tbody.innerHTML = rows.length > 0 ? rows.join('') : `<tr><td colspan="6" style="text-align:center; padding:24px; color:#94a3b8;">No transactions found for this party.</td></tr>`;
        }

        const netDue = (party.currentBalance !== undefined) ? party.currentBalance : runningBalance;
        document.getElementById('ledger-total-billed').textContent = InvoiceEngine.formatCurrency(totalBilled);
        document.getElementById('ledger-total-paid').textContent = InvoiceEngine.formatCurrency(totalPaid);
        document.getElementById('ledger-total-due').textContent = InvoiceEngine.formatCurrency(netDue);

        document.getElementById('party-ledger-modal')?.classList.add('active');
    }

    async exportPartyStatementPdf() {
        if (!this.activeLedgerParty) return;
        const p = this.activeLedgerParty;
        const printArea = document.getElementById('party-ledger-modal')?.querySelector('.modal-body');
        if (!printArea) return;

        const opt = {
            margin: [10, 10, 10, 10],
            filename: `Statement_${(p.name || 'Party').replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        try {
            this.showToast('Generating Account Statement PDF...', 'info');
            await html2pdf().set(opt).from(printArea).save();
            this.showToast('Statement PDF downloaded successfully!', 'success');
        } catch (err) {
            console.error('PDF export error:', err);
            window.print();
        }
    }

    sharePartyStatementWhatsApp() {
        if (!this.activeLedgerParty) return;
        const p = this.activeLedgerParty;
        const partyVouchers = this.vouchers.filter(v => v.partyId === p.id || v.partyName === p.name);
        const due = p.currentBalance || 0;

        let msg = `*Account Statement: ${p.name}*\n`;
        msg += `Issued by: *${this.company?.businessName || 'BillFlow'}*\n`;
        msg += `Date: ${new Date().toLocaleDateString('en-IN')}\n\n`;
        msg += `*Outstanding Balance Due:* ${InvoiceEngine.formatCurrency(due)}\n\n`;
        msg += `*Recent Invoices:*\n`;

        partyVouchers.slice(-5).forEach(v => {
            msg += `• #${v.voucherNo} (${InvoiceEngine.formatDate(v.date)}): Total ${InvoiceEngine.formatCurrency(v.grandTotal)} | Due: ${InvoiceEngine.formatCurrency(v.balanceDue)}\n`;
        });

        msg += `\nPlease clear the pending dues at your earliest convenience.\nThank you!`;
        const phone = (p.phone || '').replace(/[^0-9]/g, '');
        const url = phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');
    }

    // ==========================================
    // OFFLINE CAMERA BARCODE SCANNER ENGINE
    // ==========================================
    async openCameraScanner(targetCallback) {
        this.onBarcodeDetected = targetCallback;
        const modal = document.getElementById('camera-scanner-modal');
        const video = document.getElementById('camera-scanner-video');
        if (!modal || !video) return;

        modal.classList.add('active');
        this.scannerActive = true;
        this.scannerFacingMode = this.scannerFacingMode || 'environment';

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: this.scannerFacingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            this.scannerMediaStream = stream;
            video.srcObject = stream;
            video.setAttribute('playsinline', true);
            await video.play();

            this.startBarcodeDetectionLoop(video);
        } catch (err) {
            console.warn('Camera access error:', err);
            this.showToast('Camera unavailable or permission denied. You can enter code manually.', 'warning');
        }
    }

    startBarcodeDetectionLoop(video) {
        let barcodeDetector = null;
        if ('BarcodeDetector' in window) {
            try {
                barcodeDetector = new window.BarcodeDetector({
                    formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e']
                });
            } catch (e) {
                console.warn('BarcodeDetector init error:', e);
            }
        }

        const detectFrame = async () => {
            if (!this.scannerActive) return;

            if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && barcodeDetector) {
                try {
                    const barcodes = await barcodeDetector.detect(video);
                    if (barcodes && barcodes.length > 0) {
                        const rawValue = barcodes[0].rawValue;
                        if (rawValue) {
                            this.playScanBeep();
                            this.handleScannedCode(rawValue);
                            return;
                        }
                    }
                } catch (e) {}
            }
            if (this.scannerActive) {
                this.scannerAnimFrame = requestAnimationFrame(detectFrame);
            }
        };

        this.scannerAnimFrame = requestAnimationFrame(detectFrame);
    }

    stopCameraScanner() {
        this.scannerActive = false;
        if (this.scannerAnimFrame) {
            cancelAnimationFrame(this.scannerAnimFrame);
            this.scannerAnimFrame = null;
        }
        if (this.scannerMediaStream) {
            this.scannerMediaStream.getTracks().forEach(t => t.stop());
            this.scannerMediaStream = null;
        }
        const video = document.getElementById('camera-scanner-video');
        if (video) video.srcObject = null;
        document.getElementById('camera-scanner-modal')?.classList.remove('active');
    }

    playScanBeep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, ctx.currentTime);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        } catch (e) {}
    }

    handleScannedCode(code) {
        const cleanCode = (code || '').trim();
        if (!cleanCode) return;
        this.stopCameraScanner();

        if (typeof this.onBarcodeDetected === 'function') {
            this.onBarcodeDetected(cleanCode);
        }
    }

    handleBarcodeScannedForVoucher(code) {
        const clean = code.toLowerCase().trim();
        const found = this.items.find(i => 
            (i.barcode && i.barcode.toLowerCase() === clean) ||
            (i.sku && i.sku.toLowerCase() === clean) ||
            (i.id && i.id.toLowerCase() === clean) ||
            (i.name && i.name.toLowerCase() === clean)
        );

        if (found) {
            const existingSelects = document.querySelectorAll('.item-select');
            let matched = false;
            for (const sel of existingSelects) {
                if (sel.value === found.id) {
                    const row = sel.closest('tr');
                    const qtyInput = row?.querySelector('.item-qty');
                    if (qtyInput) {
                        qtyInput.value = (Number(qtyInput.value) || 0) + 1;
                        this.recalcVoucherTotals();
                        this.showToast(`Updated quantity for: ${found.name} (Qty: ${qtyInput.value})`, 'success');
                        matched = true;
                        break;
                    }
                }
            }
            if (!matched) {
                this.addItemRow(found);
                this.showToast(`Added: ${found.name}`, 'success');
            }
        } else {
            alert(`Product with Barcode "${code}" was not found in your inventory.\n\nYou can add it from the Product tab.`);
        }
    }

    // ==========================================
    // PRODUCT OPTIONS & EXCEL EXPORT (100% Offline)
    // ==========================================
    openProductOptionsModal() {
        const modal = document.getElementById('product-options-modal');
        if (!modal) return;

        let totalQty = 0;
        let totalValuation = 0;
        (this.items || []).forEach(itm => {
            const qty = Number(itm.currentStock || 0);
            const rate = Number(itm.wholesalePrice || itm.retailPrice || 0);
            totalQty += qty;
            totalValuation += (qty * rate);
        });

        const itemsEl = document.getElementById('pop-total-items');
        const stockEl = document.getElementById('pop-total-stock');
        const valEl = document.getElementById('pop-total-val');

        if (itemsEl) itemsEl.textContent = `${this.items.length} ${this.items.length === 1 ? 'Product' : 'Products'}`;
        if (stockEl) stockEl.textContent = `${totalQty.toFixed(0)} Units`;
        if (valEl) valEl.textContent = InvoiceEngine.formatCurrency(totalValuation);

        modal.classList.add('active');
    }

    async downloadProductsExcel(format = 'xlsx') {
        try {
            if (!this.items || this.items.length === 0) {
                alert('No products found to export. Please add at least one product first.');
                return;
            }

            const today = new Date().toISOString().split('T')[0];
            const godownMap = {};
            (this.godowns || []).forEach(g => { godownMap[g.id] = g.name; });

            let totalQty = 0;
            let totalValuation = 0;

            const rows = this.items.map((itm, idx) => {
                const qty = Number(itm.currentStock || 0);
                const wholesale = Number(itm.wholesalePrice || 0);
                const retail = Number(itm.retailPrice || wholesale);
                const taxRate = itm.taxRate !== undefined ? Number(itm.taxRate) : 18;
                const valuation = qty * wholesale;
                totalQty += qty;
                totalValuation += valuation;
                const godownName = godownMap[itm.godownId] || itm.godownId || 'Main Warehouse';
                const status = qty <= (itm.minStockAlert || 10) ? 'LOW STOCK' : 'IN STOCK';

                return {
                    sno: idx + 1,
                    name: itm.name || 'Unnamed Product',
                    sku: itm.sku || '-',
                    hsn: itm.hsn || '-',
                    category: itm.category || 'General',
                    unit: itm.unit || 'Pcs',
                    taxRate: `${taxRate}%`,
                    wholesalePrice: wholesale,
                    retailPrice: retail,
                    stock: qty,
                    stockValuation: valuation,
                    warehouse: godownName,
                    status
                };
            });

            if (format === 'xlsx' && typeof window.XLSX !== 'undefined') {
                const header = [
                    'S.No.', 'Product Name', 'SKU / Code', 'HSN / SAC Code', 'Category',
                    'Unit', 'GST Rate (%)', 'Wholesale Price (₹)', 'Retail MRP (₹)',
                    'Current Stock', 'Stock Valuation (₹)', 'Warehouse / Godown', 'Stock Status'
                ];

                const aoa = [
                    header,
                    ...rows.map(r => [
                        r.sno, r.name, r.sku, r.hsn, r.category,
                        r.unit, r.taxRate, r.wholesalePrice, r.retailPrice,
                        r.stock, r.stockValuation, r.warehouse, r.status
                    ]),
                    [], // Blank separator row
                    [
                        'TOTALS',
                        `${this.items.length} Products`,
                        '', '', '', '', '', '', '',
                        totalQty,
                        totalValuation,
                        '', ''
                    ]
                ];

                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.aoa_to_sheet(aoa);

                // Auto column widths for clean Excel presentation
                ws['!cols'] = [
                    { wch: 8 },  // S.No.
                    { wch: 30 }, // Product Name
                    { wch: 18 }, // SKU
                    { wch: 14 }, // HSN
                    { wch: 16 }, // Category
                    { wch: 10 }, // Unit
                    { wch: 14 }, // GST Rate
                    { wch: 18 }, // Wholesale Price
                    { wch: 16 }, // Retail MRP
                    { wch: 14 }, // Stock
                    { wch: 20 }, // Valuation
                    { wch: 24 }, // Warehouse
                    { wch: 14 }  // Status
                ];

                XLSX.utils.book_append_sheet(wb, ws, 'Products_Catalogue');
                const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const fileName = `BillFlow_Products_${today}.xlsx`;

                await this.deliverDownloadedFile(blob, fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                document.getElementById('product-options-modal')?.classList.remove('active');
                this.showToast(`✓ Excel sheet exported: ${fileName}`, 'success');
            } else {
                // CSV Export (Native fallback or selected CSV)
                const headers = ['S.No.', 'Product Name', 'SKU', 'HSN', 'Category', 'Unit', 'GST Rate', 'Wholesale Price', 'Retail MRP', 'Current Stock', 'Stock Valuation', 'Warehouse', 'Status'];
                const csvRows = [
                    headers.map(h => `"${h}"`).join(','),
                    ...rows.map(r => [
                        r.sno,
                        `"${(r.name).replace(/"/g, '""')}"`,
                        `"${r.sku}"`,
                        `"${r.hsn}"`,
                        `"${r.category}"`,
                        `"${r.unit}"`,
                        `"${r.taxRate}"`,
                        r.wholesalePrice.toFixed(2),
                        r.retailPrice.toFixed(2),
                        r.stock,
                        r.stockValuation.toFixed(2),
                        `"${r.warehouse}"`,
                        `"${r.status}"`
                    ].join(',')),
                    '',
                    `"TOTALS","${this.items.length} Products","","","","","","","",${totalQty},${totalValuation.toFixed(2)},"",""`
                ];

                const csvContent = '\uFEFF' + csvRows.join('\r\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const fileName = `BillFlow_Products_${today}.csv`;

                await this.deliverDownloadedFile(blob, fileName, 'text/csv');
                document.getElementById('product-options-modal')?.classList.remove('active');
                this.showToast(`✓ CSV sheet exported: ${fileName}`, 'success');
            }
        } catch (err) {
            console.error('Excel export error:', err);
            alert('Failed to generate Excel file: ' + err.message);
        }
    }

    // ==========================================
    // INVOICE EXPORT & DAYS/PERIOD SELECTION
    // ==========================================
    openInvoiceExportModal(presetDays = 30) {
        const modal = document.getElementById('invoice-export-modal');
        if (!modal) return;

        this.setInvoiceExportDays(presetDays);
        modal.classList.add('active');
    }

    setInvoiceExportDays(days) {
        this.invoiceExportDays = days;
        const panel = document.getElementById('inv-custom-days-panel');
        const badge = document.getElementById('inv-exp-days-badge');

        // Update active chip state
        document.querySelectorAll('#inv-days-chips-container .days-chip').forEach(chip => {
            if (chip.dataset.days === String(days)) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });

        const today = new Date();
        const toDateStr = today.toISOString().split('T')[0];

        if (days === 'custom') {
            if (panel) panel.style.display = 'block';
            if (badge) badge.textContent = 'Custom Range';
            const countInput = document.getElementById('input-custom-days-count');
            const customDays = parseInt(countInput?.value, 10) || 30;
            const fromD = new Date();
            fromD.setDate(today.getDate() - (customDays - 1));
            const fromDateStr = fromD.toISOString().split('T')[0];
            
            const fromInput = document.getElementById('input-export-from-date');
            const toInput = document.getElementById('input-export-to-date');
            if (fromInput && !fromInput.value) fromInput.value = fromDateStr;
            if (toInput && !toInput.value) toInput.value = toDateStr;
        } else if (days === 'all') {
            if (panel) panel.style.display = 'none';
            if (badge) badge.textContent = 'All Time';
            this.invoiceExportFromDate = '';
            this.invoiceExportToDate = '';
        } else {
            if (panel) panel.style.display = 'none';
            const numDays = parseInt(days, 10) || 30;
            if (badge) badge.textContent = `Last ${numDays} Days`;
            const fromD = new Date();
            fromD.setDate(today.getDate() - (numDays - 1));
            const fromDateStr = fromD.toISOString().split('T')[0];
            this.invoiceExportFromDate = fromDateStr;
            this.invoiceExportToDate = toDateStr;

            const fromInput = document.getElementById('input-export-from-date');
            const toInput = document.getElementById('input-export-to-date');
            if (fromInput) fromInput.value = fromDateStr;
            if (toInput) toInput.value = toDateStr;
            const countInput = document.getElementById('input-custom-days-count');
            if (countInput) countInput.value = numDays;
        }

        this.updateInvoiceExportPreview();
    }

    getFilteredInvoicesForExport() {
        const vType = document.getElementById('inv-export-voucher-type')?.value || this.invoiceExportType || 'sales_invoice';
        const pStatus = document.getElementById('inv-export-payment-status')?.value || this.invoiceExportStatus || 'all';

        let fromDate = this.invoiceExportFromDate;
        let toDate = this.invoiceExportToDate;

        if (this.invoiceExportDays === 'custom') {
            fromDate = document.getElementById('input-export-from-date')?.value || '';
            toDate = document.getElementById('input-export-to-date')?.value || '';
        }

        let filtered = [...(this.vouchers || [])];

        // 1. Filter by Voucher Type
        if (vType === 'sales_invoice') {
            filtered = filtered.filter(v => v.voucherType === 'sales_invoice');
        } else if (vType === 'purchase_invoice') {
            filtered = filtered.filter(v => v.voucherType === 'purchase_invoice');
        } else if (vType === 'estimate') {
            filtered = filtered.filter(v => v.voucherType === 'estimate');
        }

        // 2. Filter by Payment Status
        if (pStatus === 'paid') {
            filtered = filtered.filter(v => v.paymentStatus === 'paid');
        } else if (pStatus === 'pending') {
            filtered = filtered.filter(v => (v.balanceDue || 0) > 0);
        }

        // 3. Filter by Date Range
        if (this.invoiceExportDays !== 'all' && (fromDate || toDate)) {
            filtered = filtered.filter(v => {
                const d = v.date || '';
                if (fromDate && d < fromDate) return false;
                if (toDate && d > toDate) return false;
                return true;
            });
        }

        filtered.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.voucherNo || '').localeCompare(a.voucherNo || ''));

        return {
            filtered,
            fromDate,
            toDate,
            vType,
            pStatus
        };
    }

    updateInvoiceExportPreview() {
        const { filtered, fromDate, toDate } = this.getFilteredInvoicesForExport();

        let totalAmount = 0;
        let totalPaid = 0;
        let totalDue = 0;

        filtered.forEach(v => {
            totalAmount += (v.grandTotal || 0);
            totalPaid += Number(v.paidAmount ?? v.amountPaid ?? 0);
            totalDue += (v.balanceDue || 0);
        });

        const countEl = document.getElementById('inv-exp-preview-count');
        const totEl = document.getElementById('inv-exp-preview-total');
        const paidEl = document.getElementById('inv-exp-preview-paid');
        const dueEl = document.getElementById('inv-exp-preview-due');
        const dateRangeTextEl = document.getElementById('inv-export-date-range-text');

        if (countEl) countEl.textContent = `${filtered.length}`;
        if (totEl) totEl.textContent = InvoiceEngine.formatCurrency(totalAmount);
        if (paidEl) paidEl.textContent = InvoiceEngine.formatCurrency(totalPaid);
        if (dueEl) dueEl.textContent = InvoiceEngine.formatCurrency(totalDue);

        if (dateRangeTextEl) {
            if (this.invoiceExportDays === 'all') {
                dateRangeTextEl.textContent = 'All Time Records (Full Invoices Ledger)';
            } else if (fromDate && toDate) {
                const diffTime = Math.abs(new Date(toDate) - new Date(fromDate));
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                dateRangeTextEl.textContent = `${InvoiceEngine.formatDate(fromDate)} to ${InvoiceEngine.formatDate(toDate)} (${diffDays} Days)`;
            } else {
                dateRangeTextEl.textContent = 'Custom Date Filter Active';
            }
        }
    }

    async downloadInvoicesExcel(format = 'xlsx') {
        try {
            const { filtered, fromDate, toDate, vType } = this.getFilteredInvoicesForExport();

            if (filtered.length === 0) {
                alert('No invoices found for the selected period. Please try selecting a wider date range or "All Time".');
                return;
            }

            const today = new Date().toISOString().split('T')[0];
            const periodLabel = this.invoiceExportDays === 'all' 
                ? 'All_Time' 
                : (fromDate && toDate ? `${fromDate}_to_${toDate}` : `Last_${this.invoiceExportDays}_Days`);

            // Compute summary totals
            let sumSubtotal = 0;
            let sumDiscount = 0;
            let sumTaxable = 0;
            let sumCgst = 0;
            let sumSgst = 0;
            let sumIgst = 0;
            let sumTotalTax = 0;
            let sumRoundOff = 0;
            let sumGrandTotal = 0;
            let sumPaid = 0;
            let sumBalanceDue = 0;

            const invoiceMasterRows = filtered.map((v, idx) => {
                const subtotal = Number(v.subtotal || 0);
                const discount = Number(v.overallDiscountAmount || 0);
                const taxable = Number(v.taxableTotal || (subtotal - discount));
                const cgst = Number(v.cgst || 0);
                const sgst = Number(v.sgst || 0);
                const igst = Number(v.igst || 0);
                const tax = Number(v.totalTax || (cgst + sgst + igst));
                const roundOff = Number(v.roundOff || 0);
                const grandTotal = Number(v.grandTotal || 0);
                const paid = Number(v.paidAmount ?? v.amountPaid ?? 0);
                const balanceDue = Number(v.balanceDue || 0);

                sumSubtotal += subtotal;
                sumDiscount += discount;
                sumTaxable += taxable;
                sumCgst += cgst;
                sumSgst += sgst;
                sumIgst += igst;
                sumTotalTax += tax;
                sumRoundOff += roundOff;
                sumGrandTotal += grandTotal;
                sumPaid += paid;
                sumBalanceDue += balanceDue;

                const itemsCount = (v.items || []).length;
                const itemsSummary = (v.items || []).map(i => `${i.name || 'Item'} (${i.qty || 1} ${i.unit || ''})`).join('; ');

                const rawMod = v.updatedAt || v.lastModified || v.createdAt || v.date || '';
                let lastModifiedStr = '-';
                if (rawMod) {
                    const d = new Date(rawMod);
                    if (!isNaN(d.getTime())) {
                        lastModifiedStr = d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                    } else {
                        lastModifiedStr = String(rawMod);
                    }
                }

                return {
                    sno: idx + 1,
                    invoiceNo: v.voucherNo || `INV-${idx + 1}`,
                    date: v.date || '',
                    dueDate: v.dueDate || '-',
                    lastModified: lastModifiedStr,
                    type: (v.voucherType || 'sales_invoice').replace('_', ' ').toUpperCase(),
                    partyName: v.partyName || 'Cash Customer',
                    partyPhone: v.partyPhone || '-',
                    partyGstin: v.partyGstin || '-',
                    status: (v.paymentStatus || 'unpaid').toUpperCase(),
                    mode: (v.paymentMode || 'Cash').toUpperCase(),
                    itemsCount,
                    itemsSummary,
                    subtotal,
                    discount,
                    taxable,
                    cgst,
                    sgst,
                    igst,
                    tax,
                    roundOff,
                    grandTotal,
                    paid,
                    balanceDue
                };
            });

            // Prepare itemized line breakdown (Sheet 2)
            const itemizedRows = [];
            let itemSeq = 1;
            let sumItemQty = 0;
            let sumItemTaxable = 0;
            let sumItemTax = 0;
            let sumItemTotal = 0;

            filtered.forEach(v => {
                const items = v.items || [];
                items.forEach(itm => {
                    const qty = Number(itm.qty || 0);
                    const price = Number(itm.price || 0);
                    const discPercent = Number(itm.discountPercent || 0);
                    const taxable = Number(itm.taxableAmount || (qty * price));
                    const rate = Number(itm.taxRate || 0);
                    const cgst = Number(itm.cgst || 0);
                    const sgst = Number(itm.sgst || 0);
                    const igst = Number(itm.igst || 0);
                    const totalTax = Number(itm.totalTax || (cgst + sgst + igst));
                    const totalAmt = Number(itm.totalAmount || (taxable + totalTax));

                    sumItemQty += qty;
                    sumItemTaxable += taxable;
                    sumItemTax += totalTax;
                    sumItemTotal += totalAmt;

                    itemizedRows.push({
                        sno: itemSeq++,
                        invoiceNo: v.voucherNo || '',
                        date: v.date || '',
                        partyName: v.partyName || 'Cash Customer',
                        itemName: itm.name || 'Product',
                        sku: itm.sku || '-',
                        hsn: itm.hsn || '-',
                        qty,
                        unit: itm.unit || 'Pcs',
                        price,
                        discPercent: `${discPercent}%`,
                        taxable,
                        gstRate: `${rate}%`,
                        cgst,
                        sgst,
                        igst,
                        totalTax,
                        totalAmt
                    });
                });
            });

            if (format === 'xlsx' && typeof window.XLSX !== 'undefined') {
                const wb = XLSX.utils.book_new();

                // ----------------- SHEET 1: Invoices Summary -----------------
                const header1 = [
                    'S.No.', 'Invoice No.', 'Invoice Date', 'Due Date', 'Last Modified Date & Time', 'Voucher Type',
                    'Customer / Party Name', 'Phone Number', 'GSTIN', 'Payment Status', 'Payment Mode',
                    'Items Count', 'Items Summary',
                    'Subtotal (₹)', 'Discount (₹)', 'Taxable Amount (₹)',
                    'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Total GST Tax (₹)', 'Round Off (₹)',
                    'Grand Total (₹)', 'Amount Paid (₹)', 'Balance Due (₹)'
                ];

                const aoa1 = [
                    header1,
                    ...invoiceMasterRows.map(r => [
                        r.sno, r.invoiceNo, r.date, r.dueDate, r.lastModified, r.type,
                        r.partyName, r.partyPhone, r.partyGstin, r.status, r.mode,
                        r.itemsCount, r.itemsSummary,
                        r.subtotal, r.discount, r.taxable,
                        r.cgst, r.sgst, r.igst, r.tax, r.roundOff,
                        r.grandTotal, r.paid, r.balanceDue
                    ]),
                    [], // Blank Row
                    [
                        'TOTALS',
                        `${filtered.length} Invoices`,
                        '', '', '', '', '', '', '', '', '', '', '',
                        sumSubtotal, sumDiscount, sumTaxable,
                        sumCgst, sumSgst, sumIgst, sumTotalTax, sumRoundOff,
                        sumGrandTotal, sumPaid, sumBalanceDue
                    ]
                ];

                const ws1 = XLSX.utils.aoa_to_sheet(aoa1);
                ws1['!cols'] = [
                    { wch: 8 },  // S.No.
                    { wch: 18 }, // Invoice No.
                    { wch: 14 }, // Date
                    { wch: 14 }, // Due Date
                    { wch: 24 }, // Last Modified Date & Time
                    { wch: 16 }, // Type
                    { wch: 28 }, // Party Name
                    { wch: 16 }, // Phone
                    { wch: 18 }, // GSTIN
                    { wch: 14 }, // Status
                    { wch: 14 }, // Mode
                    { wch: 12 }, // Items Count
                    { wch: 36 }, // Items Summary
                    { wch: 15 }, // Subtotal
                    { wch: 14 }, // Discount
                    { wch: 18 }, // Taxable
                    { wch: 12 }, // CGST
                    { wch: 12 }, // SGST
                    { wch: 12 }, // IGST
                    { wch: 16 }, // Total Tax
                    { wch: 12 }, // Round Off
                    { wch: 18 }, // Grand Total
                    { wch: 16 }, // Amount Paid
                    { wch: 16 }  // Balance Due
                ];
                XLSX.utils.book_append_sheet(wb, ws1, 'Invoices_Summary');

                // ----------------- SHEET 2: Item-Wise Sales Breakdown -----------------
                const header2 = [
                    'S.No.', 'Invoice No.', 'Date', 'Customer Name',
                    'Product / Item Name', 'SKU', 'HSN / SAC',
                    'Quantity', 'Unit', 'Price / Rate (₹)', 'Discount (%)', 'Taxable Value (₹)',
                    'GST Rate (%)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Tax Amount (₹)', 'Line Total (₹)'
                ];

                const aoa2 = [
                    header2,
                    ...itemizedRows.map(r => [
                        r.sno, r.invoiceNo, r.date, r.partyName,
                        r.itemName, r.sku, r.hsn,
                        r.qty, r.unit, r.price, r.discPercent, r.taxable,
                        r.gstRate, r.cgst, r.sgst, r.igst, r.totalTax, r.totalAmt
                    ]),
                    [], // Blank Row
                    [
                        'TOTALS',
                        `${itemizedRows.length} Items`,
                        '', '', '', '', '',
                        sumItemQty, '', '', '', sumItemTaxable,
                        '', '', '', '', sumItemTax, sumItemTotal
                    ]
                ];

                const ws2 = XLSX.utils.aoa_to_sheet(aoa2);
                ws2['!cols'] = [
                    { wch: 8 },  // S.No.
                    { wch: 18 }, // Invoice No.
                    { wch: 14 }, // Date
                    { wch: 26 }, // Customer Name
                    { wch: 28 }, // Item Name
                    { wch: 14 }, // SKU
                    { wch: 14 }, // HSN
                    { wch: 12 }, // Qty
                    { wch: 10 }, // Unit
                    { wch: 14 }, // Price
                    { wch: 12 }, // Discount
                    { wch: 16 }, // Taxable Value
                    { wch: 12 }, // GST Rate
                    { wch: 12 }, // CGST
                    { wch: 12 }, // SGST
                    { wch: 12 }, // IGST
                    { wch: 14 }, // Tax Amount
                    { wch: 16 }  // Line Total
                ];
                XLSX.utils.book_append_sheet(wb, ws2, 'Item_Wise_Breakdown');

                const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const fileName = `BillFlow_Invoices_${periodLabel}_${today}.xlsx`;

                await this.deliverDownloadedFile(blob, fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                document.getElementById('invoice-export-modal')?.classList.remove('active');
                this.showToast(`✓ Invoices Excel exported (${filtered.length} bills): ${fileName}`, 'success');
            } else {
                // CSV Export (Master ledger with UTF-8 BOM)
                const headers = [
                    'S.No.', 'Invoice No.', 'Date', 'Due Date', 'Last Modified Date & Time', 'Voucher Type',
                    'Party Name', 'Phone', 'GSTIN', 'Payment Status', 'Payment Mode',
                    'Items Count', 'Subtotal', 'Discount', 'Taxable Amount',
                    'CGST', 'SGST', 'IGST', 'Total Tax', 'Round Off',
                    'Grand Total', 'Amount Paid', 'Balance Due'
                ];

                const csvRows = [
                    headers.map(h => `"${h}"`).join(','),
                    ...invoiceMasterRows.map(r => [
                        r.sno,
                        `"${r.invoiceNo}"`,
                        `"${r.date}"`,
                        `"${r.dueDate}"`,
                        `"${r.lastModified}"`,
                        `"${r.type}"`,
                        `"${(r.partyName).replace(/"/g, '""')}"`,
                        `"${r.partyPhone}"`,
                        `"${r.partyGstin}"`,
                        `"${r.status}"`,
                        `"${r.mode}"`,
                        r.itemsCount,
                        r.subtotal.toFixed(2),
                        r.discount.toFixed(2),
                        r.taxable.toFixed(2),
                        r.cgst.toFixed(2),
                        r.sgst.toFixed(2),
                        r.igst.toFixed(2),
                        r.tax.toFixed(2),
                        r.roundOff.toFixed(2),
                        r.grandTotal.toFixed(2),
                        r.paid.toFixed(2),
                        r.balanceDue.toFixed(2)
                    ].join(',')),
                    '',
                    `"TOTALS","${filtered.length} Invoices","","","","","","","","","",` +
                    `"",${sumSubtotal.toFixed(2)},${sumDiscount.toFixed(2)},${sumTaxable.toFixed(2)},` +
                    `${sumCgst.toFixed(2)},${sumSgst.toFixed(2)},${sumIgst.toFixed(2)},${sumTotalTax.toFixed(2)},${sumRoundOff.toFixed(2)},` +
                    `${sumGrandTotal.toFixed(2)},${sumPaid.toFixed(2)},${sumBalanceDue.toFixed(2)}`
                ];

                const csvContent = '\uFEFF' + csvRows.join('\r\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const fileName = `BillFlow_Invoices_${periodLabel}_${today}.csv`;

                await this.deliverDownloadedFile(blob, fileName, 'text/csv');
                document.getElementById('invoice-export-modal')?.classList.remove('active');
                this.showToast(`✓ Invoices CSV exported (${filtered.length} bills): ${fileName}`, 'success');
            }
        } catch (err) {
            console.error('Invoice Excel export error:', err);
            alert('Failed to generate Invoices spreadsheet: ' + err.message);
        }
    }

    async deliverDownloadedFile(blob, fileName, mimeType) {
        // 1. Android Native Downloader (Capacitor BridgeActivity interface)
        if (window.NativeDownloader && typeof window.NativeDownloader.saveBase64File === 'function') {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    try {
                        const base64 = reader.result.split(',')[1];
                        window.NativeDownloader.saveBase64File(base64, mimeType, fileName);
                        resolve(true);
                    } catch (e) { reject(e); }
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }

        // 2. Web Share API with File (Mobile devices / WebViews supporting file sharing)
        try {
            if (navigator.canShare && typeof File !== 'undefined') {
                const file = new File([blob], fileName, { type: mimeType });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: fileName,
                        text: 'BillFlow Products Catalogue'
                    });
                    return;
                }
            }
        } catch (shareErr) {
            if (shareErr.name === 'AbortError') return; // User dismissed share sheet
            console.warn('Web Share failed, falling back to download link:', shareErr);
        }

        // 3. Direct browser link download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    // ==========================================
    // 1-CLICK DOCUMENT CONVERSION ENGINE
    // ==========================================
    async convertVoucher(voucherId, targetType = 'sales_invoice') {
        const sourceVoucher = this.vouchers.find(v => v.id === voucherId);
        if (!sourceVoucher) {
            this.showToast('Source document not found', 'error');
            return;
        }

        let prefix = 'INV-26/';
        let typeLabel = 'Tax Invoice';
        if (targetType === 'delivery_challan') {
            prefix = 'DC-26/';
            typeLabel = 'Delivery Challan';
        } else if (targetType === 'sales_invoice') {
            prefix = 'INV-26/';
            typeLabel = 'Tax Invoice';
        } else if (targetType === 'estimate') {
            prefix = 'EST-26/';
            typeLabel = 'Quotation / Estimate';
        }

        const newVoucherNo = InvoiceEngine.generateNextVoucherNo(this.vouchers, prefix);
        const todayStr = new Date().toISOString().split('T')[0];

        // Deep clone source voucher
        const newVoucher = JSON.parse(JSON.stringify(sourceVoucher));
        newVoucher.id = 'v_' + Date.now();
        newVoucher.voucherNo = newVoucherNo;
        newVoucher.voucherType = targetType;
        newVoucher.date = todayStr;
        newVoucher.convertedFrom = sourceVoucher.voucherNo;
        newVoucher.lastModified = new Date().toISOString();

        if (targetType === 'sales_invoice' && sourceVoucher.paymentStatus === undefined) {
            newVoucher.paymentStatus = 'unpaid';
            newVoucher.paidAmount = 0;
            newVoucher.balanceDue = newVoucher.grandTotal;
        }

        // Save new converted voucher
        await window.dbService.put('vouchers', newVoucher);

        // Update source voucher with conversion link
        sourceVoucher.isConverted = true;
        sourceVoucher.convertedTo = newVoucherNo;
        await window.dbService.put('vouchers', sourceVoucher);

        await this.loadAllState();
        this.renderBillsScreen();
        this.showToast(`✓ Converted ${sourceVoucher.voucherNo} ➔ ${newVoucherNo} (${typeLabel})`, 'success');

        // Immediately open print preview for the newly converted voucher
        this.openPrintModal(newVoucher.id);
    }

    // ==========================================
    // CUSTOMER / VENDOR KHATA & ACCOUNT LEDGER
    // ==========================================
    openPartyLedgerModal(partyId) {
        const party = this.parties.find(p => p.id === partyId);
        if (!party) {
            this.showToast('Party not found', 'error');
            return;
        }

        this.activeLedgerParty = party;
        const nameEl = document.getElementById('ledger-party-name');
        const subEl = document.getElementById('ledger-party-sub');
        if (nameEl) nameEl.textContent = `${party.name} — Statement / Khata`;
        if (subEl) {
            const loc = [party.phone || '', party.gstin ? `GST: ${party.gstin}` : '', party.city || party.state || ''].filter(Boolean).join(' • ');
            subEl.textContent = loc || 'All Transactions & Bills';
        }

        const partyVouchers = this.vouchers.filter(v => v.partyId === party.id || (v.partyName && v.partyName.trim().toLowerCase() === party.name.trim().toLowerCase()));
        partyVouchers.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        let totalBilled = 0;
        let totalPaid = 0;
        let runningBalance = 0;

        const tbody = document.getElementById('ledger-table-body');
        if (tbody) {
            if (partyVouchers.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align:center; padding:24px; color:var(--text-sub, #94a3b8);">
                            No transactions or bills recorded for this party yet.
                        </td>
                    </tr>
                `;
            } else {
                tbody.innerHTML = partyVouchers.map(v => {
                    const isBill = v.voucherType === 'sales_invoice' || v.voucherType === 'debit_note';
                    const isCredit = v.voucherType === 'credit_note';

                    let debit = 0;
                    let credit = 0;
                    if (isBill) {
                        debit = Number(v.grandTotal || 0);
                        credit = Number(v.paidAmount || 0);
                    } else if (isCredit) {
                        credit = Number(v.grandTotal || 0);
                    } else {
                        debit = Number(v.grandTotal || 0);
                    }

                    totalBilled += debit;
                    totalPaid += credit;
                    runningBalance += (debit - credit);

                    return `
                        <tr>
                            <td style="font-size:11.5px; white-space:nowrap;">${v.date || '-'}</td>
                            <td style="font-weight:700; font-size:12px; cursor:pointer; color:var(--primary, #3b82f6);" onclick="window.app.openPrintModal('${v.id}')">#${v.voucherNo}</td>
                            <td style="font-size:10.5px; text-transform:uppercase;">${(v.voucherType || '').replace('_', ' ')}</td>
                            <td style="text-align:right; font-weight:600; color:var(--text-primary);">${debit > 0 ? InvoiceEngine.formatCurrency(debit) : '-'}</td>
                            <td style="text-align:right; font-weight:600; color:#22c55e;">${credit > 0 ? InvoiceEngine.formatCurrency(credit) : '-'}</td>
                            <td style="text-align:right; font-weight:800; color:${runningBalance > 0 ? '#ef4444' : '#22c55e'};">${InvoiceEngine.formatCurrency(runningBalance)}</td>
                        </tr>
                    `;
                }).join('');
            }
        }

        const billedEl = document.getElementById('ledger-total-billed');
        const paidEl = document.getElementById('ledger-total-paid');
        const dueEl = document.getElementById('ledger-total-due');
        if (billedEl) billedEl.textContent = InvoiceEngine.formatCurrency(totalBilled);
        if (paidEl) paidEl.textContent = InvoiceEngine.formatCurrency(totalPaid);
        if (dueEl) dueEl.textContent = InvoiceEngine.formatCurrency(runningBalance);

        document.getElementById('party-ledger-modal')?.classList.add('active');
    }

    async exportPartyStatementPdf() {
        const party = this.activeLedgerParty;
        if (!party) return;

        const partyVouchers = this.vouchers.filter(v => v.partyId === party.id || (v.partyName && v.partyName.trim().toLowerCase() === party.name.trim().toLowerCase()));
        partyVouchers.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        let totalBilled = 0;
        let totalPaid = 0;
        let runningBalance = 0;

        const rowsHtml = partyVouchers.map((v, idx) => {
            const isBill = v.voucherType === 'sales_invoice' || v.voucherType === 'debit_note';
            let debit = isBill ? Number(v.grandTotal || 0) : Number(v.grandTotal || 0);
            let credit = isBill ? Number(v.paidAmount || 0) : 0;
            totalBilled += debit;
            totalPaid += credit;
            runningBalance += (debit - credit);

            return `
                <tr style="border-bottom: 1px solid #e2e8f0; font-size:10px;">
                    <td style="padding:6px; text-align:center;">${idx + 1}</td>
                    <td style="padding:6px;">${v.date || '-'}</td>
                    <td style="padding:6px; font-weight:bold;">${v.voucherNo}</td>
                    <td style="padding:6px; text-transform:uppercase;">${(v.voucherType || '').replace('_', ' ')}</td>
                    <td style="padding:6px; text-align:right;">${debit > 0 ? debit.toFixed(2) : '-'}</td>
                    <td style="padding:6px; text-align:right;">${credit > 0 ? credit.toFixed(2) : '-'}</td>
                    <td style="padding:6px; text-align:right; font-weight:bold;">${runningBalance.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        const company = this.company || {};
        const today = new Date().toISOString().split('T')[0];
        const statementHtml = `
            <div style="font-family:Arial, sans-serif; padding:16px; color:#0f172a; max-width:794px; background:#fff;">
                <div style="display:flex; justify-content:space-between; border-bottom:2px solid #0f172a; padding-bottom:10px; margin-bottom:12px;">
                    <div>
                        <h2 style="margin:0; font-size:18px;">${company.businessName || 'Business Statement'}</h2>
                        <div style="font-size:11px; color:#475569;">${company.address || ''} ${company.city || ''} ${company.state || ''}</div>
                        <div style="font-size:11px; color:#475569;">Phone: ${company.phone || '-'} | GSTIN: ${company.gstin || '-'}</div>
                    </div>
                    <div style="text-align:right;">
                        <h3 style="margin:0; color:#1e40af; font-size:16px;">ACCOUNT STATEMENT</h3>
                        <div style="font-size:11px; color:#64748b;">Date: ${today}</div>
                    </div>
                </div>

                <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:10px; margin-bottom:12px; font-size:11px;">
                    <div style="font-size:13px; font-weight:bold; margin-bottom:2px;">Statement For: ${party.name}</div>
                    <div>Phone: ${party.phone || '-'} | GSTIN: ${party.gstin || 'Unregistered'}</div>
                    <div>Address: ${party.billingAddress || party.address || '-'}</div>
                </div>

                <table style="width:100%; border-collapse:collapse; margin-bottom:14px; font-size:11px;">
                    <thead>
                        <tr style="background:#0f172a; color:#fff;">
                            <th style="padding:6px; text-align:center;">#</th>
                            <th style="padding:6px; text-align:left;">Date</th>
                            <th style="padding:6px; text-align:left;">Ref / Voucher #</th>
                            <th style="padding:6px; text-align:left;">Type</th>
                            <th style="padding:6px; text-align:right;">Debit (₹)</th>
                            <th style="padding:6px; text-align:right;">Credit (₹)</th>
                            <th style="padding:6px; text-align:right;">Balance (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot>
                        <tr style="background:#f1f5f9; font-weight:bold; border-top:2px solid #0f172a;">
                            <td colspan="4" style="padding:8px; text-align:right;">TOTALS / NET DUE:</td>
                            <td style="padding:8px; text-align:right;">₹ ${totalBilled.toFixed(2)}</td>
                            <td style="padding:8px; text-align:right; color:#16a34a;">₹ ${totalPaid.toFixed(2)}</td>
                            <td style="padding:8px; text-align:right; color:#dc2626;">₹ ${runningBalance.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>

                <div style="display:flex; justify-content:space-between; margin-top:30px; font-size:11px; color:#475569;">
                    <div>This is a computer-generated account statement.</div>
                    <div style="text-align:right; border-top:1px solid #cbd5e1; padding-top:4px; min-width:140px;">
                        Authorized Signature
                    </div>
                </div>
            </div>
        `;

        const filename = `${today.replace(/-/g, '')}_Khata_${party.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        this.showToast('Generating Party Statement PDF...', 'info');

        const wrapper = document.createElement('div');
        wrapper.innerHTML = statementHtml;
        document.body.appendChild(wrapper);

        try {
            const opt = {
                margin: [6, 6, 6, 6],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            const pdfBlob = await window.html2pdf().set(opt).from(wrapper).outputPdf('blob');
            await this.deliverDownloadedFile(pdfBlob, filename, 'application/pdf');
            this.showToast(`✓ Statement PDF saved: ${filename}`, 'success');
        } catch (e) {
            console.error('Statement PDF error:', e);
            this.showToast('Statement PDF generation failed: ' + e.message, 'error');
        } finally {
            if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
        }
    }

    sharePartyStatementWhatsApp() {
        const party = this.activeLedgerParty;
        if (!party) return;

        const partyVouchers = this.vouchers.filter(v => v.partyId === party.id || (v.partyName && v.partyName.trim().toLowerCase() === party.name.trim().toLowerCase()));
        let totalBilled = 0;
        let totalPaid = 0;
        partyVouchers.forEach(v => {
            totalBilled += Number(v.grandTotal || 0);
            totalPaid += Number(v.paidAmount || 0);
        });
        const balanceDue = totalBilled - totalPaid;

        const companyName = this.company?.businessName || 'Our Company';
        const msg = `*Account Statement / Khata Summary*\n` +
            `Dear *${party.name}*,\n\n` +
            `Please find your statement of accounts from *${companyName}*:\n` +
            `• *Total Billed:* ${InvoiceEngine.formatCurrency(totalBilled)}\n` +
            `• *Total Paid:* ${InvoiceEngine.formatCurrency(totalPaid)}\n` +
            `• *Net Balance Outstanding:* ${InvoiceEngine.formatCurrency(balanceDue)}\n\n` +
            `Total Bills: ${partyVouchers.length}\n` +
            `Thank you for your business!`;

        const phone = party.phone ? party.phone.replace(/\D/g, '') : '';
        const encoded = encodeURIComponent(msg);
        const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
        window.open(url, '_blank');
        this.showToast('Opening WhatsApp with Khata statement...', 'info');
    }

    // ==========================================
    // OFFLINE CAMERA BARCODE SCANNER
    // ==========================================
    async openCameraScanner(callback) {
        this.onBarcodeDetected = callback;
        const modal = document.getElementById('camera-scanner-modal');
        if (!modal) return;
        modal.classList.add('active');

        const video = document.getElementById('camera-scanner-video');
        if (!video) return;

        try {
            const constraints = {
                video: {
                    facingMode: this.scannerFacingMode || 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.scannerMediaStream = stream;
            video.srcObject = stream;
            await video.play();

            this.startBarcodeDetectionLoop(video);
        } catch (err) {
            console.warn('Camera access denied or unavailable:', err);
            this.showToast('Camera unavailable. You can enter barcode/SKU manually below.', 'info');
            document.getElementById('scanner-manual-input')?.focus();
        }
    }

    startBarcodeDetectionLoop(video) {
        if (!('BarcodeDetector' in window)) {
            console.log('Native BarcodeDetector not supported in this WebView. Fallback to manual entry.');
            return;
        }

        try {
            const detector = new window.BarcodeDetector({
                formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e']
            });

            this._scannerActive = true;
            const scanFrame = async () => {
                if (!this._scannerActive || !video || video.paused || video.ended) return;
                try {
                    const barcodes = await detector.detect(video);
                    if (barcodes && barcodes.length > 0) {
                        const rawValue = barcodes[0].rawValue;
                        if (rawValue) {
                            this.handleScannedCode(rawValue);
                            return;
                        }
                    }
                } catch (e) {
                    // Ignored on non-fatal frame drop
                }
                if (this._scannerActive) {
                    requestAnimationFrame(scanFrame);
                }
            };
            requestAnimationFrame(scanFrame);
        } catch (e) {
            console.warn('BarcodeDetector initialization error:', e);
        }
    }

    handleScannedCode(code) {
        this.playScanBeep();
        this.stopCameraScanner();
        if (typeof this.onBarcodeDetected === 'function') {
            this.onBarcodeDetected(code.trim());
        }
    }

    stopCameraScanner() {
        this._scannerActive = false;
        if (this.scannerMediaStream) {
            this.scannerMediaStream.getTracks().forEach(track => track.stop());
            this.scannerMediaStream = null;
        }
        const video = document.getElementById('camera-scanner-video');
        if (video) video.srcObject = null;
        document.getElementById('camera-scanner-modal')?.classList.remove('active');
        const manualInput = document.getElementById('scanner-manual-input');
        if (manualInput) manualInput.value = '';
    }

    playScanBeep() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1046.5, audioCtx.currentTime); // High C
            osc.frequency.exponentialRampToValueAtTime(1318.5, audioCtx.currentTime + 0.1); // High E
            gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.12);
        } catch (e) {
            // Audio context blocked or not permitted
        }
    }

    handleBarcodeScannedForVoucher(code) {
        if (!code) return;
        const cleanCode = code.trim().toLowerCase();

        // 1. Exact barcode match or SKU match
        let matched = this.items.find(i => 
            (i.barcode && i.barcode.trim().toLowerCase() === cleanCode) ||
            (i.sku && i.sku.trim().toLowerCase() === cleanCode)
        );

        // 2. Fallback to name match
        if (!matched) {
            matched = this.items.find(i => i.name && i.name.toLowerCase().includes(cleanCode));
        }

        if (matched) {
            this.addItemRowToVoucher({
                itemId: matched.id,
                name: matched.name,
                hsn: matched.hsn || '',
                qty: 1,
                price: matched.wholesalePrice || matched.retailPrice || 0,
                taxRate: matched.taxRate !== undefined ? matched.taxRate : 18,
                discountPercent: 0,
                unit: matched.unit || 'Pcs'
            });
            this.updateVoucherCalculations();
            this.showToast(`✓ Added scanned product: ${matched.name}`, 'success');
        } else {
            this.showToast(`Product not found for "${code}". Add product first.`, 'info');
        }
    }

    // ==========================================
    // 1-CLICK BACKUP & RESTORE DATA (100% OFFLINE)
    // ==========================================
    async openBackupRestoreModal() {
        const statsEl = document.getElementById('backup-stats-summary');
        if (statsEl) {
            statsEl.innerHTML = `
                📊 Current Database: <strong>${this.vouchers.length}</strong> Invoices • 
                <strong>${this.items.length}</strong> Products • 
                <strong>${this.parties.length}</strong> Parties/Khata • 
                <strong>${this.company?.businessName || 'Default'}</strong>
            `;
        }
        document.getElementById('restore-preview-box')?.style.setProperty('display', 'none');
        const fileInput = document.getElementById('backup-file-input');
        if (fileInput) fileInput.value = '';
        this.pendingRestoreData = null;

        document.getElementById('backup-restore-modal')?.classList.add('active');
    }

    async exportBackup() {
        try {
            this.showToast('Creating full database backup...', 'info');
            const jsonString = await window.dbService.exportBackup();
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            const filename = `BillFlow_Backup_${yyyy}${mm}${dd}_${hh}${min}.json`;

            const blob = new Blob([jsonString], { type: 'application/json' });
            await this.deliverDownloadedFile(blob, filename, 'application/json');
            this.showToast(`✓ Backup saved: ${filename}`, 'success');
        } catch (e) {
            console.error('Backup error:', e);
            this.showToast('Backup failed: ' + e.message, 'error');
        }
    }

    async shareBackup() {
        try {
            this.showToast('Generating backup for sharing...', 'info');
            const jsonString = await window.dbService.exportBackup();
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            const filename = `BillFlow_Backup_${yyyy}${mm}${dd}_${hh}${min}.json`;

            const blob = new Blob([jsonString], { type: 'application/json' });

            // Deliver via Web Share or Native Downloader
            await this.deliverDownloadedFile(blob, filename, 'application/json');
            this.showToast('Backup file ready! Share via WhatsApp.', 'info');
        } catch (e) {
            console.error('Share backup error:', e);
            this.showToast('Share failed: ' + e.message, 'error');
        }
    }

    handleRestoreFileSelect(event) {
        const file = event.target?.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const data = JSON.parse(text);

                if (!data.version || !data.companies) {
                    throw new Error('File does not appear to be a valid BillFlow backup.');
                }

                this.pendingRestoreData = data;
                const previewBox = document.getElementById('restore-preview-box');
                const detailsEl = document.getElementById('restore-preview-details');

                const expDate = data.exportDate ? new Date(data.exportDate).toLocaleString() : 'Unknown date';
                const compName = data.companies?.[0]?.businessName || 'Unknown Business';
                const vCount = data.vouchers?.length || 0;
                const iCount = data.items?.length || 0;
                const pCount = data.parties?.length || 0;

                if (detailsEl) {
                    detailsEl.innerHTML = `
                        <div>📅 <strong>Exported:</strong> ${expDate}</div>
                        <div>🏢 <strong>Business:</strong> ${compName}</div>
                        <div>🧾 <strong>Invoices / Bills:</strong> ${vCount}</div>
                        <div>📦 <strong>Inventory Products:</strong> ${iCount}</div>
                        <div>👥 <strong>Customer / Vendors:</strong> ${pCount}</div>
                    `;
                }
                if (previewBox) previewBox.style.display = 'block';
                this.showToast('✓ Valid backup file selected! Click "Confirm & Restore" below.', 'success');
            } catch (err) {
                console.error('Invalid backup parse:', err);
                alert('Invalid backup file! Please select a valid BillFlow .json backup file.\nError: ' + err.message);
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    }

    handleRestoreFile(event) {
        return this.handleRestoreFileSelect(event);
    }

    async confirmRestoreData() {
        if (!this.pendingRestoreData) {
            alert('Please select a backup file first.');
            return;
        }

        const vCount = this.pendingRestoreData.vouchers?.length || 0;
        const iCount = this.pendingRestoreData.items?.length || 0;
        const pCount = this.pendingRestoreData.parties?.length || 0;

        const conf = confirm(
            `⚠️ RESTORE DATABASE FROM BACKUP?\n\n` +
            `This will restore:\n` +
            `• ${vCount} Invoices / Vouchers\n` +
            `• ${iCount} Products & Stock\n` +
            `• ${pCount} Customer / Vendor Khatas\n\n` +
            `Existing local data will be replaced by this backup.\nDo you want to proceed?`
        );
        if (!conf) return;

        try {
            this.showToast('Restoring database...', 'info');
            await window.dbService.restoreBackup(JSON.stringify(this.pendingRestoreData));
            this.pendingRestoreData = null;

            await this.loadAllState();
            this.renderHomeScreen();
            this.renderBillsScreen();
            this.renderProductsScreen();
            this.renderPartiesScreen();

            document.getElementById('backup-restore-modal')?.classList.remove('active');
            this.showToast(`✓ Database restored successfully! (${vCount} bills, ${iCount} items, ${pCount} parties)`, 'success');
        } catch (e) {
            console.error('Restore failure:', e);
            alert('Restore failed: ' + e.message);
        }
    }

    // ==========================================
    // GLOBAL APP EVENT LISTENERS
    // ==========================================
    bindEvents() {
        // Bottom Navigation Tabs
        document.querySelectorAll('.nav-tab-item').forEach(tab => {
            tab.addEventListener('click', () => {
                const screenId = tab.dataset.screen;
                this.switchScreen(screenId);
            });
        });

        // Top Sub-Tabs for Bills (Sales, Purchases, Quotations, More)
        document.querySelectorAll('#top-bar-bills .top-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#top-bar-bills .top-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentBillTab = btn.dataset.billTab;
                this.renderBillsScreen();
            });
        });

        // Pill Filter Chips in Bills
        document.querySelectorAll('.pill-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.pill-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.currentBillFilter = chip.dataset.filter;
                this.renderBillsScreen();
            });
        });

        // Top Sub-Tabs for Parties (Customers vs Vendors)
        document.querySelectorAll('#top-bar-parties .top-tab-btn, #top-bar-items-parties .top-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#top-bar-parties .top-tab-btn, #top-bar-items-parties .top-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentPartyTab = btn.dataset.partyTab;
                this.renderPartiesScreen();
            });
        });

        // Top Bar Quick Actions
        document.getElementById('btn-add-product-top')?.addEventListener('click', () => this.openItemModal());
        document.getElementById('btn-add-party-top')?.addEventListener('click', () => this.openPartyModal());
        document.getElementById('btn-create-invoice-top')?.addEventListener('click', () => this.openVoucherModal('sales_invoice'));
        document.getElementById('btn-profile-dropdown')?.addEventListener('click', () => this.openCompanyModal());

        // Search Toggles
        document.getElementById('btn-search-products-top')?.addEventListener('click', () => this.toggleProductSearch());
        document.getElementById('btn-search-parties-top')?.addEventListener('click', () => this.togglePartySearch());
        document.getElementById('btn-products-menu')?.addEventListener('click', () => this.openProductOptionsModal());
        document.getElementById('btn-parties-menu')?.addEventListener('click', () => this.cyclePartySort());

        // Product Excel Export Listeners
        document.getElementById('btn-export-products-excel-quick')?.addEventListener('click', () => this.downloadProductsExcel('xlsx'));
        document.getElementById('btn-modal-export-excel')?.addEventListener('click', () => this.downloadProductsExcel('xlsx'));
        document.getElementById('btn-modal-export-csv')?.addEventListener('click', () => this.downloadProductsExcel('csv'));
        document.getElementById('btn-pop-add-product')?.addEventListener('click', () => {
            document.getElementById('product-options-modal')?.classList.remove('active');
            this.openItemModal();
        });
        document.getElementById('btn-pop-sort-cycle')?.addEventListener('click', () => {
            this.cycleProductSort();
            const lbl = document.getElementById('prod-sort-label')?.textContent;
            this.showToast(`Products sorted by: ${lbl}`, 'info');
        });

        // Invoice Excel Export Listeners
        document.getElementById('btn-bills-menu')?.addEventListener('click', () => this.openInvoiceExportModal(30));
        document.getElementById('btn-export-bills-excel-quick')?.addEventListener('click', () => this.openInvoiceExportModal(30));
        document.getElementById('btn-export-invoices-excel-action')?.addEventListener('click', () => this.downloadInvoicesExcel('xlsx'));
        document.getElementById('btn-export-invoices-csv-action')?.addEventListener('click', () => this.downloadInvoicesExcel('csv'));

        // Days chips selection
        document.querySelectorAll('#inv-days-chips-container .days-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.setInvoiceExportDays(chip.dataset.days);
            });
        });

        // Stepper for custom days
        document.getElementById('btn-dec-custom-days')?.addEventListener('click', () => {
            const input = document.getElementById('input-custom-days-count');
            if (input) {
                const val = Math.max(1, (parseInt(input.value, 10) || 30) - 1);
                input.value = val;
                this.setInvoiceExportDays('custom');
            }
        });
        document.getElementById('btn-inc-custom-days')?.addEventListener('click', () => {
            const input = document.getElementById('input-custom-days-count');
            if (input) {
                const val = (parseInt(input.value, 10) || 30) + 1;
                input.value = val;
                this.setInvoiceExportDays('custom');
            }
        });
        document.getElementById('input-custom-days-count')?.addEventListener('input', (e) => {
            const days = parseInt(e.target.value, 10);
            if (days > 0) {
                const today = new Date();
                const toDateStr = today.toISOString().split('T')[0];
                const fromD = new Date();
                fromD.setDate(today.getDate() - (days - 1));
                const fromDateStr = fromD.toISOString().split('T')[0];
                const fromInput = document.getElementById('input-export-from-date');
                const toInput = document.getElementById('input-export-to-date');
                if (fromInput) fromInput.value = fromDateStr;
                if (toInput) toInput.value = toDateStr;
                this.updateInvoiceExportPreview();
            }
        });
        document.getElementById('input-export-from-date')?.addEventListener('change', () => this.updateInvoiceExportPreview());
        document.getElementById('input-export-to-date')?.addEventListener('change', () => this.updateInvoiceExportPreview());
        document.getElementById('inv-export-voucher-type')?.addEventListener('change', () => this.updateInvoiceExportPreview());
        document.getElementById('inv-export-payment-status')?.addEventListener('change', () => this.updateInvoiceExportPreview());

        // Live Search Inputs
        document.getElementById('products-search-input')?.addEventListener('input', (e) => this.renderProductsScreen(e.target.value));
        document.getElementById('parties-search-input')?.addEventListener('input', (e) => this.renderPartiesScreen(e.target.value));

        // Sub Bar Sort & Filter Buttons
        document.getElementById('prod-sort-btn')?.addEventListener('click', () => this.cycleProductSort());
        document.getElementById('prod-filter-btn')?.addEventListener('click', () => this.cycleProductFilter());
        document.getElementById('party-sort-btn')?.addEventListener('click', () => this.cyclePartySort());
        document.getElementById('party-filter-btn')?.addEventListener('click', () => this.cyclePartyFilter());

        // Party KPI Pills
        document.getElementById('party-kpi-collect-btn')?.addEventListener('click', () => this.filterPartiesCollect());
        document.getElementById('party-kpi-pay-btn')?.addEventListener('click', () => this.filterPartiesPay());

        // Home View Bills Link
        document.getElementById('btn-home-view-bills')?.addEventListener('click', () => {
            this.switchScreen('screen-bills');
        });

        // Date Dropdown Filters
        document.getElementById('bills-date-dropdown')?.addEventListener('click', () => this.cycleDateFilter());
        document.querySelector('.home-summary-card .dropdown-filter-btn')?.addEventListener('click', () => this.cycleDateFilter());

        // Home Quick Create Grid Items
        document.getElementById('act-invoice')?.addEventListener('click', () => this.openVoucherModal('sales_invoice'));
        document.getElementById('act-purchase')?.addEventListener('click', () => this.openVoucherModal('purchase_invoice'));
        document.getElementById('act-quotation')?.addEventListener('click', () => this.openVoucherModal('estimate'));
        document.getElementById('act-expenses')?.addEventListener('click', () => this.openVoucherModal('expense'));
        document.getElementById('act-challan')?.addEventListener('click', () => this.openVoucherModal('delivery_challan'));
        document.getElementById('act-credit-note')?.addEventListener('click', () => this.openVoucherModal('credit_note'));
        document.getElementById('act-sales-order')?.addEventListener('click', () => this.openVoucherModal('sales_order'));
        document.getElementById('act-more-create')?.addEventListener('click', () => {
            document.getElementById('more-create-modal')?.classList.add('active');
        });
        document.getElementById('btn-quick-new-inv')?.addEventListener('click', () => this.openVoucherModal('sales_invoice'));

        // Quick Access Items on Home
        document.getElementById('qa-eway')?.addEventListener('click', () => this.openEwayModal());
        document.getElementById('qa-einvoice')?.addEventListener('click', () => this.openEwayModal());
        document.getElementById('qa-timeline')?.addEventListener('click', () => {
            this.switchScreen('screen-bills');
            this.showToast('Showing all transaction vouchers', 'info');
        });
        document.getElementById('qa-reports')?.addEventListener('click', () => {
            this.switchScreen('screen-bills');
        });
        document.getElementById('qa-insights')?.addEventListener('click', () => this.openInsightsModal());
        document.getElementById('qa-backup')?.addEventListener('click', () => this.exportBackup());
        document.getElementById('qa-signature')?.addEventListener('click', () => this.openSignatureModal('company'));
        document.getElementById('qa-settings')?.addEventListener('click', () => this.openCompanyModal());

        // FAB Actions
        document.getElementById('global-fab-btn')?.addEventListener('click', () => {
            if (this.currentScreen === 'screen-products' || (this.currentScreen === 'screen-items-parties' && this.currentItemsPartiesSubTab === 'products')) {
                this.openItemModal();
            } else {
                this.openVoucherModal('sales_invoice');
            }
        });

        document.getElementById('parties-fab-btn')?.addEventListener('click', () => {
            this.openPartyModal();
        });

        // More Screen Items
        document.getElementById('menu-company-details')?.addEventListener('click', () => this.openCompanyModal());
        document.getElementById('menu-digital-sig')?.addEventListener('click', () => this.openSignatureModal('company'));
        document.getElementById('menu-export-products-excel')?.addEventListener('click', () => this.openProductOptionsModal());
        document.getElementById('menu-export-invoices-excel')?.addEventListener('click', () => this.openInvoiceExportModal(30));
        document.getElementById('menu-backup')?.addEventListener('click', () => this.openBackupRestoreModal());
        document.getElementById('menu-restore')?.addEventListener('click', () => this.openBackupRestoreModal());
        document.getElementById('menu-doc-settings')?.addEventListener('click', () => this.openDocSettingsModal());
        document.getElementById('menu-preferences')?.addEventListener('click', () => this.showPreferencesInfo());
        document.getElementById('menu-templates')?.addEventListener('click', () => this.openTemplatesSelector());
        document.getElementById('menu-theme')?.addEventListener('click', () => this.toggleTheme());
        document.getElementById('btn-quick-theme-toggle')?.addEventListener('click', () => this.toggleTheme());
        document.getElementById('btn-quick-theme-toggle-more')?.addEventListener('click', () => this.toggleTheme());

        // Backup & Restore Modal Actions
        document.getElementById('btn-do-backup-export')?.addEventListener('click', () => this.exportBackup());
        document.getElementById('btn-do-backup-share')?.addEventListener('click', () => this.shareBackup());
        document.getElementById('btn-trigger-file-restore')?.addEventListener('click', () => {
            document.getElementById('backup-file-input')?.click();
        });
        document.getElementById('backup-file-input')?.addEventListener('change', (e) => this.handleRestoreFileSelect(e));
        document.getElementById('btn-confirm-restore-now')?.addEventListener('click', () => this.confirmRestoreData());

        // Low Stock Filter Chips
        document.getElementById('chip-filter-all-stock')?.addEventListener('click', () => {
            this.stockFilterMode = 'all';
            document.getElementById('chip-filter-all-stock')?.classList.add('active');
            document.getElementById('chip-filter-low-stock')?.classList.remove('active');
            this.renderProductsScreen();
        });
        document.getElementById('chip-filter-low-stock')?.addEventListener('click', () => {
            this.stockFilterMode = 'low_stock';
            document.getElementById('chip-filter-low-stock')?.classList.add('active');
            document.getElementById('chip-filter-all-stock')?.classList.remove('active');
            this.renderProductsScreen();
        });

        // Barcode Scanner Triggers
        document.getElementById('btn-scan-barcode-voucher')?.addEventListener('click', () => {
            this.openCameraScanner((code) => this.handleBarcodeScannedForVoucher(code));
        });
        document.getElementById('btn-scan-barcode-item')?.addEventListener('click', () => {
            this.openCameraScanner((code) => {
                document.getElementById('iform-barcode').value = code;
                this.showToast(`Scanned Barcode: ${code}`, 'success');
            });
        });
        document.getElementById('btn-close-scanner')?.addEventListener('click', () => this.stopCameraScanner());
        document.getElementById('btn-scanner-switch-camera')?.addEventListener('click', () => {
            this.scannerFacingMode = this.scannerFacingMode === 'environment' ? 'user' : 'environment';
            this.stopCameraScanner();
            this.openCameraScanner(this.onBarcodeDetected);
        });
        document.getElementById('btn-scanner-manual-submit')?.addEventListener('click', () => {
            const val = document.getElementById('scanner-manual-input')?.value?.trim();
            if (val) this.handleScannedCode(val);
        });

        // Party Ledger Statement Buttons
        document.getElementById('btn-ledger-download-pdf')?.addEventListener('click', () => this.exportPartyStatementPdf());
        document.getElementById('btn-ledger-whatsapp')?.addEventListener('click', () => this.sharePartyStatementWhatsApp());

        // Print Copy Selector
        document.getElementById('print-copy-selector')?.addEventListener('change', (e) => {
            this.activeInvoiceCopy = e.target.value;
            if (this.activeVoucherForPrint) {
                const party = this.parties.find(p => p.id === this.activeVoucherForPrint.partyId);
                this.renderPrintDocument(this.activeVoucherForPrint, this.company, party);
            }
        });

        // Notification buttons
        document.querySelectorAll('button[title="Notifications"]').forEach(btn => {
            btn.addEventListener('click', () => this.showToast('100% Offline Mode: All data is saved securely on your device.', 'info'));
        });

        // Direct Save Buttons & Form Submit Handlers
        document.getElementById('btn-save-item')?.addEventListener('click', (e) => this.saveItem(e));
        document.getElementById('item-form')?.addEventListener('submit', (e) => this.saveItem(e));

        document.getElementById('btn-save-party')?.addEventListener('click', (e) => this.saveParty(e));
        document.getElementById('party-form')?.addEventListener('submit', (e) => this.saveParty(e));

        // Party Address Copy / Sync Listeners
        const sameAddrCheck = document.getElementById('pform-same-address');
        const billingAddrInput = document.getElementById('pform-billing-address');

        sameAddrCheck?.addEventListener('change', () => {
            this.syncPartyAddressFields();
            if (!sameAddrCheck.checked) {
                const delivEl = document.getElementById('pform-delivery-address');
                delivEl?.focus();
            }
        });

        billingAddrInput?.addEventListener('input', () => {
            if (document.getElementById('pform-same-address')?.checked) {
                this.syncPartyAddressFields();
            }
        });

        document.getElementById('btn-save-company')?.addEventListener('click', (e) => this.saveCompanyProfile(e));
        document.getElementById('company-profile-form')?.addEventListener('submit', (e) => this.saveCompanyProfile(e));

        // Company Logo File Upload Listener
        document.getElementById('set-company-logo-file')?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                alert('Please select an image file (PNG, JPG, SVG, WebP).');
                return;
            }

            const reader = new FileReader();
            reader.onload = (evt) => {
                const rawDataUrl = evt.target.result;
                const img = new Image();
                img.onload = () => {
                    const maxDim = 600;
                    let width = img.width;
                    let height = img.height;
                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        this.pendingCompanyLogo = canvas.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.92);
                    } else {
                        this.pendingCompanyLogo = rawDataUrl;
                    }

                    const imgPreview = document.getElementById('company-logo-img-preview');
                    const placeholder = document.getElementById('company-logo-placeholder-icon');
                    const removeBtn = document.getElementById('btn-remove-company-logo');

                    if (imgPreview) {
                        imgPreview.src = this.pendingCompanyLogo;
                        imgPreview.style.display = 'block';
                    }
                    if (placeholder) placeholder.style.display = 'none';
                    if (removeBtn) removeBtn.style.display = 'inline-flex';
                    this.showToast('Company logo loaded. Click "Save Settings" to apply.', 'info');
                };
                img.onerror = () => {
                    this.pendingCompanyLogo = rawDataUrl;
                    const imgPreview = document.getElementById('company-logo-img-preview');
                    if (imgPreview) {
                        imgPreview.src = rawDataUrl;
                        imgPreview.style.display = 'block';
                    }
                    document.getElementById('company-logo-placeholder-icon')?.style.setProperty('display', 'none');
                    document.getElementById('btn-remove-company-logo')?.style.setProperty('display', 'inline-flex');
                };
                img.src = rawDataUrl;
            };
            reader.readAsDataURL(file);
        });

        // Company Logo Remove Listener
        document.getElementById('btn-remove-company-logo')?.addEventListener('click', () => {
            this.pendingCompanyLogo = '';
            const imgPreview = document.getElementById('company-logo-img-preview');
            const placeholder = document.getElementById('company-logo-placeholder-icon');
            const removeBtn = document.getElementById('btn-remove-company-logo');
            const fileInput = document.getElementById('set-company-logo-file');

            if (imgPreview) {
                imgPreview.src = '';
                imgPreview.style.display = 'none';
            }
            if (placeholder) placeholder.style.display = 'block';
            if (removeBtn) removeBtn.style.display = 'none';
            if (fileInput) fileInput.value = '';
            this.showToast('Company logo removed.', 'info');
        });

        document.getElementById('btn-save-doc-settings')?.addEventListener('click', (e) => this.saveDocSettings(e));
        document.getElementById('doc-settings-form')?.addEventListener('submit', (e) => this.saveDocSettings(e));

        document.getElementById('btn-generate-eway')?.addEventListener('click', () => this.generateEwaySlip());

        // Voucher Handlers
        document.getElementById('btn-add-item-row')?.addEventListener('click', () => this.addItemRowToVoucher());
        document.getElementById('btn-voucher-quick-add-party')?.addEventListener('click', () => this.openPartyModal());
        document.getElementById('vform-party-select')?.addEventListener('change', () => this.onVoucherPartyChange());
        document.getElementById('vform-paid-amount')?.addEventListener('input', () => this.updateVoucherCalculations());

        // Voucher Transporter Freight Listeners
        const vTransCheck = document.getElementById('vform-has-transporter');
        const vTransSec = document.getElementById('vform-transporter-section');
        vTransCheck?.addEventListener('change', () => {
            if (vTransSec) vTransSec.style.display = vTransCheck.checked ? 'block' : 'none';
            this.updateVoucherCalculations();
            if (vTransCheck.checked) {
                document.getElementById('vform-transporter-name')?.focus();
            }
        });
        document.getElementById('vform-transporter-cost')?.addEventListener('input', () => this.updateVoucherCalculations());
        document.getElementById('vform-transporter-gst')?.addEventListener('change', () => this.updateVoucherCalculations());

        document.getElementById('btn-save-voucher-only')?.addEventListener('click', () => this.saveVoucher(false));
        document.getElementById('btn-save-and-print')?.addEventListener('click', () => this.saveVoucher(true));

        // Voucher Type Switch in Modal
        document.getElementById('vform-type')?.addEventListener('change', (e) => {
            const val = e.target.value;
            let prefix = 'INV-26/';
            if (val === 'purchase_invoice') prefix = 'PUR-26/';
            else if (val === 'estimate') prefix = 'EST-26/';
            else if (val === 'delivery_challan') prefix = 'DC-26/';
            else if (val === 'credit_note') prefix = 'CN-26/';
            else if (val === 'debit_note') prefix = 'DN-26/';
            else if (val === 'expense') prefix = 'EXP-26/';
            else if (val === 'sales_order') prefix = 'SO-26/';
            document.getElementById('vform-no').value = InvoiceEngine.generateNextVoucherNo(this.vouchers, prefix);
        });

        // Print & Share
        document.getElementById('print-template-selector')?.addEventListener('change', (e) => {
            this.activePrintTemplate = e.target.value;
            if (this.activeVoucherForPrint) {
                const party = this.parties.find(p => p.id === this.activeVoucherForPrint.partyId);
                this.renderPrintDocument(this.activeVoucherForPrint, this.company, party);
            }
        });
        document.getElementById('print-font-selector')?.addEventListener('change', (e) => {
            this.activePrintFont = e.target.value;
            if (this.activeVoucherForPrint) {
                const party = this.parties.find(p => p.id === this.activeVoucherForPrint.partyId);
                this.renderPrintDocument(this.activeVoucherForPrint, this.company, party);
            }
        });
        document.getElementById('print-font-size-selector')?.addEventListener('change', (e) => {
            this.activePrintScale = e.target.value;
            if (this.activeVoucherForPrint) {
                const party = this.parties.find(p => p.id === this.activeVoucherForPrint.partyId);
                this.renderPrintDocument(this.activeVoucherForPrint, this.company, party);
            }
        });
        document.getElementById('btn-print-trigger')?.addEventListener('click', () => this.triggerPrint());
        document.getElementById('btn-print-whatsapp')?.addEventListener('click', () => this.shareInvoicePdf());
        document.getElementById('btn-download-pdf')?.addEventListener('click', () => this.downloadInvoicePdf());
        document.getElementById('btn-print-edit-terms')?.addEventListener('click', () => this.openTermsModal());
        document.getElementById('btn-print-edit-footer')?.addEventListener('click', () => this.openFooterModal());
        document.getElementById('btn-print-modify-invoice')?.addEventListener('click', () => {
            if (this.activeVoucherForPrint) {
                this.editVoucher(this.activeVoucherForPrint.id);
            }
        });
        document.getElementById('btn-print-delete-invoice')?.addEventListener('click', () => {
            if (this.activeVoucherForPrint) {
                this.deleteVoucherPrompt(this.activeVoucherForPrint.id);
            }
        });
        document.getElementById('btn-open-sig-modal')?.addEventListener('click', () => this.openSignatureModal('voucher'));


        // Terms & Conditions Modal Listeners
        document.getElementById('menu-edit-terms')?.addEventListener('click', () => this.openTermsModal());
        document.getElementById('btn-export-modal-edit-terms')?.addEventListener('click', () => this.openTermsModal());
        document.getElementById('btn-save-terms-modal')?.addEventListener('click', () => this.saveTermsModal());
        document.querySelectorAll('.terms-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.applyTermsPreset(btn.dataset.preset);
            });
        });

        // Invoice Footer Modal Listeners
        document.getElementById('menu-edit-footer')?.addEventListener('click', () => this.openFooterModal());
        document.getElementById('btn-save-footer-modal')?.addEventListener('click', () => this.saveFooterModal());
        document.querySelectorAll('.footer-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.applyFooterPreset(btn.dataset.preset);
            });
        });

        // Tax Invoice Tab (Voucher Modal) Terms & Footer Quick Action Presets
        document.getElementById('btn-vform-terms-standard')?.addEventListener('click', () => {
            const el = document.getElementById('vform-terms');
            if (el) el.value = '1. Goods once sold will not be taken back or exchanged.\n2. Payment terms: 30 days net from invoice date.\n3. Interest @ 18% p.a. will be levied on overdue payments.\n4. All disputes are subject to local jurisdiction only.';
        });
        document.getElementById('btn-vform-terms-service')?.addEventListener('click', () => {
            const el = document.getElementById('vform-terms');
            if (el) el.value = '1. Invoices are payable upon receipt or milestone completion.\n2. Intellectual property transfers upon receipt of full settlement.\n3. Service warranty valid for 30 days from sign-off.\n4. All disputes subject to arbitration under local jurisdiction.';
        });
        document.getElementById('btn-vform-terms-clear')?.addEventListener('click', () => {
            const el = document.getElementById('vform-terms');
            if (el) el.value = '';
        });

        document.getElementById('btn-vform-footer-thanks')?.addEventListener('click', () => {
            const el = document.getElementById('vform-footer');
            if (el) el.value = 'Thank you for your business! We appreciate your partnership.';
        });
        document.getElementById('btn-vform-footer-jurisdiction')?.addEventListener('click', () => {
            const el = document.getElementById('vform-footer');
            if (el) el.value = 'All disputes are subject to local jurisdiction only.';
        });
        document.getElementById('btn-vform-footer-clear')?.addEventListener('click', () => {
            const el = document.getElementById('vform-footer');
            if (el) el.value = '';
        });

        // Payment Status Modal & Print Action Listeners
        document.getElementById('btn-print-pay-status')?.addEventListener('click', () => {
            if (this.activeVoucherForPrint) {
                this.openPaymentStatusModal(this.activeVoucherForPrint.id);
            }
        });

        document.getElementById('btn-paystatus-paid')?.addEventListener('click', () => {
            const vId = document.getElementById('paystatus-voucher-id')?.value;
            const voucher = this.vouchers.find(v => v.id === vId);
            const total = Number(voucher?.grandTotal || 0);
            this.setPaymentStatusModalActiveState('paid', total, total);
        });

        document.getElementById('btn-paystatus-due')?.addEventListener('click', () => {
            const vId = document.getElementById('paystatus-voucher-id')?.value;
            const voucher = this.vouchers.find(v => v.id === vId);
            const total = Number(voucher?.grandTotal || 0);
            this.setPaymentStatusModalActiveState('unpaid', total, 0);
        });

        document.getElementById('btn-paystatus-partial')?.addEventListener('click', () => {
            const vId = document.getElementById('paystatus-voucher-id')?.value;
            const voucher = this.vouchers.find(v => v.id === vId);
            const total = Number(voucher?.grandTotal || 0);
            let currentPaid = Number(document.getElementById('paystatus-paid-input')?.value);
            if (!currentPaid || currentPaid >= total) currentPaid = Math.round((total / 2) * 100) / 100;
            const input = document.getElementById('paystatus-paid-input');
            if (input) input.value = currentPaid.toFixed(2);
            this.setPaymentStatusModalActiveState('partial', total, currentPaid);
        });

        const handlePctClick = (pct) => {
            const vId = document.getElementById('paystatus-voucher-id')?.value;
            const voucher = this.vouchers.find(v => v.id === vId);
            const total = Number(voucher?.grandTotal || 0);
            const amount = Math.round((total * pct) * 100) / 100;
            const input = document.getElementById('paystatus-paid-input');
            if (input) input.value = amount.toFixed(2);
            const status = pct === 1 ? 'paid' : (pct === 0 ? 'unpaid' : 'partial');
            this.setPaymentStatusModalActiveState(status, total, amount);
        };

        document.getElementById('btn-pay-pct-25')?.addEventListener('click', () => handlePctClick(0.25));
        document.getElementById('btn-pay-pct-50')?.addEventListener('click', () => handlePctClick(0.50));
        document.getElementById('btn-pay-pct-75')?.addEventListener('click', () => handlePctClick(0.75));
        document.getElementById('btn-pay-pct-100')?.addEventListener('click', () => handlePctClick(1.00));

        document.getElementById('paystatus-paid-input')?.addEventListener('input', (e) => {
            const vId = document.getElementById('paystatus-voucher-id')?.value;
            const voucher = this.vouchers.find(v => v.id === vId);
            const total = Number(voucher?.grandTotal || 0);
            const entered = Number(e.target.value) || 0;
            const bal = Math.max(0, Math.round((total - entered) * 100) / 100);
            const balEl = document.getElementById('paystatus-balance-due');
            if (balEl) balEl.textContent = InvoiceEngine.formatCurrency(bal);

            let derivedStatus = 'partial';
            if (entered >= total && total > 0) derivedStatus = 'paid';
            else if (entered <= 0) derivedStatus = 'unpaid';
            this.currentModalPayStatus = derivedStatus;

            const btnPaid = document.getElementById('btn-paystatus-paid');
            const btnPartial = document.getElementById('btn-paystatus-partial');
            const btnDue = document.getElementById('btn-paystatus-due');
            [btnPaid, btnPartial, btnDue].forEach(b => {
                if (b) {
                    b.style.opacity = '0.5';
                    b.style.transform = 'scale(0.96)';
                    b.style.boxShadow = 'none';
                }
            });
            if (derivedStatus === 'paid' && btnPaid) {
                btnPaid.style.opacity = '1';
                btnPaid.style.transform = 'scale(1.02)';
                btnPaid.style.boxShadow = '0 0 0 2px #16a34a';
            } else if (derivedStatus === 'unpaid' && btnDue) {
                btnDue.style.opacity = '1';
                btnDue.style.transform = 'scale(1.02)';
                btnDue.style.boxShadow = '0 0 0 2px #dc2626';
            } else if (btnPartial) {
                btnPartial.style.opacity = '1';
                btnPartial.style.transform = 'scale(1.02)';
                btnPartial.style.boxShadow = '0 0 0 2px #d97706';
            }
        });

        document.getElementById('btn-save-payment-status')?.addEventListener('click', async () => {
            const vId = document.getElementById('paystatus-voucher-id')?.value;
            if (!vId) return;
            const voucher = this.vouchers.find(v => v.id === vId);
            if (!voucher) return;

            const grandTotal = Number(voucher.grandTotal || 0);
            const enteredPaid = Number(document.getElementById('paystatus-paid-input')?.value) || 0;
            let status = this.currentModalPayStatus || 'partial';
            if (status === 'partial') {
                if (enteredPaid >= grandTotal && grandTotal > 0) status = 'paid';
                else if (enteredPaid <= 0) status = 'unpaid';
            }

            await this.updateVoucherPaymentStatus(vId, status, enteredPaid);
            document.getElementById('payment-status-modal')?.classList.remove('active');
        });

        // Modal Close buttons
        document.querySelectorAll('.modal-close-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.dataset.close;
                if (modalId) document.getElementById(modalId)?.classList.remove('active');
            });
        });

        // Modal background click to close
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });

        // Backup file input
        document.getElementById('backup-file-input')?.addEventListener('change', (e) => this.handleRestoreFile(e));

        // Bills search input
        document.getElementById('bills-search-input')?.addEventListener('input', (e) => {
            this.renderBillsScreen(e.target.value);
        });

        // Bills Batch Selection & Delete Listeners
        document.getElementById('btn-bills-select-mode')?.addEventListener('click', () => this.toggleBillsSelectMode());
        document.getElementById('btn-bills-select-all')?.addEventListener('click', () => this.selectAllVouchers());
        document.getElementById('btn-bills-delete-selected')?.addEventListener('click', () => this.deleteSelectedVouchers());
        document.getElementById('btn-bills-cancel-select')?.addEventListener('click', () => this.toggleBillsSelectMode());
    }
}

// Start mobile application
document.addEventListener('DOMContentLoaded', () => {
    window.app = new BillFlowMobileApp();
    window.app.init();
});
