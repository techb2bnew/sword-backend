require('dotenv').config();
const pool = require('./db');

async function migrateRoles() {
  const client = await pool.connect();
  try {
    console.log('Updating role constraint to support all new roles...');

    // 1. Drop any existing role check constraint
    await client.query(`
      DO $$
      DECLARE
        constraint_name TEXT;
      BEGIN
        SELECT conname INTO constraint_name
        FROM pg_constraint
        WHERE conrelid = 'users'::regclass AND contype = 'c' AND conname ILIKE '%role%';
        
        IF constraint_name IS NOT NULL THEN
          EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(constraint_name);
          RAISE NOTICE 'Dropped constraint: %', constraint_name;
        ELSE
          RAISE NOTICE 'No role constraint found to drop.';
        END IF;
      END $$;
    `);

    // 2. Add the updated constraint with all roles
    await client.query(`
      ALTER TABLE users 
      ADD CONSTRAINT users_role_check 
      CHECK (role IN ('admin', 'staff', 'manager', 'supplier', 'buyer', 'customer', 'driver', 'accountant'));
    `);

    // 3. Add customer_id column if it doesn't exist
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
    `);

    console.log('✔ Role constraint updated to: admin, staff, manager, supplier, buyer, customer, driver, accountant');
    console.log('✔ customer_id column ensured on users table');
    console.log('Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

migrateRoles();
