const pool = require("./db");

async function migrateBuyerModule() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS buyers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        company_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS buyer_quotations (
        id SERIAL PRIMARY KEY,
        buyer_id INTEGER REFERENCES buyers(id),
        supplier_id INTEGER REFERENCES suppliers(id),
        product_id INTEGER,
        product_name VARCHAR(255) NOT NULL,
        quantity NUMERIC NOT NULL,
        target_price NUMERIC NOT NULL,
        total NUMERIC NOT NULL,
        required_delivery_date DATE,
        notes TEXT,
        status VARCHAR(50) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("Buyer module migration completed");
    process.exit();
  } catch (error) {
    console.error("Buyer module migration failed:", error);
    process.exit(1);
  }
}

migrateBuyerModule();