require('dotenv').config();
const pool = require('./db');

const migrate = async () => {
  try {
    console.log('Running manual migrations...');
    
    // Add supplier_id to users if it doesn't exist
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='supplier_id') THEN
          ALTER TABLE users ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id);
        END IF;
      END
      $$;
    `);

    // Create quotations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quotations (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER REFERENCES suppliers(id),
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        total_amount DECIMAL(15, 2) NOT NULL,
        valid_until DATE,
        status VARCHAR(20) DEFAULT 'Pending', -- Pending, Accepted, Rejected, Expired
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Migrations completed!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
};

migrate();
