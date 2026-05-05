const pool = require("./db");

async function migrateBuyerQuotationsSchema() {
  try {
    await pool.query(`
      ALTER TABLE buyer_quotations
      ADD COLUMN IF NOT EXISTS supplier_notes TEXT,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    console.log("Buyer quotations schema migration completed");
  } catch (error) {
    console.error("Buyer quotations schema migration failed:", error.message);
  } finally {
    process.exit();
  }
}

migrateBuyerQuotationsSchema();