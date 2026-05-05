const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticate } = require("../middleware/auth");

// GET /api/transport/vehicles - List all vehicles
router.get("/vehicles", authenticate, async (req, res) => {
  try {
    const query = `
      SELECT v.*, w.name as warehouse_name 
      FROM vehicles v 
      LEFT JOIN warehouses w ON v.assigned_warehouse_id = w.id 
      ORDER BY v.id DESC
    `;
    const vehicles = await pool.query(query);
    res.json(vehicles.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transport/vehicles/:id - Get single vehicle details
router.get("/vehicles/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const vehicle = await pool.query(
      "SELECT v.*, w.name as warehouse_name FROM vehicles v LEFT JOIN warehouses w ON v.assigned_warehouse_id = w.id WHERE v.id = $1", 
      [id]
    );
    if (vehicle.rows.length === 0) return res.status(404).json({ error: "Vehicle not found" });
    res.json(vehicle.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transport/vehicles - Create new vehicle
router.post("/vehicles", authenticate, async (req, res) => {
  try {
    const { 
      vehicle_number, vehicle_type, capacity_kg, capacity_volume, 
      driver_name, driver_phone, current_latitude, current_longitude, 
      assigned_warehouse_id, status 
    } = req.body;

    if (!vehicle_number || !driver_name || !capacity_kg) {
      return res.status(400).json({ error: "vehicle_number, driver_name, and capacity_kg are required" });
    }

    const result = await pool.query(
      `INSERT INTO vehicles (
        vehicle_number, vehicle_type, capacity_kg, capacity_volume, 
        driver_name, driver_phone, current_latitude, current_longitude, 
        assigned_warehouse_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        vehicle_number, vehicle_type || 'Truck', capacity_kg || 0, capacity_volume || 0, 
        driver_name, driver_phone, current_latitude, current_longitude, 
        assigned_warehouse_id, status || 'available'
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Vehicle creation error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/transport/vehicles/:id - Update vehicle
router.put("/vehicles/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      vehicle_number, vehicle_type, capacity_kg, capacity_volume, 
      driver_name, driver_phone, current_latitude, current_longitude, 
      assigned_warehouse_id, status 
    } = req.body;

    const result = await pool.query(
      `UPDATE vehicles SET 
        vehicle_number = $1, vehicle_type = $2, capacity_kg = $3, capacity_volume = $4, 
        driver_name = $5, driver_phone = $6, current_latitude = $7, current_longitude = $8, 
        assigned_warehouse_id = $9, status = $10
      WHERE id = $11 RETURNING *`,
      [
        vehicle_number, vehicle_type, capacity_kg, capacity_volume, 
        driver_name, driver_phone, current_latitude, current_longitude, 
        assigned_warehouse_id, status, id
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Vehicle not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/transport/vehicles/:id - Delete vehicle
router.delete("/vehicles/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM vehicles WHERE id = $1 RETURNING *", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Vehicle not found" });
    res.json({ message: "Vehicle deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transport/shipments - List all shipments
router.get("/shipments", authenticate, async (req, res) => {
  try {
    const shipments = await pool.query(`
      SELECT s.*, v.vehicle_number, v.driver_name 
      FROM shipments s 
      LEFT JOIN vehicles v ON s.vehicle_id = v.id 
      ORDER BY s.id DESC
    `);
    res.json(shipments.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
