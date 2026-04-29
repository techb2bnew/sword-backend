require('dotenv').config();
const pool = require('./db');

const migrate = async () => {
  try {
    console.log('Running Warehouse migration...');
    
    // 1. Create Warehouses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS warehouses (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          location VARCHAR(200),
          capacity_sqft INT,
          manager_name VARCHAR(100),
          status VARCHAR(20) DEFAULT 'Active'
      );
    `);

    // 2. Add warehouse_id to products if not exists
    await pool.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS warehouse_id INT REFERENCES warehouses(id);
    `);

    // 3. Create Stock Movements table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_movements (
          id SERIAL PRIMARY KEY,
          product_id INT REFERENCES products(id),
          from_warehouse_id INT REFERENCES warehouses(id),
          to_warehouse_id INT REFERENCES warehouses(id),
          quantity DECIMAL NOT NULL,
          movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          reason TEXT,
          user_id INT -- Reference to who moved it
      );
    `);

    // 4. Insert a default warehouse
    await pool.query(`
      INSERT INTO warehouses (name, location, capacity_sqft, manager_name)
      VALUES ('Main Warehouse', 'New Delhi, HQ', 50000, 'Arjun Singh')
      ON CONFLICT DO NOTHING;
    `);

    console.log('Warehouse migration successful.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
};

migrate();
