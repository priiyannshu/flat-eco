# FlatEco 🍱🏠 — Bachelor Flat Tiffin, Rent & Shared Ledger PWA

A Progressive Web App (PWA) built for bachelor apartment roommates and landlords/caretakers. Deployed natively on **Cloudflare Workers** with **Cloudflare D1 (Edge SQLite)** and full **Offline-First PWA caching + IndexedDB Sync**.

---

## 🌐 Live Production Deployment
- **Live PWA App:** [https://flat-eco.priyanshukh1201.workers.dev](https://flat-eco.priyanshukh1201.workers.dev)
- **Cloudflare Edge Region:** APAC
- **D1 Database Binding:** `flat-eco-db` (`39d99c25-9249-4a23-91d3-c7f236ed6ab2`)

---

## 📱 How to Install as an App (PWA)
1. Open [https://flat-eco.priyanshukh1201.workers.dev](https://flat-eco.priyanshukh1201.workers.dev) on Chrome / Safari on your mobile phone or desktop.
2. Tap the browser menu (three dots `⋮` on Android Chrome or Share button on iOS Safari).
3. Select **"Install App"** or **"Add to Home Screen"**.
4. FlatEco will install as a standalone mobile app with its custom icon, splash screen, and offline support.

---

## 👥 5 Profiles & Role-Based Access
FlatEco comes pre-seeded with 5 profiles (switchable via the profile picker at the top right):
1. **Apartment Owner / Caretaker (`owner`)**:
   - Master ledger view of all 4 roommates + Extras.
   - Ability to tick rent as Paid/Pending for any tenant and record payment mode (UPI, Cash, Bank Transfer).
   - Ability to upload monthly electricity bills with attached photo receipts.
   - Ability to issue and transmit official receipts in-app to any tenant.
2. **Priyanshu (`tenant_1`)**: Private ledger, rent status, personal tiffin breakdown.
3. **Sushil (`tenant_2`)**: Private ledger, rent status, personal tiffin breakdown.
4. **Varsh (`tenant_3`)**: Private ledger, rent status, personal tiffin breakdown.
5. **Sunny (`tenant_4`)**: Private ledger, rent status, personal tiffin breakdown.

> **Privacy Guarantee**: Flatmates can **only view their own records and bills**. The owner is the only user with access to view everyone's combined ledger.

---

## 🍱 Key Features & Workflow

### 1. Daily Tiffins Section (Most Frequently Used Page)
- **Rate**: Fixed at **₹60** per tiffin per participant.
- **Meal Slots**: Rapid toggle between **☀️ Lunch** and **🌙 Dinner**.
- **Date Navigation**: Quick "Today", "Yesterday", and Calendar picker.
- **Participants**: Individual touch toggle buttons for each of the 4 roommates.
- **Extras Column**: Dedicated `+` / `-` counter with optional description (e.g., "Guest of Tenant 2", "Sunday extra food") charged at ₹60 each.
- **24-Hour Locking Mechanism**:
  - Any tick record older than 24 hours automatically freezes with a 🔒 **Locked** badge.
  - Non-developers cannot edit locked historical records.
  - Prevents accidental tampering, overwriting, or disputes.
  - To correct historical mistakes, tap **"Dev Unlock"** and enter the Developer Passkey (`flatdev2026`).

### 2. Monthly Rent Tracker
- **Standard Flat Share**: **₹2,000** per roommate per month.
- **Tenant Submission View**: Displays prominently up to which month rent has been cleared (e.g., *"✅ Rent paid up to September 2026"*).
- **Owner Grid**: Full interactive matrix for all 12 months where the owner can tap to mark a roommate's rent as PAID, choose the payment method (UPI, Cash, Bank Transfer), and note transaction IDs.
- **UPI Quick Pay**: Instant copy of Owner UPI ID and direct `upi://pay` launch.

### 3. Electricity Bill Upload & 4-Way Split
- Owner uploads the monthly electricity invoice (total amount, due date, consumer number, and bill photo).
- **Auto-Split**: The app divides the total bill by 4 roommates automatically (e.g. ₹1600 ÷ 4 = ₹400).
- **In-App Notification**: All 4 tenants receive an instant alert banner in their top bar bell icon: *"⚡ New Electricity Bill Uploaded: ₹1600. Your share: ₹400 (Due by 25th Sep)"*.
- High-resolution zoomable bill preview modal in the app.

### 4. Transparent Ledger (Real-Time Balances)
- **Owner View**: Consolidated breakdown of all roommates (Tiffins count & cost, Rent status, Power share, Net dues, Flat total pool).
- **Tenant View**: Private itemized statement with clear individual totals for the month.

### 5. In-App Receipts & Vector PDF Export
- Owner can click **"Send Receipt"** for any tenant and month.
- An official receipt record is created, and the tenant receives an in-app notification.
- Built-in PDF generator creates clean, official A5 receipts with flat header, itemized breakdown, total calculation, and verified digital stamp.
- Can be saved or printed on any mobile or desktop device.

### 6. Offline-First & Auto-Sync
- Powered by **IndexedDB (`idb.ts`)** and **Service Worker (`sw.js`)**.
- Ticks and updates recorded while offline are queued with a `pending` status.
- Once internet returns (or when the app opens), the queue flushes automatically to Cloudflare D1.
- Visual badge displays connection state: 🟢 Online or 🟠 Offline (X changes queued).

---

## ❓ Cloudflare D1 vs Cloudflare R2: Do you need R2?

**Direct Answer: No, R2 is not strictly required to get started!**
- **How FlatEco handles bill images without R2**:
  - The app includes an in-browser canvas compressor (`src/pages/BillsPage.tsx`) that optimizes and compresses uploaded bill images into lightweight WebP/JPEG payloads (under 120KB).
  - These compressed images and receipts are stored directly in **Cloudflare D1** (which allows up to 100MB on the free tier, enough for hundreds of monthly bills).
  - This means **you do NOT need to configure a credit card for R2** to run FlatEco in production today!
- **Optional R2 Upgrade**:
  - If you do decide to configure Cloudflare R2 with your card in the future (for storing massive uncompressed PDFs or archival files), `wrangler.toml` and `worker/index.ts` already contain pre-configured R2 bucket bindings that can be activated by uncommenting two lines.

---

## 🛠️ Developer Configuration & Passkeys
- **Default Developer Passkey**: `flatdev2026`
- **Default Profile PIN**: `1234`
- **Dev Mode Dashboard**: Go to the **Dev** tab to unlock 24-hour locked records, monitor the offline sync queue, and view audit diagnostics.

---

## 💻 Local Development & Deployment Commands

```bash
# Start local Vite development server
npm run dev

# Build production PWA assets
npm run build

# Deploy updates to Cloudflare Workers
npm run deploy

# Execute local D1 SQL schema
npm run d1:local

# Execute remote Cloudflare D1 schema
npm run d1:remote
```
