# BillFlow (Bill_Flow) 🧾✨

> **Smart GST Invoicing, Inventory & Khata Ledger Management App**  
> Built for fast, modern, and offline-first mobile & web business operations.

---

## 🚀 Overview

**BillFlow** is a complete, offline-first billing and accounting solution designed for retail shops, wholesalers, distributors, and service providers. It empowers businesses to create professional GST/Non-GST invoices, track customer & vendor ledgers (Khata), monitor real-time stock inventory, and print thermal POS or A4 invoices in seconds.

---

## ✨ Features

- **📑 Multi-Document Creation**:
  - Sales Invoices (GST & Non-GST)
  - Purchase Orders & Bills
  - Quotations & Estimates
  - Delivery Challans
  - Credit Notes & Sales Orders
  - Expense Tracking

- **🎨 Multi-Format Invoice Printing**:
  - **Classic A4 / Modern Minimalist**: High-resolution print with company logo, digital signature & stamp.
  - **Thermal POS (58mm / 80mm)**: Optimized for fast receipt printers.
  - **Dot Matrix / Transport Format**: High-density format for logistics and industrial billing.

- **📦 Inventory & Stock Control**:
  - Automatic inventory deduction on sales.
  - Stock replenishment on bill deletion or return.
  - Low-stock alerts and threshold notifications.
  - Category, HSN code, and unit tracking.

- **👥 Khata Book & Party Ledgers**:
  - Complete customer & vendor balance tracking.
  - Payment in/out recording.
  - Automatic balance updates and ledger statements.

- **🗑️ Batch Management & Deletion**:
  - Multi-select invoices for batch deletion.
  - Safe rollback of stock and ledger balances upon invoice removal.

- **📊 Reports & Data Exports**:
  - Excel (.xlsx) export for sales, purchases, and inventory reports.
  - PDF generation and native Android sharing.
  - Full JSON backup and restore for zero data loss.

- **⚡ Offline-First Architecture**:
  - Runs 100% offline using client-side **IndexedDB**.
  - Powered by **Capacitor 8** for native Android performance.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla JavaScript (ES6+), Modern Responsive CSS
- **Local Database**: IndexedDB (Offline storage)
- **Mobile Runtime**: [Capacitor 8](https://capacitorjs.com/) (Android)
- **Export Libraries**: SheetJS (xlsx), html2pdf.js

---

## 📱 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- Android Studio & Android SDK (for Android build)

### Installation

`ash
# Clone the repository
git clone https://github.com/abhaysharma000/Bill_Flow.git
cd Bill_Flow

# Install dependencies
npm install

# Build web assets and sync to Android
npm run build
`

### Running on Android

`ash
# Open in Android Studio
npx cap open android

# Or build the debug APK directly via command line
cd android
./gradlew assembleDebug
`

---

## 📄 License

ISC License
