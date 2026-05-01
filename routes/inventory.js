const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticate } = require("../middleware/auth");

// Real-time Stock, Batch / Lot & Best-before, Multi-warehouse, Cycle Counting, Stock Replenishment

router.post("/products", authenticate, async (req, res) => {
  try {
    const { name, price, barcode, stock, type, uom, warehouse_id, bin_id } = req.body;
    let supplier_id = req.body.supplier_id || null;

    if (req.user.role === 'supplier') {
        const userResult = await pool.query("SELECT supplier_id FROM users WHERE id = $1", [req.user.id]);
        supplier_id = userResult.rows[0].supplier_id;
    }

    const newProduct = await pool.query(
      "INSERT INTO products (name, price, barcode, stock, type, uom, warehouse_id, bin_id, supplier_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
      [name, price, barcode, stock || 0, type || 'finished_good', uom || 'units', warehouse_id || null, bin_id || null, supplier_id]
    );
    res.json(newProduct.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/products", authenticate, async (req, res) => {
  try {
    let params = [];
    let whereClause = "";

    if (req.user.role === 'supplier') {
      const userResult = await pool.query("SELECT supplier_id FROM users WHERE id = $1", [req.user.id]);
      const supplierId = userResult.rows[0].supplier_id;
      
      if (supplierId) {
        whereClause = " WHERE p.supplier_id = $1";
        params.push(supplierId);
      } else {
        return res.status(403).json({ error: "Supplier profile not found for this user" });
      }
    }

    let query = `
      SELECT p.*, w.name as warehouse_name, s.name as supplier_name,
             STRING_AGG(DISTINCT b.rack_code || '-' || b.bin_code, ', ') as locations
      FROM products p
      LEFT JOIN warehouses w ON p.warehouse_id = w.id
      LEFT JOIN bins b ON (b.id = p.bin_id OR b.id IN (SELECT bin_id FROM warehouse_allocations WHERE product_id = p.id AND status = 'allocated'))
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      ${whereClause}
      GROUP BY p.id, w.name, s.name
      ORDER BY p.id DESC
    `;

    const products = await pool.query(query, params);
    res.json(products.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, barcode, stock, type, uom, warehouse_id, bin_id, supplier_id } = req.body;
    const update = await pool.query(
      "UPDATE products SET name = $1, price = $2, barcode = $3, stock = $4, type = $5, uom = $6, warehouse_id = $7, bin_id = $8, supplier_id = $9 WHERE id = $10 RETURNING *",
      [name, price, barcode, stock, type, uom, warehouse_id || null, bin_id || null, supplier_id || null, id]
    );
    if (bin_id) {
        await pool.query("UPDATE bins SET status = 'Occupied' WHERE id = $1", [bin_id]);
    }
    res.json(update.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM products WHERE id = $1", [id]);
    res.json({ message: "Product deleted" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
