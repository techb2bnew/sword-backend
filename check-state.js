const pool = require('./db');
async function check() {
  const q = await pool.query("SELECT id, status FROM quotations WHERE product_id IN (SELECT id FROM products WHERE name='COCACOLA')");
  console.log("Quotations:", q.rows);
  const p = await pool.query("SELECT id, name, stock FROM products WHERE name='COCACOLA'");
  console.log("Products:", p.rows);
  const wa = await pool.query("SELECT wa.*, b.bin_code FROM warehouse_allocations wa JOIN bins b ON wa.bin_id = b.id WHERE wa.product_id IN (SELECT id FROM products WHERE name='COCACOLA')");
  console.log("Allocations:", wa.rows);
  process.exit(0);
}
check();
