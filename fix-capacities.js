require('dotenv').config();
const pool = require('./db');

async function fixCapacities() {
  try {
    console.log('Increasing bin capacities to 5000...');
    await pool.query("UPDATE bins SET capacity = 5000 WHERE capacity = 100");
    console.log('Update successful.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
fixCapacities();
