const pool = require("./db");

async function addVehicles() {
  try {
    const vehicles = [
      { vehicle_number: 'MH-5678-AB12', vehicle_type: 'Van', capacity_kg: 2000, driver_name: 'Suraj', assigned_warehouse_id: 1, status: 'available' },
      { vehicle_number: 'MH-9012-CD34', vehicle_type: 'Truck', capacity_kg: 5000, driver_name: 'Priya', assigned_warehouse_id: 1, status: 'available' },
      { vehicle_number: 'MH-3456-EF56', vehicle_type: 'Truck', capacity_kg: 8000, driver_name: 'Arjun', assigned_warehouse_id: 1, status: 'available' }
    ];

    for (const v of vehicles) {
      const existing = await pool.query("SELECT id FROM vehicles WHERE vehicle_number = $1", [v.vehicle_number]);
      if (existing.rows.length === 0) {
        await pool.query(
          "INSERT INTO vehicles (vehicle_number, vehicle_type, capacity_kg, driver_name, assigned_warehouse_id, status) VALUES ($1, $2, $3, $4, $5, $6)",
          [v.vehicle_number, v.vehicle_type, v.capacity_kg, v.driver_name, v.assigned_warehouse_id, v.status]
        );
        console.log(`✓ Added vehicle: ${v.vehicle_number}`);
      }
    }

    // Reset the first vehicle back to available
    await pool.query("UPDATE vehicles SET status = 'available' WHERE vehicle_number = 'MH-1284-C784'");
    console.log("✓ Reset MH-1284-C784 to available");

    console.log("\nAll vehicles now available for dispatch");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    pool.end();
  }
}

addVehicles();