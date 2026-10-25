/**
 * BillFlow DB - High-Performance Offline-First IndexedDB Persistence Engine
 * Designed for Manufacturing, Wholesale, and Distribution Businesses
 */

const DB_NAME = 'BillFlow_Enterprise_DB';
const DB_VERSION = 1;

class DatabaseService {
    constructor() {
        this.db = null;
        this.isReady = false;
    }

    async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 1. Company Profile
                if (!db.objectStoreNames.contains('companies')) {
                    db.createObjectStore('companies', { keyPath: 'id' });
                }

                // 2. Items & Inventory (Raw materials, finished goods, godowns)
                if (!db.objectStoreNames.contains('items')) {
                    const itemStore = db.createObjectStore('items', { keyPath: 'id' });
                    itemStore.createIndex('name', 'name', { unique: false });
                    itemStore.createIndex('sku', 'sku', { unique: false });
                    itemStore.createIndex('category', 'category', { unique: false });
                    itemStore.createIndex('isRawMaterial', 'isRawMaterial', { unique: false });
                }

                // 3. Parties (Customers & Suppliers)
                if (!db.objectStoreNames.contains('parties')) {
                    const partyStore = db.createObjectStore('parties', { keyPath: 'id' });
                    partyStore.createIndex('name', 'name', { unique: false });
                    partyStore.createIndex('phone', 'phone', { unique: false });
                    partyStore.createIndex('type', 'type', { unique: false });
                    partyStore.createIndex('currentBalance', 'currentBalance', { unique: false });
                }

                // 4. Vouchers (Invoices, Quotations, Purchase, Challans, Credit/Debit Notes)
                if (!db.objectStoreNames.contains('vouchers')) {
                    const voucherStore = db.createObjectStore('vouchers', { keyPath: 'id' });
                    voucherStore.createIndex('voucherNo', 'voucherNo', { unique: true });
                    voucherStore.createIndex('voucherType', 'voucherType', { unique: false });
                    voucherStore.createIndex('partyId', 'partyId', { unique: false });
                    voucherStore.createIndex('date', 'date', { unique: false });
                    voucherStore.createIndex('paymentStatus', 'paymentStatus', { unique: false });
                }

                // 5. Payments (Payment-In, Payment-Out)
                if (!db.objectStoreNames.contains('payments')) {
                    const payStore = db.createObjectStore('payments', { keyPath: 'id' });
                    payStore.createIndex('partyId', 'partyId', { unique: false });
                    payStore.createIndex('date', 'date', { unique: false });
                    payStore.createIndex('type', 'type', { unique: false });
                }

                // 6. Warehouses / Godowns
                if (!db.objectStoreNames.contains('godowns')) {
                    db.createObjectStore('godowns', { keyPath: 'id' });
                }

                // 7. System Settings
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };

            request.onsuccess = async (event) => {
                this.db = event.target.result;
                this.isReady = true;
                await this.seedInitialDataIfEmpty();
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB Error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // Generic CRUD Operations
    async getAll(storeName) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async getById(storeName, id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async get(storeName, id) {
        return this.getById(storeName, id);
    }

    async put(storeName, item) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(item);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async delete(storeName, id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.delete(id);
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    async clear(storeName) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.clear();
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }

    // Initialize clean blank database on first time launch
    async seedInitialDataIfEmpty() {
        const companies = await this.getAll('companies');
        if (companies.length > 0) return; // Already exists

        console.log('Initializing fresh clean zero-state database...');
        await this.resetAllDataToZero();
    }

    // Completely wipe all data and reset to 0
    async resetAllDataToZero() {
        await this.clear('items');
        await this.clear('parties');
        await this.clear('vouchers');
        await this.clear('payments');
        
        // Setup clean starter company (empty fields for user to fill)
        const cleanCompany = {
            id: 'comp_primary',
            businessName: 'My Enterprise',
            tagline: '',
            gstin: '',
            pan: '',
            phone: '',
            email: '',
            website: '',
            address: '',
            city: '',
            state: '',
            pincode: '',
            stateCode: '',
            bankDetails: {
                bankName: '',
                accountName: '',
                accountNumber: '',
                ifscCode: '',
                branch: '',
                upiId: ''
            },
            invoicePrefix: 'INV-01/',
            estimatePrefix: 'EST-01/',
            poPrefix: 'PO-01/',
            dcPrefix: 'DC-01/',
            termsAndConditions: '1. Goods once sold will not be taken back.\n2. Payment terms as agreed.\n3. E.&O.E.',
            footerText: '',
            signatureTitle: 'Authorised Signatory',
            signatureUrl: ''
        };
        await this.put('companies', cleanCompany);

        // Default warehouse
        const defaultGodown = {
            id: 'godown_primary',
            name: 'Main Warehouse',
            location: 'Factory Floor',
            isDefault: true
        };
        await this.clear('godowns');
        await this.put('godowns', defaultGodown);

        // Settings
        await this.put('settings', { key: 'theme', value: 'dark' });
        await this.put('settings', { key: 'currency', value: '₹' });
        await this.put('settings', { key: 'thermalWidth', value: '80mm' });
        await this.put('settings', { key: 'defaultInvoiceTheme', value: 'modern_gst' });

        console.log('Database successfully initialized to clean zero state.');
    }

    // Export entire database as JSON (Full Local Backup)
    async exportBackup() {
        await this.init();
        const backup = {
            version: 1,
            exportDate: new Date().toISOString(),
            companies: await this.getAll('companies'),
            items: await this.getAll('items'),
            parties: await this.getAll('parties'),
            vouchers: await this.getAll('vouchers'),
            payments: await this.getAll('payments'),
            godowns: await this.getAll('godowns'),
            settings: await this.getAll('settings')
        };
        return JSON.stringify(backup, null, 2);
    }

    // Restore from JSON backup file
    async restoreBackup(jsonString) {
        await this.init();
        const data = JSON.parse(jsonString);

        if (!data.version || !data.companies) {
            throw new Error('Invalid backup file structure.');
        }

        const stores = ['companies', 'items', 'parties', 'vouchers', 'payments', 'godowns', 'settings'];
        for (const s of stores) {
            await this.clear(s);
            if (data[s] && Array.isArray(data[s])) {
                for (const item of data[s]) {
                    await this.put(s, item);
                }
            }
        }
        return true;
    }
}

// Export singleton
window.dbService = new DatabaseService();
