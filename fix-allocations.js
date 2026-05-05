const pool = require('./db');
const { autoAllocateWarehouse } = require('./services/allocationService');

async function fix() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Get the quotation IDs for COCACOLA (Accepted or Pending)
    const quotes = await client.query(`
      SELECT q.id FROM quotations q 
      JOIN products p ON q.product_id = p.id 
      WHERE p.name = 'COCACOLA' AND q.status != 'Rejected'
    `);
    const ids = quotes.rows.map(r => r.id);

    if (ids.length === 0) {
      console.log("No COCACOLA quotations found.");
      return;
    }

    // 2. Clear existing allocations for these quotes
    await client.query(`DELETE FROM warehouse_allocations WHERE quotation_id = ANY($1)`, [ids]);

    // 3. Reset bin capacities for the COCACOLA rack
    await client.query(`UPDATE bins SET used_capacity = 0, status = 'Empty' WHERE rack_code = 'R-COCACOLA'`);

    // 4. Reset quotations to Pending so we can re-allocate
    await client.query(`UPDATE quotations SET status = 'Pending' WHERE id = ANY($1)`, [ids]);

    // 5. Reset product stock (it will be incremented again)
    await client.query(`UPDATE products SET stock = 0 WHERE name = 'COCACOLA'`);

    await client.query('COMMIT');
    console.log(`Reset ${ids.length} quotations. Re-allocating now...`);

    // 6. Re-allocate using NEW logic
    for (const id of ids) {
      await autoAllocateWarehouse(id);
      console.log(`Re-allocated Quotation #${id}`);
    }

    console.log("Consolidation Complete!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
  }
}

fix();
