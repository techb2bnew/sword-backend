require('dotenv').config();
const pool = require('./db');

const setupPrototypeData = async () => {
  try {
    console.log('Setting up Prototype Categorization...');

    // 1. Add category columns
    await pool.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100);
      ALTER TABLE bins ADD COLUMN IF NOT EXISTS category VARCHAR(100);
    `);

    // 2. Clear existing bins for fresh setup (since it's a prototype)
    // await pool.query("DELETE FROM warehouse_allocations");
    // await pool.query("DELETE FROM bins");

    // 3. Setup Racks/Bins with Categories in Main Warehouse (ID: 1)
    const categories = ['cocacola', 'chips', 'spices', 'biscuits'];
    
    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      const rackCode = `R-${cat.toUpperCase()}`;
      
      // Check if rack already exists, if not create bins
      const checkRack = await pool.query("SELECT id FROM bins WHERE rack_code = $1", [rackCode]);
      
      if (checkRack.rows.length === 0) {
        console.log(`Creating bins for category: ${cat}`);
        for (let j = 1; j <= 5; j++) {
          await pool.query(
            "INSERT INTO bins (warehouse_id, rack_code, bin_code, capacity, category) VALUES ($1, $2, $3, $4, $5)",
            [1, rackCode, `B-0${j}`, 5000, cat]
          );
        }
      } else {
        // Update existing bins for that rack code to the category
        await pool.query("UPDATE bins SET category = $1 WHERE rack_code = $2", [cat, rackCode]);
      }
    }

    // 4. Assign categories to existing products
    await pool.query("UPDATE products SET category = 'spices' WHERE name ILIKE '%Methi%' OR name ILIKE '%pepper%' OR name ILIKE '%powder%'");
    await pool.query("UPDATE products SET category = 'cocacola' WHERE name ILIKE '%coke%' OR name ILIKE '%cola%'");
    await pool.query("UPDATE products SET category = 'chips' WHERE name ILIKE '%chips%' OR name ILIKE '%lays%'");
    await pool.query("UPDATE products SET category = 'biscuits' WHERE name ILIKE '%biscuit%' OR name ILIKE '%oreo%'");

    console.log('Prototype setup successful.');
    process.exit(0);
  } catch (err) {
    console.error('Prototype setup failed:', err.message);
    process.exit(1);
  }
};

setupPrototypeData();
