require("dotenv").config();
const pool = require("./db");

async function migrate() {
  try {
    console.log("Starting migration: adding expected_delivery to quotations...");
    await pool.query(`
      ALTER TABLE quotations 
      ADD COLUMN IF NOT EXISTS expected_delivery DATE
    `);
    console.log("Migration completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
