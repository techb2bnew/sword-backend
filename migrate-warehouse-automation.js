require('dotenv').config();
const pool = require('./db');

const migrate = async () => {
  try {
    console.log('Running Warehouse Automation migration...');
    
    // 1. Update quotations table
    await pool.query(`
      ALTER TABLE quotations 
      ADD COLUMN IF NOT EXISTS credit_days INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS delivery_due_at TIMESTAMP WITH TIME ZONE;
    `);

    // 2. Update bins table
    await pool.query(`
      ALTER TABLE bins 
      ADD COLUMN IF NOT EXISTS capacity INT DEFAULT 100,
      ADD COLUMN IF NOT EXISTS used_capacity INT DEFAULT 0;
    `);

    // 3. Create warehouse_allocations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS warehouse_allocations (
          id SERIAL PRIMARY KEY,
          quotation_id INT REFERENCES quotations(id) ON DELETE CASCADE,
          product_id INT REFERENCES products(id),
          warehouse_id INT REFERENCES warehouses(id),
          rack_id INT, -- Refers to rack_code index or similar, using INT for ID if needed
          bin_id INT REFERENCES bins(id),
          barcode_id VARCHAR(100) UNIQUE,
          allocated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(20) DEFAULT 'allocated', -- allocated, dispatched, delivered, overdue
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Create notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(50) DEFAULT 'info', -- info, warning, danger
          is_read BOOLEAN DEFAULT FALSE,
          related_id INT, -- Optional reference to order/quotation
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Warehouse Automation migration successful.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
};

migrate();
