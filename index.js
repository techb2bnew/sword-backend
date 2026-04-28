require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const financeRoutes = require("./routes/finance");
const inventoryRoutes = require("./routes/inventory");
const warehouseRoutes = require("./routes/warehouse");
const salesRoutes = require("./routes/sales");
const reportingRoutes = require("./routes/reporting");

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.get("/", (req, res) => {
  res.send("ERP Backend Running");
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/inventory", inventoryRoutes); // Using this for products
app.use("/api/warehouse", warehouseRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/reporting", reportingRoutes);

app.use((req, res) => {
  console.log(`404: ${req.method} ${req.url}`);
  res.status(404).json({ error: `Path ${req.url} not found on this server` });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
