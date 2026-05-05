const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticate } = require("../middleware/auth");
const { processLogistics } = require("../services/logisticsService");

// GET /api/customer-orders
router.get("/", authenticate, async (req, res) => {
  try {
    let query = `
      SELECT co.*, c.customer_name, c.company_name,
             v.vehicle_number as vehicle_plate, v.vehicle_type, v.driver_name,
             s.status as shipment_status, s.estimated_delivery
      FROM customer_orders co
      JOIN customers c ON co.customer_id = c.id
      LEFT JOIN shipments s ON co.shipment_id = s.id
      LEFT JOIN vehicles v ON s.vehicle_id = v.id
    `;
    let params = [];
    if (req.user.role === 'customer') {
      query += ` WHERE co.customer_id = $1`;
      params.push(req.user.customer_id);
    }
    query += ` ORDER BY co.created_at DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customer-orders - Aggressive Automation on Creation
router.post("/", authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { order_number, delivery_address, delivery_latitude, delivery_longitude, required_delivery_date, delivery_priority, items } = req.body;
    let { customer_id } = req.body;
    if (req.user.role === 'customer') customer_id = req.user.customer_id;
    
    let total_weight = items.reduce((sum, i) => sum + (parseFloat(i.weight_kg) * i.quantity), 0);

    const newOrder = await client.query(
      `INSERT INTO customer_orders (customer_id, order_number, delivery_address, delivery_latitude, delivery_longitude, required_delivery_date, delivery_priority, total_weight_kg, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING *`,
      [customer_id, order_number, delivery_address, delivery_latitude, delivery_longitude, required_delivery_date, delivery_priority || 'normal', total_weight]
    );

    const orderId = newOrder.rows[0].id;
    for (const item of items) {
      await client.query(
        "INSERT INTO customer_order_items (order_id, product_id, product_name, quantity, weight_kg) VALUES ($1, $2, $3, $4, $5)",
        [orderId, item.product_id, item.product_name, item.quantity, item.weight_kg]
      );
    }
    await client.query("COMMIT");

    // Aggressive Auto-Logistics: Try immediately
    try {
      await processLogistics(orderId);
    } catch (e) {
      console.log("Auto-logistics skipped on creation:", e.message);
    }

    res.status(201).json(newOrder.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/customer-orders/:id - Aggressive Automation on Approval
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // If Admin approves OR manually selects warehouse, trigger full logistics chain
    if (status === 'approved' || status === 'warehouse_selected') {
      const result = await processLogistics(id);
      return res.json({ message: "System Automated: Logistics Calculated", ...result });
    }

    const updatedOrder = await pool.query(
      `UPDATE customer_orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    res.json(updatedOrder.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customer-orders/:id/select-warehouse
router.post("/:id/select-warehouse", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await processLogistics(id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
