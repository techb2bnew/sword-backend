const pool = require('../db');

/**
 * Background job to check delivery deadlines.
 * Checks every hour for:
 * 1. Allocations due within 24 hours.
 * 2. Overdue allocations.
 */
async function checkDeliveryDeadlines() {
  console.log('[Job] Checking delivery deadlines...');
  try {
    // 1. Find orders due within 24 hours that haven't been notified yet
    // (We use a simple logic: if notification doesn't exist for this related_id in the last 24h)
    const upcoming = await pool.query(`
      SELECT q.id, q.delivery_due_at, s.name as supplier_name, p.name as product_name
      FROM quotations q
      JOIN suppliers s ON q.supplier_id = s.id
      JOIN products p ON q.product_id = p.id
      WHERE q.status = 'Accepted' 
        AND q.delivery_due_at > NOW() 
        AND q.delivery_due_at <= NOW() + INTERVAL '24 hours'
        AND NOT EXISTS (
          SELECT 1 FROM notifications 
          WHERE related_id = q.id AND title LIKE 'Upcoming Delivery%'
        )
    `);

    for (const row of upcoming.rows) {
      const hoursLeft = Math.round((new Date(row.delivery_due_at) - new Date()) / (1000 * 60 * 60));
      await pool.query(
        `INSERT INTO notifications (title, message, type, related_id) 
         VALUES ($1, $2, $3, $4)`,
        [
          `Upcoming Delivery: #${row.id}`,
          `Order #${row.id} (${row.product_name}) from ${row.supplier_name} must be delivered in ${hoursLeft} hours.`,
          'warning',
          row.id
        ]
      );
      console.log(`[Job] Created upcoming notification for Quote #${row.id}`);
    }

    // 2. Find overdue orders
    const overdue = await pool.query(`
      SELECT q.id, s.name as supplier_name, p.name as product_name
      FROM quotations q
      JOIN suppliers s ON q.supplier_id = s.id
      JOIN products p ON q.product_id = p.id
      WHERE q.status = 'Accepted' 
        AND q.delivery_due_at < NOW()
        AND NOT EXISTS (
          SELECT 1 FROM notifications 
          WHERE related_id = q.id AND title LIKE 'Overdue Delivery%'
        )
    `);

    for (const row of overdue.rows) {
      await pool.query(
        `INSERT INTO notifications (title, message, type, related_id) 
         VALUES ($1, $2, $3, $4)`,
        [
          `Overdue Delivery: #${row.id}`,
          `Order #${row.id} (${row.product_name}) from ${row.supplier_name} is overdue!`,
          'danger',
          row.id
        ]
      );
      // Update allocation status to overdue if applicable
      await pool.query(
        "UPDATE warehouse_allocations SET status = 'overdue' WHERE quotation_id = $1",
        [row.id]
      );
      console.log(`[Job] Created overdue notification for Quote #${row.id}`);
    }

  } catch (err) {
    console.error('[Job Error] checkDeliveryDeadlines:', err.message);
  }
}

function startNotificationJob() {
  // Check every hour (3600000 ms)
  // For testing purposes or immediate start, run once now
  checkDeliveryDeadlines();
  setInterval(checkDeliveryDeadlines, 3600000);
}

module.exports = {
  startNotificationJob
};
