require('dotenv').config();
const pool = require('./db');

const fix = async () => {
  try {
    const res = await pool.query("SELECT id, capacity FROM vehicles");
    for (const v of res.rows) {
      if (!v.capacity) continue;
      let cap = parseFloat(v.capacity.replace(/[^0-9.]/g, '')) || 0;
      if (v.capacity.toLowerCase().includes('ton') || v.capacity.toLowerCase().includes('mt')) {
        cap *= 1000;
      }
      await pool.query("UPDATE vehicles SET capacity_kg = $1, status = 'available' WHERE id = $2", [cap, v.id]);
      console.log(`Updated vehicle ${v.id}: ${v.capacity} -> ${cap}kg`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

fix();
