const pool = require("./db");
const fs = require("fs");
const path = require("path");

async function migrateAdvancedInventory() {
  try {
    console.log("🔄 Applying Advanced Inventory Schema Migration...\n");

    // Read the schema file
    const schemaPath = path.join(__dirname, "schema-advanced-inventory.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");

    // Split by semicolon and execute each statement
    const statements = schemaSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let completed = 0;
    for (const statement of statements) {
      try {
        await pool.query(statement);
        completed++;
      } catch (err) {
        // Ignore "already exists" errors
        if (!err.message.includes("already exists")) {
          console.warn(`⚠️  Warning on statement: ${err.message}`);
        }
      }
    }

    console.log(`✅ Migration completed! (${completed} statements executed)`);
    console.log("\n📋 Created Tables:");
    console.log("   • inventory_batches - Batch/Lot tracking");
    console.log("   • batch_allocations - Batch usage tracking");
    console.log("   • cycle_counts - Cycle count management");
    console.log("   • cycle_count_items - Cycle count details");
    console.log("   • barcode_scans - RF/Barcode scan logs");
    console.log("   • stock_adjustments - Adjustment tracking");
    console.log("   • expiry_alerts - Best-before alerts");
    console.log("   • warehouse_transfers - Inter-warehouse transfers");

    process.exit(0);
  } catch (err) {
    console.error("❌ Migration Error:", err.message);
    process.exit(1);
  }
}

migrateAdvancedInventory();
