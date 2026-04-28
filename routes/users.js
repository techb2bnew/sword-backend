const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticate, authorize } = require("../middleware/auth");

// GET /api/users -- admin only
router.get("/", authenticate, authorize("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, email, role, created_at FROM users ORDER BY id"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users/:id -- admin only
router.get("/:id", authenticate, authorize("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, email, role, created_at FROM users WHERE id = $1",
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/users/:id -- admin only
router.put("/:id", authenticate, authorize("admin"), async (req, res) => {
  try {
    const { username, email, role } = req.body;
    const result = await pool.query(
      "UPDATE users SET username = COALESCE($1, username), email = COALESCE($2, email), role = COALESCE($3, role) WHERE id = $4 RETURNING id, username, email, role, created_at",
      [username, email, role, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/users/:id -- admin only
router.delete("/:id", authenticate, authorize("admin"), async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
