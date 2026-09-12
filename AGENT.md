# FlatEco — Agent Development Guide

A lightweight reference for AI agents and developers working on the FlatEco codebase.

---

## 🛠 Tech Stack & Tools

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind CSS, Lucide React
- **Backend API**: Cloudflare Workers, Hono v4
- **Database**: Cloudflare D1 (Edge SQLite)
- **Client Offline Storage**: IndexedDB (custom wrapper in `src/lib/idb.ts`), Service Worker (`public/sw.js`)
- **PDF Generation**: jsPDF
- **CLI Tools**: `npm`, `vite`, `wrangler` (Cloudflare CLI), `gh` (GitHub CLI), `git`

---

## 📂 Project Structure

```
├── src/
│   ├── components/      # UI components (Navbar, LoginScreen, etc.)
│   ├── context/         # AuthContext, SyncContext
│   ├── lib/             # API client, IndexedDB store, PDF generator
│   ├── pages/           # TiffinsPage, PaymentsPage, BillsPage, RentPage
│   └── types/           # Core TypeScript definitions
├── worker/
│   └── index.ts         # Hono API router for Cloudflare Worker
├── public/              # Static assets, icons, manifest, sw.js
├── schema.sql           # D1 SQLite database schema
├── wrangler.toml        # Cloudflare Worker & D1 binding configuration
└── vite.config.ts       # Vite build configuration
```

---

## 🔄 Development Workflow

### 1. Local Development
```bash
# Start local Vite dev server
npm run dev
```

### 2. Building & Verification
Always verify builds pass with zero TypeScript / bundling errors before deploying:
```bash
# Run production Vite build
npm run build
```

### 3. Database Migrations (Cloudflare D1)
When updating `schema.sql`:
```bash
# Execute against local D1 database
npm run d1:local

# Execute against remote Cloudflare D1 database
npm run d1:remote
```

### 4. Deploying to Cloudflare
```bash
# Builds frontend assets and deploys worker via Wrangler
npm run deploy
```
- **Live Worker URL**: `https://flat-eco.priyanshukh1201.workers.dev`
- **Wrangler configuration**: `wrangler.toml` (Assets bound to `./dist`, DB bound to `flat-eco-db`)

### 5. Git & Version Control
```bash
git add .
git commit -m "type(scope): concise description"
git push origin master
```
- **Remote**: `https://github.com/priiyannshu/flat-eco.git`
- **Default branch**: `master`

---

## ⚠️ Key Development Rules

1. **Service Worker Updates**: When modifying frontend assets or caching strategies, increment `CACHE_NAME` in `public/sw.js` (e.g. `flat-eco-v2` → `v3`) to ensure clients receive the latest code.
2. **Profile-Level Access**:
   - `owner`: Can mark meals for all flatmates, upload electricity bills, toggle rent status, view all receivables.
   - `tenant` (`tenant_1` to `tenant_4`): Can view their personal tiffin table, view uploaded bills, view their rent log, view their itemized dues, and pay via QR/UPI.
3. **No External Card Dependencies**: Keep images compressed client-side (under 120KB) before saving to D1. Do not introduce mandatory Cloudflare R2 dependencies unless explicitly requested.
