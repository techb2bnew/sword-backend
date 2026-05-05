require('dotenv').config();
const pool = require('./db');

const migrate = async () => {
  try {
    console.log('Running Warehouse Selection migration...');
    
    // 1. Update warehouses table with coordinates
    await pool.query(`
      ALTER TABLE warehouses 
      ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
    `);

    // 2. Update customer_orders table with selection results
    await pool.query(`
      ALTER TABLE customer_orders 
      ADD COLUMN IF NOT EXISTS selected_warehouse_id INTEGER REFERENCES warehouses(id),
      ADD COLUMN IF NOT EXISTS selected_warehouse_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS warehouse_distance_km DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS warehouse_selected_at TIMESTAMP WITH TIME ZONE;
    `);

    // 3. Add default coordinates to existing warehouses if any (optional, for demo)
    await pool.query(`
      UPDATE warehouses SET latitude = 19.0760, longitude = 72.8777 WHERE latitude IS NULL; -- Mumbai
    `);

    console.log('Warehouse Selection migration successful.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
};

migrate();
