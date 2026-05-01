require('dotenv').config();
const pool = require('./db');

async function resetDemo() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('--- Resetting Warehouse & Inventory for Clean Demo ---');

        // 1. Delete all allocations
        await client.query('DELETE FROM warehouse_allocations');
        console.log('✔ Deleted all warehouse allocations');

        // 2. Reset all quotations to Pending and clear allocation details
        await client.query(`
            UPDATE quotations 
            SET status = 'Pending', 
                accepted_at = NULL, 
                delivery_due_at = NULL
        `);
        console.log('✔ Reset all quotations to Pending');

        // 3. Reset all bins (capacity and status)
        await client.query(`
            UPDATE bins 
            SET used_capacity = 0, 
                status = 'Empty'
        `);
        console.log('✔ Reset all warehouse bins to Empty');

        // 4. Reset Product stock and prices
        // We set price to 0 and stock to 0 so the new Weighted Average logic can start fresh
        await client.query(`
            UPDATE products 
            SET stock = 0, 
                price = 0,
                warehouse_id = NULL,
                bin_id = NULL
        `);
        console.log('✔ Reset all product stock and prices to zero');

        await client.query('COMMIT');
        console.log('--------------------------------------------------');
        console.log('DEMO RESET COMPLETE. You can now re-approve quotations.');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error during reset:', err.message);
    } finally {
        client.release();
        process.exit(0);
    }
}

resetDemo();
