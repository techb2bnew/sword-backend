require('dotenv').config();
const pool = require('./db');

const test = async () => {
  try {
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables in DB:', tables.rows.map(r => r.table_name));

    const suppliers = await pool.query("SELECT count(*) FROM suppliers");
    console.log('Suppliers count:', suppliers.rows[0].count);

    const products = await pool.query("SELECT count(*) FROM products");
    console.log('Products count:', products.rows[0].count);

    const warehouses = await pool.query("SELECT count(*) FROM warehouses");
    console.log('Warehouses count:', warehouses.rows[0].count);

    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
  }
};

test();
