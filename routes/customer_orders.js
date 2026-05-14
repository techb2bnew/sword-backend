const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticate } = require("../middleware/auth");

// GET /api/customer-orders
router.get("/", authenticate, async (req, res) => {
  try {
    let query = `
      SELECT co.*, c.customer_name, c.company_name, c.email, c.phone,
             c.city, c.state, c.country
      FROM customer_orders co
      JOIN customers c ON co.customer_id = c.id
    `;
    let params = [];
    if (req.user.role === 'customer' && req.user.customer_id) {
      query += ` WHERE co.customer_id = $1`;
      params.push(req.user.customer_id);
    }
    query += ` ORDER BY co.created_at DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// GET /api/customer-orders/:id
router.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get order details
    const orderResult = await pool.query(
      `SELECT co.*, c.customer_name, c.company_name, c.email, c.phone,
              c.city, c.state, c.country
       FROM customer_orders co
       JOIN customers c ON co.customer_id = c.id
       WHERE co.id = $1`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Get order items
    const itemsResult = await pool.query(
      "SELECT * FROM customer_order_items WHERE order_id = $1",
      [id]
    );

    res.json({
      ...orderResult.rows[0],
      items: itemsResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// POST /api/customer-orders
router.post("/", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const { order_number, delivery_address, delivery_latitude, delivery_longitude, required_delivery_date, delivery_priority, items } = req.body;
    let { customer_id } = req.body;
    
    if (req.user.role === 'customer' && req.user.customer_id) {
      customer_id = req.user.customer_id;
    }

    if (!customer_id || !order_number || !items || items.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let total_weight = items.reduce((sum, i) => sum + (parseFloat(i.weight_kg || 0) * i.quantity), 0);

    const newOrder = await client.query(
      `INSERT INTO customer_orders (customer_id, order_number, delivery_address, delivery_latitude, delivery_longitude, required_delivery_date, delivery_priority, total_weight_kg, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING *`,
      [customer_id, order_number, delivery_address, delivery_latitude, delivery_longitude, required_delivery_date, delivery_priority || 'normal', total_weight]
    );

    const orderId = newOrder.rows[0].id;
    for (const item of items) {
      await client.query(
        "INSERT INTO customer_order_items (order_id, product_id, product_name, quantity, weight_kg) VALUES ($1, $2, $3, $4, $5)",
        [orderId, item.product_id || null, item.product_name || '', item.quantity, item.weight_kg || 0]
      );
    }
    await client.query("COMMIT");

    res.status(201).json(newOrder.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to create order" });
  } finally {
    client.release();
  }
});

// PUT /api/customer-orders/:id
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updatedOrder = await pool.query(
      `UPDATE customer_orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (updatedOrder.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(updatedOrder.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update order" });
  }
});

// POST /api/customer-orders/:id/select-warehouse
router.post("/:id/select-warehouse", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get a random available vehicle
    const vehicleResult = await pool.query(
      `SELECT id, plate_number, driver_name FROM vehicles WHERE status = 'Available' ORDER BY RANDOM() LIMIT 1`
    );

    if (vehicleResult.rows.length === 0) {
      return res.status(400).json({ error: "No vehicles available" });
    }

    const vehicle = vehicleResult.rows[0];

    const result = await pool.query(
      `UPDATE customer_orders SET status = 'dispatched' WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({
      ...result.rows[0],
      warehouse: "WH-AUTO",
      vehicle: vehicle.plate_number || vehicle.driver_name
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || "Failed to select warehouse" });
  }
});

// DELETE /api/customer-orders/:id
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Delete order items first
    await pool.query("DELETE FROM customer_order_items WHERE order_id = $1", [id]);

    // Delete the order
    const result = await pool.query(
      "DELETE FROM customer_orders WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({ message: "Order deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

module.exports = router;
