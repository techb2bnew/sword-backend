const express = require("express");
const router = express.Router();
const pool = require("../db");

// Real-time Stock, Batch / Lot & Best-before, Multi-warehouse, Cycle Counting, Stock Replenishment

router.post("/products", async (req, res) => {
  try {
    const { name, price, barcode, stock } = req.body;
    const newProduct = await pool.query(
      "INSERT INTO products (name, price, barcode, stock) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, price, barcode, stock || 0]
    );
    res.json(newProduct.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/products", async (req, res) => {
  try {
    const products = await pool.query("SELECT * FROM products ORDER BY id DESC");
    res.json(products.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, barcode, stock } = req.body;
    const update = await pool.query(
      "UPDATE products SET name = $1, price = $2, barcode = $3, stock = $4 WHERE id = $5 RETURNING *",
      [name, price, barcode, stock, id]
    );
    res.json(update.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
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
