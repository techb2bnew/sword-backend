const pool = require("./db");

async function checkVehiclesTable() {
  try {
    // Check table schema
    const schema = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'vehicles'
      ORDER BY ordinal_position
    `);
    
    console.log("Vehicles table schema:");
    console.log(schema.rows);

    // Check for unique constraints
    const constraints = await pool.query(`
      SELECT constraint_type, constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'vehicles'
    `);
    
    console.log("\nTable constraints:");
    console.log(constraints.rows);

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    pool.end();
  }
}

checkVehiclesTable();