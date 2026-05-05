require('dotenv').config();
const pool = require('./db');

const migrate = async () => {
  try {
    console.log('Running Warehouse Split Allocation migration...');
    
    // Add quantity to warehouse_allocations to support splitting
    await pool.query(`
      ALTER TABLE warehouse_allocations 
      ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 0;
    `);

    console.log('Migration successful.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
};

migrate();
