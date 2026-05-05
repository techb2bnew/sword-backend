const pool = require("./db");

async function checkUsers() {
  try {
    const result = await pool.query("SELECT id, username, email, role FROM users");
    console.log("Users in database:");
    result.rows.forEach(user => {
      console.log(`ID: ${user.id}, Username: ${user.username}, Email: ${user.email}, Role: ${user.role}`);
    });
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    pool.end();
  }
}

checkUsers();