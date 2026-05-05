const pool = require("./db");
const { processLogistics } = require("./services/logisticsService");

async function retriggerLogistics() {
  try {
    const orders = await pool.query(
      "SELECT id, order_number FROM customer_orders WHERE status = 'warehouse_selected' AND shipment_id IS NOT NULL"
    );

    console.log(`Re-triggering logistics for ${orders.rows.length} orders...\n`);

    for (const order of orders.rows) {
      try {
        // Get shipment details
        const shipment = await pool.query(
          "SELECT id, vehicle_id FROM shipments WHERE id = (SELECT shipment_id FROM customer_orders WHERE id = $1)",
          [order.id]
        );
        
        if (shipment.rows.length > 0 && !shipment.rows[0].vehicle_id) {
          const result = await processLogistics(order.id);
          console.log(`✓ ${order.order_number}: ${result.vehicle}`);
        }
      } catch (err) {
        console.log(`✗ ${order.order_number}: ${err.message}`);
      }
    }

    console.log("\nLogistics re-triggered");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    pool.end();
  }
}

retriggerLogistics();