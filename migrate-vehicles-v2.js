require('dotenv').config();
const pool = require('./db');

const migrate = async () => {
  try {
    console.log('Upgrading Vehicles Table (v2)...');
    
    await pool.query(`
      -- 1. Rename plate_number to vehicle_number if it exists, else add vehicle_number
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'plate_number') THEN
          ALTER TABLE vehicles RENAME COLUMN plate_number TO vehicle_number;
        ELSE
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'vehicle_number') THEN
            ALTER TABLE vehicles ADD COLUMN vehicle_number VARCHAR(50) UNIQUE;
          END IF;
        END IF;
      END $$;

      -- 2. Add missing columns
      ALTER TABLE vehicles 
      ADD COLUMN IF NOT EXISTS capacity_kg DECIMAL(15, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS capacity_volume DECIMAL(15, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(20),
      ADD COLUMN IF NOT EXISTS current_latitude DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS current_longitude DECIMAL(11, 8),
      ADD COLUMN IF NOT EXISTS assigned_warehouse_id INT REFERENCES warehouses(id);

      -- 3. Update status column (handling possible existing column)
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'status') THEN
          ALTER TABLE vehicles ADD COLUMN status VARCHAR(20) DEFAULT 'available';
        END IF;
      END $$;

      -- 4. Clean up legacy 'capacity' text column if it exists by migrating numbers
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name = 'capacity') THEN
          UPDATE vehicles SET capacity_kg = CAST(REGEXP_REPLACE(capacity, '[^0-9.]', '', 'g') AS DECIMAL) WHERE capacity_kg = 0;
          -- We can keep 'capacity' for now or drop it, let's keep it to avoid breaking other old code if any.
        END IF;
      END $$;
    `);

    console.log('Vehicles Table v2 Migration successful.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
};

migrate();
