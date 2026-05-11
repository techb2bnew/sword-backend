#!/usr/bin/env node

/**
 * Advanced Inventory Module - Quick Setup
 * Run this script to initialize the module with sample data
 */

const pool = require("./db");

async function setupAdvancedInventory() {
  try {
    console.log("🚀 Advanced Inventory Module - Quick Setup\n");

    // 1. Verify tables exist
    console.log("✓ Checking database tables...");
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema='public' AND table_name IN (
        'inventory_batches', 'cycle_counts', 'barcode_scans', 'expiry_alerts'
      )
    `);

    const tableNames = tables.rows.map(t => t.table_name);
    console.log(`  Found ${tableNames.length} tables: ${tableNames.join(', ')}`);

    // 2. Check if warehouse exists
    console.log("\n✓ Checking warehouses...");
    const warehouses = await pool.query("SELECT id, name FROM warehouses LIMIT 1");
    
    if (warehouses.rows.length === 0) {
      console.log("  ⚠️  No warehouses found. Creating sample warehouse...");
      const wh = await pool.query(
        "INSERT INTO warehouses (name, city, capacity) VALUES ($1, $2, $3) RETURNING *",
        ["Main Warehouse", "Delhi", "10000"]
      );
      console.log(`  ✓ Created: ${wh.rows[0].name}`);
    } else {
      console.log(`  ✓ Using warehouse: ${warehouses.rows[0].name}`);
    }

    // 3. Check products
    console.log("\n✓ Checking products...");
    const products = await pool.query("SELECT COUNT(*) as count FROM products WHERE enable_batch_tracking = true");
    console.log(`  Found ${products.rows[0].count} products with batch tracking enabled`);

    // 4. Enable batch tracking on first few products
    if (products.rows[0].count < 3) {
      console.log("  Enabling batch tracking on sample products...");
      await pool.query("UPDATE products SET enable_batch_tracking = true, enable_best_before_tracking = true LIMIT 5");
    }

    // 5. Summary
    console.log("\n✅ Setup Complete!\n");
    console.log("📋 Module Features Ready:");
    console.log("  • Batch/Lot Tracking (inventory_batches)");
    console.log("  • Best-Before Management (expiry_alerts)");
    console.log("  • Cycle Counting (cycle_counts)");
    console.log("  • Barcode Scanning (barcode_scans)");
    console.log("  • Multi-Warehouse Support");
    console.log("\n🎯 Next Steps:");
    console.log("  1. Log in as warehouse_manager (manager@sword.com)");
    console.log("  2. Navigate to 'Advanced Inventory' in sidebar");
    console.log("  3. Start creating batches for products");
    console.log("  4. Use barcode scanner for real-time tracking");
    console.log("\n📚 Documentation: See ADVANCED_INVENTORY_GUIDE.md\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ Setup Error:", err.message);
    process.exit(1);
  }
}

setupAdvancedInventory();
