const pool = require("./db");
const { processLogistics } = require("./services/logisticsService");

async function recalculateAndReassign() {
  try {
    // Recalculate total_weight_kg for all orders based on item weights
    const orders = await pool.query("SELECT DISTINCT order_id FROM customer_order_items");
    
    for (const row of orders.rows) {
      const orderId = row.order_id;
      const weightRes = await pool.query(
        `SELECT SUM(coi.quantity * COALESCE(p.weight_kg, 1.0)) as calc_weight
         FROM customer_order_items coi
         LEFT JOIN products p ON p.name = coi.product_name
         WHERE coi.order_id = $1`,
        [orderId]
      );
      
      const totalWeight = parseFloat(weightRes.rows[0]?.calc_weight || 0);
      
      await pool.query(
        "UPDATE customer_orders SET total_weight_kg = $1 WHERE id = $2",
        [totalWeight, orderId]
      );
    }
    console.log("✓ Recalculated order weights\n");

    // Re-trigger logistics for warehouse_selected orders
    const warehouseOrders = await pool.query(
      "SELECT id, order_number FROM customer_orders WHERE status = 'warehouse_selected' ORDER BY id"
    );

    console.log(`Re-triggering logistics for ${warehouseOrders.rows.length} orders...\n`);

    for (const order of warehouseOrders.rows) {
      try {
        const result = await processLogistics(order.id);
        console.log(`✓ ${order.order_number}: ${result.vehicle}`);
      } catch (err) {
        console.log(`✗ ${order.order_number}: ${err.message}`);
      }
    }

    console.log("\n✓ All orders reassigned with vehicles!");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    pool.end();
  }
}

recalculateAndReassign();