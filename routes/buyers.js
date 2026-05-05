const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticate } = require("../middleware/auth");

// Get all buyers
router.get("/", authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, phone, company_name, status, created_at
      FROM buyers
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Get buyers error:", error);
    res.status(500).json({ error: "Failed to fetch buyers" });
  }
});

// Create buyer
router.post("/", authenticate, async (req, res) => {
  try {
    const { name, email, phone, company_name } = req.body;

    if (!name || !email || !phone) {
      return res.status(400).json({ error: "Name, email and phone are required" });
    }

    const result = await pool.query(
      `
      INSERT INTO buyers (name, email, phone, company_name, status)
      VALUES ($1, $2, $3, $4, 'Active')
      RETURNING *
      `,
      [name, email, phone, company_name]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create buyer error:", error);
    res.status(500).json({ error: "Failed to create buyer" });
  }
});

module.exports = router;