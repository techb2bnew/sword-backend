const express = require("express");
const router = express.Router();
const pool = require("./db");

router.post("/products", async (req, res) => {
  try {
    const { name, price, barcode } = req.body;
    const newProduct = await pool.query(
      "INSERT INTO products (name, price, barcode) VALUES ($1, $2, $3) RETURNING *",
      [name, price, barcode]
    );
    res.json(newProduct.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/products", async (req, res) => {
  try {
    const products = await pool.query("SELECT * FROM products");
    res.json(products.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
