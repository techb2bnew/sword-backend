const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticate } = require("../middleware/auth");

// Buyer sends quotation to supplier
router.post("/", authenticate, async (req, res) => {
  try {
    const {
      buyer_id,
      supplier_id,
      product_id,
      product_name,
      quantity,
      target_price,
      required_delivery_date,
      notes,
    } = req.body;

    if (!buyer_id || !supplier_id || !product_name || !quantity || !target_price) {
      return res.status(400).json({
        error: "Buyer, supplier, product, quantity and target price are required",
      });
    }

    const total = Number(quantity) * Number(target_price);

    const result = await pool.query(
      `
      INSERT INTO buyer_quotations
      (
        buyer_id,
        supplier_id,
        product_id,
        product_name,
        quantity,
        target_price,
        total,
        required_delivery_date,
        notes,
        status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Pending')
      RETURNING *
      `,
      [
        buyer_id,
        supplier_id,
        product_id || null,
        product_name,
        quantity,
        target_price,
        total,
        required_delivery_date || null,
        notes || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create buyer quotation error:", error);
    res.status(500).json({ error: "Failed to send quotation" });
  }
});

// Get buyer quotations
router.get("/", authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        bq.*,
        b.name AS buyer_name,
        s.name AS supplier_name
      FROM buyer_quotations bq
      LEFT JOIN buyers b ON bq.buyer_id = b.id
      LEFT JOIN suppliers s ON bq.supplier_id = s.id
      ORDER BY bq.id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Get buyer quotations error:", error);
    res.status(500).json({ error: "Failed to fetch buyer quotations" });
  }
});

// Update buyer quotation status / add supplier notes
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, supplier_notes } = req.body;
    const allowedStatuses = ['Pending', 'Confirmed', 'Received', 'Rejected'];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of ${allowedStatuses.join(', ')}` });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const currentRes = await client.query(
        "SELECT status, product_id, quantity FROM buyer_quotations WHERE id = $1",
        [id]
      );
      if (currentRes.rows.length === 0) {
        return res.status(404).json({ error: "Quotation not found" });
      }

      const current = currentRes.rows[0];
      if (current.status === 'Received' && status !== 'Received') {
        return res.status(400).json({ error: "Cannot change status after receipt" });
      }
      if (current.status === 'Received' && status === 'Received') {
        return res.status(400).json({ error: "Quotation already marked as received" });
      }

      const updateRes = await client.query(
        `UPDATE buyer_quotations SET status = $1, supplier_notes = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
        [status, supplier_notes || current.supplier_notes, id]
      );

      if (status === 'Received' && current.product_id) {
        await client.query(
          "UPDATE products SET stock = COALESCE(stock, 0) + $1 WHERE id = $2",
          [current.quantity, current.product_id]
        );
      }

      await client.query('COMMIT');
      res.json(updateRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;