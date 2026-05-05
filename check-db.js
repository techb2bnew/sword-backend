const pool = require("./db");

async function check() {
  try {
    const res = await pool.query(`
      SELECT b.id, b.bin_code, b.status, p.name as p_name, p.stock as p_stock, q.id as q_id, q.quantity as q_qty
      FROM bins b
      LEFT JOIN products p ON b.id = p.bin_id
      LEFT JOIN warehouse_allocations wa ON b.id = wa.bin_id
      LEFT JOIN quotations q ON wa.quotation_id = q.id
      WHERE b.rack_code = 'R-COCACOLA'
    `);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
