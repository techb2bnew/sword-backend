const express = require("express");
const router = express.Router();
const pool = require("../db");

// --- Suppliers ---

// Get all suppliers
router.get("/suppliers", async (req, res) => {
  try {
    const suppliers = await pool.query("SELECT * FROM suppliers ORDER BY id DESC");
    res.json(suppliers.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Add a supplier
router.post("/suppliers", async (req, res) => {
  try {
    const { name, contact_person, email, phone, address } = req.body;
    const newSupplier = await pool.query(
      "INSERT INTO suppliers (name, contact_person, email, phone, address) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [name, contact_person, email, phone, address]
    );
    res.json(newSupplier.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Update a supplier
router.put("/suppliers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_person, email, phone, address } = req.body;
    const update = await pool.query(
      "UPDATE suppliers SET name = $1, contact_person = $2, email = $3, phone = $4, address = $5 WHERE id = $6 RETURNING *",
      [name, contact_person, email, phone, address, id]
    );
    res.json(update.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete a supplier
router.delete("/suppliers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM suppliers WHERE id = $1", [id]);
    res.json({ message: "Supplier deleted" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Purchase Orders ---

// Get all purchase orders
router.get("/orders", async (req, res) => {
  try {
    const orders = await pool.query(`
      SELECT po.*, s.name as supplier_name 
      FROM purchase_orders po 
      JOIN suppliers s ON po.supplier_id = s.id 
      ORDER BY po.id DESC
    `);
    res.json(orders.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Get items for a specific purchase order
router.get("/orders/:id/items", async (req, res) => {
  try {
    const { id } = req.params;
    const items = await pool.query(`
      SELECT poi.*, p.name as product_name 
      FROM purchase_order_items poi 
      JOIN products p ON poi.product_id = p.id 
      WHERE poi.purchase_order_id = $1
    `, [id]);
    res.json(items.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Create a purchase order
router.post("/orders", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { supplier_id, order_date, expected_delivery, items } = req.body;
    
    let total_amount = 0;
    items.forEach(item => {
      total_amount += item.quantity * item.unit_price;
    });

    const newOrder = await client.query(
      "INSERT INTO purchase_orders (supplier_id, order_date, expected_delivery, total_amount, status) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [supplier_id, order_date, expected_delivery, total_amount, 'Draft']
    );

    const orderId = newOrder.rows[0].id;

    for (const item of items) {
      await client.query(
        "INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)",
        [orderId, item.product_id, item.quantity, item.unit_price]
      );
    }

    await client.query('COMMIT');
    res.json(newOrder.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// Update order status (e.g., mark as Received)
router.put("/orders/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // If status is 'Received', we should increment product stock
    if (status === 'Received') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Check current status
        const currentOrder = await client.query("SELECT status FROM purchase_orders WHERE id = $1", [id]);
        if (currentOrder.rows[0].status === 'Received') {
          throw new Error("Order already marked as received");
        }

        const updateOrder = await client.query(
          "UPDATE purchase_orders SET status = $1 WHERE id = $2 RETURNING *",
          [status, id]
        );

        const items = await client.query("SELECT * FROM purchase_order_items WHERE purchase_order_id = $1", [id]);
        
        for (const item of items.rows) {
          await client.query(
            "UPDATE products SET stock = stock + $1 WHERE id = $2",
            [item.quantity, item.product_id]
          );
        }

        await client.query('COMMIT');
        res.json(updateOrder.rows[0]);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const updateOrder = await pool.query(
        "UPDATE purchase_orders SET status = $1 WHERE id = $2 RETURNING *",
        [status, id]
      );
      res.json(updateOrder.rows[0]);
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

module.exports = router;
