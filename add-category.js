require('dotenv').config();
const pool = require('./db');

const addCategory = async () => {
  try {
    await pool.query("ALTER TABLE finance_ledger ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Other'");
    console.log("Added category column.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
addCategory();
