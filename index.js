// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");

// const authRoutes = require("./routes/auth");
// const usersRoutes = require("./routes/users");
// const financeRoutes = require("./routes/finance");
// const inventoryRoutes = require("./routes/inventory");
// const advancedInventoryRoutes = require("./routes/advanced-inventory");
// const warehouseRoutes = require("./routes/warehouse");
// const salesRoutes = require("./routes/sales");
// const reportingRoutes = require("./routes/reporting");
// const purchaseRoutes = require("./routes/purchases");
// const transportRoutes = require("./routes/transport");
// const quotationsRoutes = require("./routes/quotations");
// const customerRoutes = require("./routes/customers");
// const customerOrdersRoutes = require("./routes/customer_orders");
// const buyersRoutes = require("./routes/buyers");
// const buyerQuotationsRoutes = require("./routes/buyerQuotations");

// const app = express();
// const PORT = process.env.PORT || 5001;

// app.use(cors());
// app.use(express.json());

// app.use((req, res, next) => {
//   res.on('finish', () => {
//     console.log(`${req.method} ${req.url} - ${res.statusCode}`);
//   });
//   next();
// });

// app.get("/", (req, res) => {
//   res.send("ERP Backend Running");
// });

// app.use("/api/auth", authRoutes);
// app.use("/api/users", usersRoutes);
// app.use("/api/finance", financeRoutes);
// app.use("/api/inventory", inventoryRoutes); // Using this for products
// app.use("/api/inventory", advancedInventoryRoutes); // Batch, cycle count, barcode scanning
// app.use("/api/warehouse", warehouseRoutes);
// app.use("/api/sales", salesRoutes);
// app.use("/api/reporting", reportingRoutes);
// app.use("/api/purchases", purchaseRoutes);
// app.use("/api/transport", transportRoutes);
// app.use("/api/quotations", quotationsRoutes);
// app.use("/api/customers", customerRoutes);
// app.use("/api/customer-orders", customerOrdersRoutes);
// app.use("/api/notifications", require("./routes/notifications"));
// app.use("/api/buyers", buyersRoutes);
// app.use("/api/buyer-quotations", buyerQuotationsRoutes);

// const { startNotificationJob } = require("./jobs/notificationJob");
// startNotificationJob();

// app.use((req, res) => {
//   console.log(`404: ${req.method} ${req.url}`);
//   res.status(404).json({ error: `Path ${req.url} not found on this server` });
// });

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });



require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const financeRoutes = require("./routes/finance");
const inventoryRoutes = require("./routes/inventory");
const advancedInventoryRoutes = require("./routes/advanced-inventory");
const warehouseRoutes = require("./routes/warehouse");
const salesRoutes = require("./routes/sales");
const reportingRoutes = require("./routes/reporting");
const purchaseRoutes = require("./routes/purchases");
const transportRoutes = require("./routes/transport");
const quotationsRoutes = require("./routes/quotations");
const customerRoutes = require("./routes/customers");
const customerOrdersRoutes = require("./routes/customer_orders");
const buyersRoutes = require("./routes/buyers");
const buyerQuotationsRoutes = require("./routes/buyerQuotations");

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use((req, res, next) => {
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} - ${res.statusCode}`);
  });
  next();
});

app.get("/", (req, res) => {
  res.status(200).send("ERP Backend Running");
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/inventory", advancedInventoryRoutes);
app.use("/api/warehouse", warehouseRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/reporting", reportingRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/transport", transportRoutes);
app.use("/api/quotations", quotationsRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/customer-orders", customerOrdersRoutes);
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/buyers", buyersRoutes);
app.use("/api/buyer-quotations", buyerQuotationsRoutes);

// Do not run background jobs directly on Vercel serverless.
// It can crash or run multiple times.
// Use Vercel Cron Jobs instead.
// const { startNotificationJob } = require("./jobs/notificationJob");
// startNotificationJob();

app.use((req, res) => {
  console.log(`404: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: `Path ${req.originalUrl} not found on this server`,
  });
});

app.use((err, req, res, next) => {
  console.error("Server Error:", err);

  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "production" ? undefined : err.message,
  });
});

module.exports = app;