const axios = require("axios");
const pool = require("./db");

async function testCreateVehicle() {
  try {
    // Get a valid token first
    const loginRes = await axios.post("http://localhost:5001/api/auth/login", {
      email: "admin@yopmail.com",
      password: "Admin@123"
    });

    const token = loginRes.data.token;
    console.log("✓ Logged in successfully");

    // Try to create a vehicle
    const vehicleRes = await axios.post(
      "http://localhost:5001/api/transport/vehicles",
      {
        vehicle_number: "TEST-001",
        vehicle_type: "Truck",
        capacity_kg: 5000,
        capacity_volume: 100,
        driver_name: "Test Driver",
        driver_phone: "1234567890",
        current_latitude: 0,
        current_longitude: 0,
        assigned_warehouse_id: 1,
        status: "available"
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    console.log("✓ Vehicle created successfully:", vehicleRes.data);
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
  } finally {
    pool.end();
  }
}

testCreateVehicle();