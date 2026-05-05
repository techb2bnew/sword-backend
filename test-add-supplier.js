const axios = require("axios");
const pool = require("./db");

async function testAddSupplier() {
  try {
    // Get a valid token first
    const loginRes = await axios.post("http://localhost:5001/api/auth/login", {
      email: "admin@yopmail.com",
      password: "Admin@123"
    });

    const token = loginRes.data.token;
    console.log("✓ Logged in successfully");

    // Try to create a supplier
    const supplierRes = await axios.post(
      "http://localhost:5001/api/purchases/suppliers",
      {
        name: "Test Supplier",
        contact_person: "John Doe",
        email: "john@supplier.com",
        phone: "9876543210",
        address: "123 Main St"
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    console.log("✓ Supplier created successfully:", supplierRes.data);
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
    if (err.response?.data) {
      console.error("Full error:", JSON.stringify(err.response.data, null, 2));
    }
  } finally {
    pool.end();
  }
}

testAddSupplier();