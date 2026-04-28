const express = require("express");
const router = express.Router();

// Pick-face / Bin Management, Barcode / RF Scanning, Picking & Packing, Dispatch & Delivery, Returns Management
router.get("/picking", (req, res) => {
  res.json({ message: "Picking & Packing endpoint" });
});

router.get("/dispatch", (req, res) => {
  res.json({ message: "Dispatch & Delivery endpoint" });
});

module.exports = router;
