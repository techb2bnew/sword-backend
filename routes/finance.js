const express = require("express");
const router = express.Router();

// General Ledger, A/R & A/P, Cash Management, VAT / GST, Fixed Assets
router.get("/ledger", (req, res) => {
  res.json({ message: "General Ledger endpoint" });
});

router.get("/cash-management", (req, res) => {
  res.json({ message: "Cash Management endpoint" });
});

module.exports = router;
