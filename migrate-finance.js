require('dotenv').config();
const pool = require('./db');

const migrate = async () => {
  try {
    console.log('Creating Finance Ledger Table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS finance_ledger (
        id SERIAL PRIMARY KEY,
        date DATE DEFAULT CURRENT_DATE,
        description VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL, -- 'Debit' or 'Credit'
        amount DECIMAL(15, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'Completed', -- 'Completed', 'Pending'
        reference_id VARCHAR(50), 
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Optional: Insert some dummy data if empty so the UI doesn't look blank immediately
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM finance_ledger) THEN
          INSERT INTO finance_ledger (date, description, type, amount, status) VALUES 
          (CURRENT_DATE - INTERVAL '2 days', 'Purchase – Raw Materials', 'Debit', 45000, 'Completed'),
          (CURRENT_DATE - INTERVAL '1 day', 'Sales Income – #SO-1040', 'Credit', 28900, 'Completed'),
          (CURRENT_DATE, 'Electricity Bill', 'Debit', 12400, 'Pending');
        END IF;
      END $$;
    `);

    console.log('Finance migration successful.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
};

migrate();
