const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticate } = require("../middleware/auth");

const formatCurrency = (amount) => `₹${parseFloat(amount).toLocaleString('en-IN')}`;

// GET /api/finance/stats - Aggregated stats
router.get("/stats", authenticate, async (req, res) => {
  try {
    const payablesRes = await pool.query(`SELECT COALESCE(SUM(total_amount), 0) as payables FROM purchase_orders WHERE status NOT IN ('Received', 'Cancelled')`);

    const receivablesRes = await pool.query(`
      SELECT COALESCE(SUM(p.price * coi.quantity), 0) as receivables
      FROM customer_orders co
      JOIN customer_order_items coi ON co.id = coi.order_id
      JOIN products p ON coi.product_id = p.id
      WHERE co.status NOT IN ('delivered', 'cancelled')
    `);

    const salesRevenueRes = await pool.query(`
      SELECT COALESCE(SUM(p.price * coi.quantity), 0) as sales_revenue
      FROM customer_orders co
      JOIN customer_order_items coi ON co.id = coi.order_id
      JOIN products p ON coi.product_id = p.id
      WHERE co.status = 'delivered'
    `);

    const purchaseCostRes = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) as purchase_cost
      FROM purchase_orders WHERE status = 'Received'
    `);

    const manualLedger = await pool.query(`SELECT type, status, COALESCE(SUM(amount), 0) as total FROM finance_ledger GROUP BY type, status`);

    let completedCredits = parseFloat(salesRevenueRes.rows[0].sales_revenue || 0);
    let completedDebits = parseFloat(purchaseCostRes.rows[0].purchase_cost || 0);
    let pendingDebits = 0;

    manualLedger.rows.forEach(row => {
      if (row.type === 'Credit' && row.status === 'Completed') completedCredits += parseFloat(row.total);
      if (row.type === 'Debit' && row.status === 'Completed') completedDebits += parseFloat(row.total);
      if (row.type === 'Debit' && row.status === 'Pending') pendingDebits += parseFloat(row.total);
    });

    const cashOnHand = completedCredits - completedDebits;
    const netProfit = cashOnHand;

    res.json({
      cashOnHand: formatCurrency(cashOnHand),
      receivables: formatCurrency(receivablesRes.rows[0].receivables),
      payables: formatCurrency(parseFloat(payablesRes.rows[0].payables) + pendingDebits),
      netProfit: formatCurrency(netProfit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/finance/ledger - Merged fully dynamic ledger
router.get("/ledger", authenticate, async (req, res) => {
  try {
    const query = `
      SELECT id, date, description, type, amount, status, category, 'manual' as source
      FROM finance_ledger
      
      UNION ALL
      
      SELECT 
        co.id * 1000000 as id, 
        co.created_at::date as date, 
        'Sales Revenue - ' || co.order_number as description, 
        'Credit' as type, 
        (SELECT COALESCE(SUM(p.price * coi.quantity), 0) 
         FROM customer_order_items coi JOIN products p ON coi.product_id = p.id 
         WHERE coi.order_id = co.id) as amount, 
        'Completed' as status, 
        'Sales Revenue' as category,
        'auto' as source
      FROM customer_orders co 
      WHERE co.status = 'delivered'
      
      UNION ALL
      
      SELECT 
        po.id * 2000000 as id, 
        po.order_date as date, 
        'Cost of Goods - PO#' || po.id as description, 
        'Debit' as type, 
        po.total_amount as amount, 
        'Completed' as status, 
        'Cost of Goods' as category,
        'auto' as source
      FROM purchase_orders po 
      WHERE po.status = 'Received'
      
      ORDER BY date DESC, id DESC
      LIMIT 100
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/ledger
router.post("/ledger", authenticate, async (req, res) => {
  try {
    const { date, description, type, amount, status, category, reference_id } = req.body;
    const result = await pool.query(
      `INSERT INTO finance_ledger (date, description, type, amount, status, category, reference_id) 
       VALUES (COALESCE($1, CURRENT_DATE), $2, $3, $4, $5, $6, $7) RETURNING *`,
      [date, description, type, amount, status || 'Completed', category || 'Other', reference_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/finance/ledger/:id/status (only for manual entries)
router.put("/ledger/:id/status", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    // Prevent updating auto-generated union IDs
    if (parseInt(id) > 500000) return res.status(400).json({ error: "Cannot modify auto-generated ledger entries." });
    
    const result = await pool.query("UPDATE finance_ledger SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
