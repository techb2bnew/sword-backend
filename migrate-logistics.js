require('dotenv').config();
const pool = require('./db');

const migrate = async () => {
  try {
    console.log('Running Advanced Logistics migration...');
    
    await pool.query(`
      ALTER TABLE customer_orders 
      ADD COLUMN IF NOT EXISTS selected_warehouse_id INT REFERENCES warehouses(id),
      ADD COLUMN IF NOT EXISTS selected_warehouse_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS warehouse_distance_km DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS warehouse_selected_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS shipment_id INT REFERENCES shipments(id),
      ADD COLUMN IF NOT EXISTS delivery_sequence INT;
    `);

    console.log('Migration successful.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
};

migrate();
