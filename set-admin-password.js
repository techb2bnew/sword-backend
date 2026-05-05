const pool = require("./db");
const bcrypt = require("bcryptjs");

async function setAdminPassword() {
  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash("Admin@123", salt);
    await pool.query("UPDATE users SET password_hash = $1 WHERE email = $2", [password_hash, "admin@yopmail.com"]);
    console.log("Admin password updated to Admin@123");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    pool.end();
  }
}

setAdminPassword();