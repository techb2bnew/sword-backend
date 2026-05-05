require("dotenv").config();
const pool = require("./db");

const migrate = async () => {
  try {
    console.log("Creating customers table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
          id SERIAL PRIMARY KEY,
          customer_name VARCHAR(255) NOT NULL,
          company_name VARCHAR(255),
          email VARCHAR(100),
          phone VARCHAR(20) NOT NULL,
          address_line_1 TEXT NOT NULL,
          address_line_2 TEXT,
          city VARCHAR(100) NOT NULL,
          state VARCHAR(100) NOT NULL,
          country VARCHAR(100) DEFAULT 'India',
          pincode VARCHAR(20) NOT NULL,
          latitude DECIMAL(10, 8) NOT NULL,
          longitude DECIMAL(11, 8) NOT NULL,
          delivery_priority VARCHAR(20) DEFAULT 'normal',
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Table 'customers' created or already exists.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  }
};

migrate();
