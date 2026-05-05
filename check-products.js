const pool = require("./db");

async function checkProducts() {
  try {
    const products = await pool.query(
      "SELECT id, name, weight_kg, category FROM products LIMIT 20"
    );
    console.log("Products in database:");
    console.log(products.rows);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    pool.end();
  }
}

checkProducts();