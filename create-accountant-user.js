const pool = require("./db");
const bcrypt = require("bcryptjs");

async function createAccountantUser() {
  try {
    // Check if accountant user already exists
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", ["accountant@gyrofoods.com"]);

    if (existing.rows.length > 0) {
      console.log("Accountant user already exists");
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash("Accountant@123", salt);

    const result = await pool.query(
      "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role",
      ["accountant", "accountant@gyrofoods.com", password_hash, "accountant"]
    );

    console.log("Accountant user created successfully:");
    console.log("Email: accountant@gyrofoods.com");
    console.log("Password: Accountant@123");
    console.log("Role: accountant");

  } catch (err) {
    console.error("Error creating accountant user:", err.message);
  } finally {
    pool.end();
  }
}

createAccountantUser();