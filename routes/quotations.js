const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticate } = require("../middleware/auth");

// Get all quotations (Admin view or specific supplier)
router.get("/", authenticate, async (req, res) => {
  try {
    let query = `
      SELECT q.*, s.name as supplier_name, p.name as product_name 
      FROM quotations q
      JOIN suppliers s ON q.supplier_id = s.id
      JOIN products p ON q.product_id = p.id
    `;
    let params = [];

    if (req.user.role === 'supplier') {
      // Find the supplier_id linked to this user
      const userResult = await pool.query("SELECT supplier_id FROM users WHERE id = $1", [req.user.id]);
      const supplierId = userResult.rows[0].supplier_id;
      
      if (!supplierId) {
        return res.status(403).json({ error: "User is not linked to a supplier profile" });
      }
      
      query += " WHERE q.supplier_id = $1";
      params.push(supplierId);
    }

    query += " ORDER BY q.created_at DESC";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Create a new quotation (Supplier)
router.post("/", authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'supplier' && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Only suppliers can create quotations" });
    }

    const { product_id, quantity, unit_price, valid_until, expected_delivery, notes } = req.body;
    let supplier_id = req.body.supplier_id;

    if (req.user.role === 'supplier') {
      const userResult = await pool.query("SELECT supplier_id FROM users WHERE id = $1", [req.user.id]);
      supplier_id = userResult.rows[0].supplier_id;
    }

    if (!supplier_id) {
      return res.status(400).json({ error: "Supplier ID is required" });
    }

    const total_amount = quantity * unit_price;

    const result = await pool.query(
      `INSERT INTO quotations 
      (supplier_id, product_id, quantity, unit_price, total_amount, valid_until, expected_delivery, notes) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [supplier_id, product_id, quantity, unit_price, total_amount, valid_until, expected_delivery, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Update quotation status (Admin)
router.put("/:id/status", authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Only admins can update quotation status" });
    }

    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      "UPDATE quotations SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
