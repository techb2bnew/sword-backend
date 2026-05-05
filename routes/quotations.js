const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticate } = require("../middleware/auth");
const { autoAllocateWarehouse } = require("../services/allocationService");

// Get all quotations (Admin view or specific supplier)
router.get("/", authenticate, async (req, res) => {
  try {
    let whereClause = "";
    let params = [];

    if (req.user.role === 'supplier') {
      const userResult = await pool.query("SELECT supplier_id FROM users WHERE id = $1", [req.user.id]);
      const supplierId = userResult.rows[0].supplier_id;
      if (!supplierId) return res.status(403).json({ error: "User not linked to supplier" });
      whereClause = "WHERE q.supplier_id = $1";
      params.push(supplierId);
    }

    let query = `
      SELECT q.*, s.name as supplier_name, p.name as product_name,
             JSON_AGG(JSON_BUILD_OBJECT(
               'barcode_id', wa.barcode_id,
               'warehouse_name', w.name,
               'rack_code', b.rack_code,
               'bin_code', b.bin_code,
               'quantity', wa.quantity
             )) FILTER (WHERE wa.id IS NOT NULL) as allocations
      FROM quotations q
      JOIN suppliers s ON q.supplier_id = s.id
      JOIN products p ON q.product_id = p.id
      LEFT JOIN warehouse_allocations wa ON q.id = wa.quotation_id
      LEFT JOIN warehouses w ON wa.warehouse_id = w.id
      LEFT JOIN bins b ON wa.bin_id = b.id
      ${whereClause}
      GROUP BY q.id, s.name, p.name
      ORDER BY q.created_at DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new quotation (Supplier)
router.post("/", authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'supplier' && req.user.role !== 'admin' && req.user.role !== 'buyer') {
      return res.status(403).json({ error: "Only suppliers can create quotations" });
    }

    const { product_id, quantity, unit_price, valid_until, expected_delivery, notes, credit_days } = req.body;
    let supplier_id = req.body.supplier_id;

    if (req.user.role === 'supplier') {
      const userResult = await pool.query("SELECT supplier_id FROM users WHERE id = $1", [req.user.id]);
      supplier_id = userResult.rows[0].supplier_id;
    }

    if (!supplier_id) return res.status(400).json({ error: "Supplier ID is required" });

    const total_amount = quantity * unit_price;

    const result = await pool.query(
      `INSERT INTO quotations 
      (supplier_id, product_id, quantity, unit_price, total_amount, valid_until, expected_delivery, notes, credit_days) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [supplier_id, product_id, quantity, unit_price, total_amount, valid_until, expected_delivery, notes, credit_days || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update quotation status (Admin)
router.put("/:id/status", authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Only admins can update status" });

    const { id } = req.params;
    const { status } = req.body;

    if (status === 'Accepted') {
      try {
        const allocation = await autoAllocateWarehouse(id);
        res.json({ message: "Quotation accepted and allocated", ...allocation });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    } else {
      const result = await pool.query(
        "UPDATE quotations SET status = $1 WHERE id = $2 RETURNING *",
        [status, id]
      );
      res.json(result.rows[0]);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
