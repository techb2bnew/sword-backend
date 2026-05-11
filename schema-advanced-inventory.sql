-- Advanced Inventory Schema Extensions for Batch/Lot, Best-Before, Cycle Counting, and Multi-Warehouse

-- 1. BATCH/LOT TRACKING TABLE
CREATE TABLE IF NOT EXISTS inventory_batches (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_number VARCHAR(50) NOT NULL UNIQUE,
  lot_number VARCHAR(50),
  warehouse_id INTEGER REFERENCES warehouses(id),
  bin_id INTEGER REFERENCES bins(id),
  quantity_received INTEGER NOT NULL DEFAULT 0,
  quantity_available INTEGER NOT NULL DEFAULT 0,
  best_before_date DATE,
  manufacture_date DATE,
  received_date TIMESTAMP DEFAULT NOW(),
  supplier_id INTEGER REFERENCES suppliers(id),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'damaged', 'expired', 'quarantine', 'consumed')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. BATCH ALLOCATION/CONSUMPTION TABLE (tracks usage of batches)
CREATE TABLE IF NOT EXISTS batch_allocations (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES inventory_batches(id) ON DELETE CASCADE,
  quantity_allocated INTEGER NOT NULL,
  allocation_type VARCHAR(20) DEFAULT 'sale' CHECK (allocation_type IN ('sale', 'manufacturing', 'disposal', 'return')),
  reference_type VARCHAR(20),
  reference_id INTEGER,
  allocated_date TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

-- 3. CYCLE COUNT TABLE (for physical inventory verification)
CREATE TABLE IF NOT EXISTS cycle_counts (
  id SERIAL PRIMARY KEY,
  warehouse_id INTEGER REFERENCES warehouses(id),
  cycle_code VARCHAR(50) NOT NULL UNIQUE,
  cycle_type VARCHAR(20) DEFAULT 'partial' CHECK (cycle_type IN ('partial', 'full', 'zone')),
  zone_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'approved')),
  planned_date DATE,
  start_date TIMESTAMP,
  completion_date TIMESTAMP,
  created_by_id INTEGER REFERENCES users(id),
  approved_by_id INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. CYCLE COUNT DETAILS TABLE
CREATE TABLE IF NOT EXISTS cycle_count_items (
  id SERIAL PRIMARY KEY,
  cycle_count_id INTEGER NOT NULL REFERENCES cycle_counts(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_id INTEGER REFERENCES inventory_batches(id),
  bin_id INTEGER REFERENCES bins(id),
  expected_quantity INTEGER,
  counted_quantity INTEGER,
  variance INTEGER,
  variance_reason VARCHAR(100),
  scanned_by_id INTEGER REFERENCES users(id),
  scan_timestamp TIMESTAMP DEFAULT NOW(),
  barcode_scanned VARCHAR(100),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'counted', 'variance_noted')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. BARCODE SCAN LOG TABLE (for RF/barcode tracking)
CREATE TABLE IF NOT EXISTS barcode_scans (
  id SERIAL PRIMARY KEY,
  barcode VARCHAR(100) NOT NULL,
  product_id INTEGER REFERENCES products(id),
  batch_id INTEGER REFERENCES inventory_batches(id),
  warehouse_id INTEGER REFERENCES warehouses(id),
  bin_id INTEGER REFERENCES bins(id),
  scan_type VARCHAR(30) DEFAULT 'inbound' CHECK (scan_type IN ('inbound', 'outbound', 'transfer', 'cycle_count', 'adjustment')),
  quantity_scanned INTEGER DEFAULT 1,
  scanned_by_id INTEGER REFERENCES users(id),
  scan_timestamp TIMESTAMP DEFAULT NOW(),
  session_id VARCHAR(100),
  is_valid BOOLEAN DEFAULT true,
  error_message TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. STOCK ADJUSTMENT LOG TABLE
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_id INTEGER REFERENCES inventory_batches(id),
  warehouse_id INTEGER REFERENCES warehouses(id),
  adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('damage', 'lost', 'expired', 'correction', 'return')),
  quantity_adjusted INTEGER NOT NULL,
  reason VARCHAR(255),
  adjusted_by_id INTEGER NOT NULL REFERENCES users(id),
  approved_by_id INTEGER REFERENCES users(id),
  attachment_url TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. BEST-BEFORE ALERT TABLE
CREATE TABLE IF NOT EXISTS expiry_alerts (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES inventory_batches(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  warehouse_id INTEGER REFERENCES warehouses(id),
  days_until_expiry INTEGER,
  alert_type VARCHAR(20) DEFAULT 'warning' CHECK (alert_type IN ('warning', 'critical', 'expired')),
  alert_date DATE DEFAULT CURRENT_DATE,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by_id INTEGER REFERENCES users(id),
  acknowledged_date TIMESTAMP,
  action_taken VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. MULTI-WAREHOUSE TRANSFER TABLE
CREATE TABLE IF NOT EXISTS warehouse_transfers (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  batch_id INTEGER REFERENCES inventory_batches(id),
  from_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  from_bin_id INTEGER REFERENCES bins(id),
  to_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  to_bin_id INTEGER REFERENCES bins(id),
  quantity INTEGER NOT NULL,
  transfer_date DATE DEFAULT CURRENT_DATE,
  requested_by_id INTEGER REFERENCES users(id),
  approved_by_id INTEGER REFERENCES users(id),
  received_by_id INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'received', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 9. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_batch_product ON inventory_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_batch_warehouse ON inventory_batches(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_batch_best_before ON inventory_batches(best_before_date);
CREATE INDEX IF NOT EXISTS idx_batch_status ON inventory_batches(status);
CREATE INDEX IF NOT EXISTS idx_cycle_count_warehouse ON cycle_counts(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_cycle_count_status ON cycle_counts(status);
CREATE INDEX IF NOT EXISTS idx_barcode_scan_timestamp ON barcode_scans(scan_timestamp);
CREATE INDEX IF NOT EXISTS idx_barcode_product ON barcode_scans(product_id);
CREATE INDEX IF NOT EXISTS idx_expiry_alert_batch ON expiry_alerts(batch_id);
CREATE INDEX IF NOT EXISTS idx_expiry_alert_alert_date ON expiry_alerts(alert_date);

-- 10. UPDATE products TABLE to include batch tracking reference
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_batch_id INTEGER REFERENCES inventory_batches(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS enable_batch_tracking BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS enable_best_before_tracking BOOLEAN DEFAULT true;
