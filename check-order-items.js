const pool = require("./db");

async function checkOrderItems() {
  try {
    const items = await pool.query(
      `SELECT coi.*, co.order_number, co.total_weight_kg
       FROM customer_order_items coi
       JOIN customer_orders co ON coi.order_id = co.id
       ORDER BY co.id`
    );
    console.log("Order Items:");
    console.log(items.rows);

    if (items.rows.length === 0) {
      console.log("\n❌ No items found! This is why total_weight_kg is 0.00");
      console.log("Orders need items to calculate weight for vehicle assignment.");
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    pool.end();
  }
}

checkOrderItems();