require('dotenv').config();
const pool = require('./db');

const migrate = async () => {
  try {
    console.log('Running Transport V2 migration...');
    
    // Add columns to shipments table
    await pool.query(`
      ALTER TABLE shipments 
      ADD COLUMN IF NOT EXISTS origin_lat DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS origin_lng DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS dest_lat DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS dest_lng DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS origin_name TEXT,
      ADD COLUMN IF NOT EXISTS dest_name TEXT,
      ADD COLUMN IF NOT EXISTS distance_km DOUBLE PRECISION;
    `);

    console.log('Transport V2 migration successful.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
};

migrate();
