require('dotenv').config();
const pool = require('./db');
const bcrypt = require('bcryptjs');

const createSupplierAccount = async () => {
  try {
    const sRes = await pool.query("SELECT id, name FROM suppliers LIMIT 1");
    if (sRes.rows.length === 0) {
      console.log("No suppliers found. Create one first.");
      process.exit(1);
    }
    const supplier = sRes.rows[0];
    
    const username = "supplier_test";
    const email = "supplier@test.com";
    const password = "password123";
    const role = "supplier";
    const supplier_id = supplier.id;

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    await pool.query(
      "INSERT INTO users (username, email, password_hash, role, supplier_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING",
      [username, email, hash, role, supplier_id]
    );

    console.log("Supplier account created!");
    console.log("Username:", username);
    console.log("Email:", email);
    console.log("Password:", password);
    console.log("Linked Supplier:", supplier.name);
    
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

createSupplierAccount();
