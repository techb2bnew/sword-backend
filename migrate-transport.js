require('dotenv').config();
const pool = require('./db');

const migrate = async () => {
  try {
    console.log('Running Transport migration...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
          id SERIAL PRIMARY KEY,
          plate_number VARCHAR(20) UNIQUE NOT NULL,
          vehicle_type VARCHAR(50),
          capacity VARCHAR(50),
          driver_name VARCHAR(100),
          status VARCHAR(20) DEFAULT 'Available'
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shipments (
          id SERIAL PRIMARY KEY,
          order_id VARCHAR(20),
          vehicle_id INT REFERENCES vehicles(id),
          route_details TEXT,
          dispatch_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          estimated_delivery TIMESTAMP,
          status VARCHAR(20) DEFAULT 'Pending'
      );
    `);
    console.log('Transport migration successful.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
};

migrate();
