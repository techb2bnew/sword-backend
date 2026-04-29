require('dotenv').config();
const pool = require('./db');

const migrate = async () => {
  try {
    console.log('Running migration...');
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'finished_good'");
    console.log('Migration successful: type column added to products table.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
};

migrate();
