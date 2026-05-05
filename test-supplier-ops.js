const axios = require("axios");
const pool = require("./db");

async function testSupplierOps() {
  try {
    // Get a valid token first
    const loginRes = await axios.post("http://localhost:5001/api/auth/login", {
      email: "admin@yopmail.com",
      password: "Admin@123"
    });

    const token = loginRes.data.token;
    const headers = { Authorization: `Bearer ${token}` };
    console.log("✓ Logged in successfully\n");

    // Test 1: Create supplier
    console.log("Test 1: Creating supplier...");
    const createRes = await axios.post(
      "http://localhost:5001/api/purchases/suppliers",
      {
        name: "New Test Supplier",
        contact_person: "Jane Smith",
        email: "jane@supplier.com",
        phone: "9876543210",
        address: "456 Business Blvd"
      },
      { headers }
    );
    const supplierId = createRes.data.id;
    console.log(`✓ Supplier created with ID: ${supplierId}\n`);

    // Test 2: Update supplier
    console.log("Test 2: Updating supplier...");
    const updateRes = await axios.put(
      `http://localhost:5001/api/purchases/suppliers/${supplierId}`,
      {
        name: "Updated Test Supplier",
        contact_person: "Jane Doe",
        email: "jane.doe@supplier.com",
        phone: "9876543211",
        address: "789 Updated St"
      },
      { headers }
    );
    console.log(`✓ Supplier updated: ${updateRes.data.name}\n`);

    // Test 3: Fetch suppliers
    console.log("Test 3: Fetching suppliers...");
    const listRes = await axios.get("http://localhost:5001/api/purchases/suppliers", { headers });
    console.log(`✓ Found ${listRes.data.length} suppliers\n`);

    // Test 4: Delete supplier
    console.log("Test 4: Deleting supplier...");
    await axios.delete(`http://localhost:5001/api/purchases/suppliers/${supplierId}`, { headers });
    console.log(`✓ Supplier deleted\n`);

    console.log("✅ All supplier operations working correctly!");

  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
  } finally {
    pool.end();
  }
}

testSupplierOps();