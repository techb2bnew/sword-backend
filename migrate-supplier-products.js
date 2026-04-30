require("dotenv").config();
const pool = require("./db");

async function migrate() {
  try {
    console.log("Starting migration: adding supplier_id to products...");
    await pool.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id)
    `);
    console.log("Migration completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
