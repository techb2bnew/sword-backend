const pool = require("./db");

async function checkVehicles() {
  try {
    const result = await pool.query(
      "SELECT id, vehicle_number, vehicle_type, capacity_kg, status, assigned_warehouse_id, driver_name FROM vehicles"
    );
    console.log("Vehicles in database:");
    console.log(result.rows);
    
    // Also check pending orders
    const orders = await pool.query(
      `SELECT co.id, co.order_number, co.status, co.total_weight_kg, co.selected_warehouse_id, s.vehicle_id
       FROM customer_orders co
       LEFT JOIN shipments s ON co.shipment_id = s.id
       WHERE co.status IN ('warehouse_selected', 'approved')`
    );
    console.log("\nOrders with warehouse_selected or approved status:");
    console.log(orders.rows);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    pool.end();
  }
}

checkVehicles();