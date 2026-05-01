require('dotenv').config();
const pool = require('./db');

async function cleanupBins() {
  try {
    console.log('Starting Warehouse Cleanup...');

    // 1. Find all bins that are NOT empty
    const bins = await pool.query("SELECT id, status, rack_code, bin_code FROM bins WHERE status != 'Empty'");
    
    for (const bin of bins.rows) {
      // Check for active product
      const product = await pool.query("SELECT id FROM products WHERE bin_id = $1", [bin.id]);
      
      // Check for active allocation
      const allocation = await pool.query("SELECT id FROM warehouse_allocations WHERE bin_id = $1", [bin.id]);

      if (product.rows.length === 0 && allocation.rows.length === 0) {
        console.log(`Resetting ghost bin: ${bin.rack_code} ${bin.bin_code} (ID: ${bin.id})`);
        await pool.query("UPDATE bins SET status = 'Empty', used_capacity = 0 WHERE id = $1", [bin.id]);
      }
    }

    console.log('Cleanup complete.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

cleanupBins();
