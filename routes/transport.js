const express = require("express");
const router = express.Router();
const pool = require("../db");

// Vehicles
router.get("/vehicles", async (req, res) => {
  try {
    const vehicles = await pool.query("SELECT * FROM vehicles ORDER BY id DESC");
    res.json(vehicles.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/vehicles", async (req, res) => {
  try {
    const { plate_number, vehicle_type, capacity, driver_name } = req.body;
    const newVehicle = await pool.query(
      "INSERT INTO vehicles (plate_number, vehicle_type, capacity, driver_name) VALUES ($1, $2, $3, $4) RETURNING *",
      [plate_number, vehicle_type, capacity, driver_name]
    );
    res.json(newVehicle.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shipments
router.get("/shipments", async (req, res) => {
  try {
    const shipments = await pool.query(`
      SELECT s.*, v.plate_number, v.driver_name 
      FROM shipments s 
      LEFT JOIN vehicles v ON s.vehicle_id = v.id 
      ORDER BY s.id DESC
    `);
    res.json(shipments.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/shipments", async (req, res) => {
  try {
    const { order_id, vehicle_id, route_details, estimated_delivery } = req.body;
    const newShipment = await pool.query(
      "INSERT INTO shipments (order_id, vehicle_id, route_details, estimated_delivery) VALUES ($1, $2, $3, $4) RETURNING *",
      [order_id, vehicle_id, route_details, estimated_delivery]
    );
    // Update vehicle status
    await pool.query("UPDATE vehicles SET status = 'On Trip' WHERE id = $1", [vehicle_id]);
    res.json(newShipment.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/shipments/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const update = await pool.query("UPDATE shipments SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
      
      if (status === 'Delivered' || status === 'Cancelled') {
        await pool.query("UPDATE vehicles SET status = 'Available' WHERE id = $1", [update.rows[0].vehicle_id]);
      }
      
      res.json(update.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

module.exports = router;
