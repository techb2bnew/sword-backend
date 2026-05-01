require('dotenv').config();
const pool = require('./db');

async function checkBins() {
  try {
    const res = await pool.query("SELECT * FROM bins");
    console.table(res.rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkBins();
