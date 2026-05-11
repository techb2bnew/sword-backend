const pool = require("./db");

async function updateRoleConstraint() {
  try {
    console.log("Updating users table role constraint...");
    
    // Drop the old constraint
    await pool.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check
    `);

    // Add the new constraint with all required roles
    await pool.query(`
      ALTER TABLE users ADD CONSTRAINT users_role_check 
      CHECK (role IN ('admin', 'staff', 'viewer', 'supplier', 'buyer', 'accountant', 'warehouse_manager', 'customer', 'driver', 'manager'))
    `);

    console.log("✅ Role constraint updated successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

updateRoleConstraint();
