require('dotenv').config();
const pool = require('./db');

const migrate = async () => {
  try {
    console.log('Running Bins/Racks migration...');
    
    // 1. Create Bins table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bins (
          id SERIAL PRIMARY KEY,
          warehouse_id INT REFERENCES warehouses(id) ON DELETE CASCADE,
          rack_code VARCHAR(20) NOT NULL, -- e.g. R-10, R-22
          bin_code VARCHAR(20) NOT NULL,  -- e.g. B-01, B-05
          status VARCHAR(20) DEFAULT 'Empty', -- Empty, Occupied, Maintenance
          UNIQUE(warehouse_id, rack_code, bin_code)
      );
    `);

    // 2. Add bin_id to products
    await pool.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS bin_id INT REFERENCES bins(id);
    `);

    // 3. Update stock_movements to include bin tracking
    await pool.query(`
      ALTER TABLE stock_movements 
      ADD COLUMN IF NOT EXISTS from_bin_id INT REFERENCES bins(id),
      ADD COLUMN IF NOT EXISTS to_bin_id INT REFERENCES bins(id);
    `);

    // 4. Seed some bins for the main warehouse
    const mainWh = await pool.query("SELECT id FROM warehouses WHERE name = 'Main Warehouse' LIMIT 1");
    if (mainWh.rows.length > 0) {
        const whId = mainWh.rows[0].id;
        for (let r = 1; r <= 3; r++) {
            for (let b = 1; b <= 5; b++) {
                await pool.query(`
                    INSERT INTO bins (warehouse_id, rack_code, bin_code)
                    VALUES ($1, $2, $3)
                    ON CONFLICT DO NOTHING
                `, [whId, `R-${r}`, `B-${b}`]);
            }
        }
    }

    console.log('Bins/Racks migration successful.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
};

migrate();
