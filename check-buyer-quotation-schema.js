const pool = require("./db");

async function checkSchema() {
  try {
    const result = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'buyer_quotations' ORDER BY ordinal_position`
    );
    console.log(result.rows);
  } catch (err) {
    console.error(err.message);
  } finally {
    pool.end();
  }
}

checkSchema();