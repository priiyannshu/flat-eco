-- Cloudflare D1 Database Schema for FlatEco

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner', 'tenant')),
  room_or_info TEXT,
  pin TEXT NOT NULL DEFAULT '1234',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tiffin_records (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,          -- Format: YYYY-MM-DD
  meal_type TEXT NOT NULL,     -- 'lunch' or 'dinner' or 'single'
  tenant_1 INTEGER NOT NULL DEFAULT 0,
  tenant_2 INTEGER NOT NULL DEFAULT 0,
  tenant_3 INTEGER NOT NULL DEFAULT 0,
  tenant_4 INTEGER NOT NULL DEFAULT 0,
  extras INTEGER NOT NULL DEFAULT 0,
  extras_note TEXT,
  created_at INTEGER NOT NULL,  -- Unix timestamp ms
  updated_at INTEGER NOT NULL,  -- Unix timestamp ms
  is_dev_unlocked INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rent_records (
  id TEXT PRIMARY KEY,         -- e.g. rent_tenant_1_2026-09
  user_id TEXT NOT NULL,
  month TEXT NOT NULL,         -- Format: YYYY-MM
  amount REAL NOT NULL DEFAULT 2000,
  is_paid INTEGER NOT NULL DEFAULT 0,
  paid_date TEXT,
  payment_method TEXT,
  notes TEXT,
  marked_by TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS electricity_bills (
  id TEXT PRIMARY KEY,
  billing_month TEXT NOT NULL, -- Format: YYYY-MM
  bill_number TEXT,
  total_amount REAL NOT NULL,
  per_person_share REAL NOT NULL,
  due_date TEXT,
  image_data TEXT,             -- Base64 compressed image / WebP
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  month TEXT NOT NULL,         -- Format: YYYY-MM
  rent_amount REAL NOT NULL,
  tiffin_count INTEGER NOT NULL,
  tiffin_amount REAL NOT NULL,
  electricity_amount REAL NOT NULL,
  extras_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued',
  issued_at INTEGER NOT NULL,
  issued_by TEXT DEFAULT 'owner',
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  target_user_id TEXT NOT NULL, -- 'all' or specific user_id
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,          -- 'bill', 'receipt', 'rent', 'lock', 'system'
  data_json TEXT,
  is_read INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Seed Initial Profiles and Default Configuration
INSERT OR IGNORE INTO users (id, name, role, room_or_info, pin, created_at) VALUES
  ('owner', 'Apartment Owner', 'owner', 'Admin & Landlord', '1234', 1726000000000),
  ('tenant_1', 'Tenant 1 (Me)', 'tenant', 'Room 1', '1234', 1726000000000),
  ('tenant_2', 'Tenant 2', 'tenant', 'Room 2', '1234', 1726000000000),
  ('tenant_3', 'Tenant 3', 'tenant', 'Room 3', '1234', 1726000000000),
  ('tenant_4', 'Tenant 4', 'tenant', 'Room 4', '1234', 1726000000000);

INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('tiffin_price', '60'),
  ('monthly_rent', '2000'),
  ('lock_duration_hours', '24'),
  ('dev_passkey', 'flatdev2026'),
  ('flat_name', 'Bachelor Apartment 402'),
  ('owner_upi', 'owner@upi');

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_tiffin_date ON tiffin_records(date);
CREATE INDEX IF NOT EXISTS idx_rent_user_month ON rent_records(user_id, month);
CREATE INDEX IF NOT EXISTS idx_bills_month ON electricity_bills(billing_month);
CREATE INDEX IF NOT EXISTS idx_receipts_user ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_user_id);
