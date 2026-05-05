const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticate } = require("../middleware/auth");
const axios = require("axios");

// Helper function for geocoding
async function getCoordinates(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const response = await axios.get(url, {
      headers: { "User-Agent": "Sword-ERP-System" }
    });
    if (response.data && response.data.length > 0) {
      return {
        lat: parseFloat(response.data[0].lat),
        lon: parseFloat(response.data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error.message);
    return null;
  }
}

// GET /api/customers - List all customers
router.get("/", authenticate, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM customers ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/:id - Get a single customer
router.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM customers WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers - Create a new customer
router.post("/", authenticate, async (req, res) => {
  try {
    const {
      customer_name,
      company_name,
      email,
      phone,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      pincode,
      delivery_priority,
      status
    } = req.body;

    let { latitude, longitude } = req.body;

    // Validation
    if (!customer_name || !phone || !address_line_1 || !city || !state || !pincode) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Auto-fetch coordinates if not provided
    if (!latitude || !longitude) {
      const fullAddress = `${address_line_1}, ${city}, ${state}, ${country}, ${pincode}`;
      const coords = await getCoordinates(fullAddress);
      if (coords) {
        latitude = coords.lat;
        longitude = coords.lon;
      } else {
        // Fallback or error? Let's default to 0 for now but maybe we should warn
        latitude = latitude || 0;
        longitude = longitude || 0;
      }
    }

    const result = await pool.query(
      `INSERT INTO customers (
        customer_name, company_name, email, phone, address_line_1, address_line_2, 
        city, state, country, pincode, latitude, longitude, delivery_priority, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        customer_name,
        company_name,
        email,
        phone,
        address_line_1,
        address_line_2,
        city,
        state,
        country || "India",
        pincode,
        latitude,
        longitude,
        delivery_priority || "normal",
        status || "active"
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/customers/:id - Update an existing customer
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customer_name,
      company_name,
      email,
      phone,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      pincode,
      delivery_priority,
      status
    } = req.body;

    let { latitude, longitude } = req.body;

    // Validation
    if (!customer_name || !phone || !address_line_1 || !city || !state || !pincode) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Re-fetch coordinates if address changed or if they are missing
    if (!latitude || !longitude) {
      const fullAddress = `${address_line_1}, ${city}, ${state}, ${country}, ${pincode}`;
      const coords = await getCoordinates(fullAddress);
      if (coords) {
        latitude = coords.lat;
        longitude = coords.lon;
      }
    }

    const result = await pool.query(
      `UPDATE customers SET 
        customer_name = $1, company_name = $2, email = $3, phone = $4, address_line_1 = $5, 
        address_line_2 = $6, city = $7, state = $8, country = $9, pincode = $10, 
        latitude = $11, longitude = $12, delivery_priority = $13, status = $14
      WHERE id = $15 RETURNING *`,
      [
        customer_name,
        company_name,
        email,
        phone,
        address_line_1,
        address_line_2,
        city,
        state,
        country,
        pincode,
        latitude || 0,
        longitude || 0,
        delivery_priority,
        status,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/customers/:id - Delete a customer
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM customers WHERE id = $1 RETURNING *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json({ message: "Customer deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
