require('dotenv').config();
const pool = require('./db');

async function fixProductCategories() {
  try {
    console.log('Fixing product categories for prototype...');
    
    await pool.query("UPDATE products SET category = 'cocacola' WHERE name ILIKE '%cola%' OR name ILIKE '%coke%'");
    await pool.query("UPDATE products SET category = 'chips' WHERE name ILIKE '%chips%' OR name ILIKE '%lays%' OR name ILIKE '%kurkure%'");
    await pool.query("UPDATE products SET category = 'spices' WHERE name ILIKE '%methi%' OR name ILIKE '%pepper%' OR name ILIKE '%powder%' OR name ILIKE '%spices%'");
    await pool.query("UPDATE products SET category = 'biscuits' WHERE name ILIKE '%biscuit%' OR name ILIKE '%oreo%' OR name ILIKE '%cookies%'");
    
    const res = await pool.query("SELECT name, category FROM products");
    console.table(res.rows);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
fixProductCategories();
