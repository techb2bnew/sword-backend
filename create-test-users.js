const bcrypt = require("bcryptjs");
const pool = require("./db");

const testUsers = [
  { username: "Supplier Admin", email: "supplier@sword.com", password: "password123", role: "supplier" },
  { username: "Chief Accountant", email: "accountant@sword.com", password: "password123", role: "accountant" },
  { username: "System Admin", email: "admin@sword.com", password: "password123", role: "admin" },
  { username: "Warehouse Manager", email: "manager@sword.com", password: "password123", role: "warehouse_manager" },
  { username: "Buyer Manager", email: "buyer@sword.com", password: "password123", role: "buyer" },
];

async function createTestUsers() {
  try {
    console.log("Creating test users...");
    
    for (const user of testUsers) {
      const existing = await pool.query("SELECT id FROM users WHERE email = $1", [user.email]);
      
      if (existing.rows.length > 0) {
        console.log(`✓ User already exists: ${user.email}`);
        continue;
      }

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(user.password, salt);

      await pool.query(
        "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)",
        [user.username, user.email, password_hash, user.role]
      );

      console.log(`✓ Created: ${user.email} (${user.role})`);
    }

    console.log("\n✅ All test users created!");
    console.log("\nTest credentials:");
    testUsers.forEach(u => console.log(`  ${u.email} / password123 → ${u.role}`));
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

createTestUsers();
