const express = require("express");
const router = express.Router();

// Built-in Dashboards, Real-time Insights, KPI Tracking, Mobile Access
router.get("/dashboard", (req, res) => {
  res.json({ message: "Dashboard Data endpoint" });
});

module.exports = router;
