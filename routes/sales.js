const express = require("express");
const router = express.Router();

// Sales Order Processing, Pricing & Discounts, Credit Management, Delivery Scheduling, Customer Service
router.get("/orders", (req, res) => {
  res.json({ message: "Sales Orders endpoint" });
});

router.post("/orders", (req, res) => {
  res.json({ message: "Create Sales Order endpoint" });
});

module.exports = router;
