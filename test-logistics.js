require('dotenv').config();
const { processLogistics } = require('./services/logisticsService');

const test = async (id) => {
  try {
    console.log(`Testing Logistics for Order ID: ${id}`);
    const result = await processLogistics(id);
    console.log('Success!', result);
  } catch (err) {
    console.error('FAILED:', err.message);
  }
  process.exit(0);
};

// Check which ID matches ORD-947852
const pool = require('./db');
pool.query("SELECT id FROM customer_orders WHERE order_number = 'ORD-947852'").then(res => {
  if (res.rows.length > 0) test(res.rows[0].id);
  else { console.log('Order not found'); process.exit(0); }
});
