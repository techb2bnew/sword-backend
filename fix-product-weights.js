const pool = require("./db");

async function fixProductWeights() {
  try {
    // Add weight_kg column if it doesn't exist
    await pool.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS weight_kg DECIMAL(10,2) DEFAULT 1.0
    `);
    console.log("✓ Added weight_kg column to products table");

    // Update products with realistic weights
    const updates = [
      { name: 'Spices', weight: 0.5 },
      { name: 'COCACOLA', weight: 0.6 },
      { name: 'Milk', weight: 1.0 },
      { name: 'Cheese', weight: 0.8 },
      { name: 'Bread', weight: 0.4 }
    ];

    for (const update of updates) {
      await pool.query(
        "UPDATE products SET weight_kg = $1 WHERE name ILIKE $2",
        [update.weight, update.name]
      );
      console.log(`✓ Set ${update.name} weight to ${update.weight}kg`);
    }

    // Set default weight for all products without weight
    await pool.query("UPDATE products SET weight_kg = 1.0 WHERE weight_kg = 0 OR weight_kg IS NULL");
    console.log("✓ Set default 1.0kg weight for products without weights");

    // Show updated products
    const products = await pool.query("SELECT id, name, weight_kg FROM products LIMIT 10");
    console.log("\nUpdated products:");
    console.log(products.rows);

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    pool.end();
  }
}

fixProductWeights();