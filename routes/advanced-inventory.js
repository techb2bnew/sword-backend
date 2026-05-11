const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticate } = require("../middleware/auth");

// ─────────────────────────────────────────────────────────────────────────────
// BATCH/LOT MANAGEMENT APIs
// ─────────────────────────────────────────────────────────────────────────────

// Create new batch
router.post("/batches", authenticate, async (req, res) => {
  try {
    const { product_id, batch_number, lot_number, warehouse_id, bin_id, quantity_received, best_before_date, manufacture_date, supplier_id, notes } = req.body;

    if (!product_id || !batch_number || !quantity_received) {
      return res.status(400).json({ error: "product_id, batch_number, and quantity_received are required" });
    }

    const result = await pool.query(
      `INSERT INTO inventory_batches (product_id, batch_number, lot_number, warehouse_id, bin_id, quantity_received, quantity_available, best_before_date, manufacture_date, supplier_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [product_id, batch_number, lot_number || null, warehouse_id || null, bin_id || null, quantity_received, quantity_received, best_before_date || null, manufacture_date || null, supplier_id || null, notes || null]
    );

    // Create expiry alert if best_before_date is set
    if (best_before_date) {
      const daysUntilExpiry = Math.floor((new Date(best_before_date) - new Date()) / (1000 * 60 * 60 * 24));
      let alertType = 'warning';
      if (daysUntilExpiry < 0) alertType = 'expired';
      else if (daysUntilExpiry < 7) alertType = 'critical';

      await pool.query(
        `INSERT INTO expiry_alerts (batch_id, product_id, warehouse_id, days_until_expiry, alert_type)
         VALUES ($1, $2, $3, $4, $5)`,
        [result.rows[0].id, product_id, warehouse_id || null, Math.max(0, daysUntilExpiry), alertType]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all batches with filters
router.get("/batches", authenticate, async (req, res) => {
  try {
    const { product_id, warehouse_id, status, include_expired } = req.query;
    let query = `
      SELECT b.*, p.name as product_name, w.name as warehouse_name, s.name as supplier_name
      FROM inventory_batches b
      LEFT JOIN products p ON b.product_id = p.id
      LEFT JOIN warehouses w ON b.warehouse_id = w.id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (product_id) {
      query += ` AND b.product_id = $${params.length + 1}`;
      params.push(product_id);
    }
    if (warehouse_id) {
      query += ` AND b.warehouse_id = $${params.length + 1}`;
      params.push(warehouse_id);
    }
    if (status) {
      query += ` AND b.status = $${params.length + 1}`;
      params.push(status);
    }
    if (include_expired !== 'true') {
      query += ` AND (b.best_before_date IS NULL OR b.best_before_date >= CURRENT_DATE)`;
    }

    query += ` ORDER BY b.best_before_date ASC, b.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get batch details
router.get("/batches/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const batch = await pool.query(`
      SELECT b.*, p.name as product_name, w.name as warehouse_name, s.name as supplier_name
      FROM inventory_batches b
      LEFT JOIN products p ON b.product_id = p.id
      LEFT JOIN warehouses w ON b.warehouse_id = w.id
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE b.id = $1
    `, [id]);

    if (batch.rows.length === 0) {
      return res.status(404).json({ error: "Batch not found" });
    }

    // Get allocations for this batch
    const allocations = await pool.query(`
      SELECT * FROM batch_allocations WHERE batch_id = $1 ORDER BY allocated_date DESC
    `, [id]);

    res.json({ ...batch.rows[0], allocations: allocations.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update batch quantity (consume/allocate)
router.post("/batches/:id/allocate", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity_allocated, allocation_type, reference_type, reference_id, notes } = req.body;

    if (!quantity_allocated || quantity_allocated <= 0) {
      return res.status(400).json({ error: "Valid quantity_allocated is required" });
    }

    // Get current batch
    const batch = await pool.query("SELECT * FROM inventory_batches WHERE id = $1", [id]);
    if (batch.rows.length === 0) {
      return res.status(404).json({ error: "Batch not found" });
    }

    const currentBatch = batch.rows[0];
    if (currentBatch.quantity_available < quantity_allocated) {
      return res.status(400).json({ error: `Not enough quantity available (${currentBatch.quantity_available})` });
    }

    // Record allocation
    const allocation = await pool.query(
      `INSERT INTO batch_allocations (batch_id, quantity_allocated, allocation_type, reference_type, reference_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, quantity_allocated, allocation_type || 'sale', reference_type || null, reference_id || null, notes || null]
    );

    // Update batch quantity
    await pool.query(
      "UPDATE inventory_batches SET quantity_available = quantity_available - $1 WHERE id = $2",
      [quantity_allocated, id]
    );

    res.json(allocation.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BARCODE SCANNING APIs
// ─────────────────────────────────────────────────────────────────────────────

// Process barcode scan
router.post("/scans/process", authenticate, async (req, res) => {
  try {
    const { barcode, warehouse_id, bin_id, scan_type, quantity_scanned, session_id, notes } = req.body;

    if (!barcode || !scan_type) {
      return res.status(400).json({ error: "barcode and scan_type are required" });
    }

    // Find product by barcode
    const product = await pool.query("SELECT * FROM products WHERE barcode = $1", [barcode]);
    
    let productId = null;
    let batchId = null;
    let isValid = true;
    let errorMessage = null;

    if (product.rows.length === 0) {
      isValid = false;
      errorMessage = "Barcode not found in system";
    } else {
      productId = product.rows[0].id;

      // For batch-tracked products, try to find active batch
      if (product.rows[0].enable_batch_tracking) {
        const batch = await pool.query(
          "SELECT id FROM inventory_batches WHERE product_id = $1 AND status = 'active' AND quantity_available > 0 ORDER BY best_before_date ASC LIMIT 1",
          [productId]
        );
        if (batch.rows.length > 0) {
          batchId = batch.rows[0].id;
        } else {
          isValid = false;
          errorMessage = "No active batch available for this product";
        }
      }
    }

    // Record the scan
    const scanResult = await pool.query(
      `INSERT INTO barcode_scans (barcode, product_id, batch_id, warehouse_id, bin_id, scan_type, quantity_scanned, scanned_by_id, session_id, is_valid, error_message, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [barcode, productId, batchId, warehouse_id || null, bin_id || null, scan_type, quantity_scanned || 1, req.user.id, session_id || null, isValid, errorMessage, notes || null]
    );

    res.json({ ...scanResult.rows[0], valid: isValid, message: errorMessage || "Scan recorded" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get scan history
router.get("/scans/history", authenticate, async (req, res) => {
  try {
    const { product_id, session_id, scan_type, limit = 100 } = req.query;
    let query = "SELECT * FROM barcode_scans WHERE 1=1";
    const params = [];

    if (product_id) {
      query += ` AND product_id = $${params.length + 1}`;
      params.push(product_id);
    }
    if (session_id) {
      query += ` AND session_id = $${params.length + 1}`;
      params.push(session_id);
    }
    if (scan_type) {
      query += ` AND scan_type = $${params.length + 1}`;
      params.push(scan_type);
    }

    query += ` ORDER BY scan_timestamp DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CYCLE COUNT APIs
// ─────────────────────────────────────────────────────────────────────────────

// Create cycle count
router.post("/cycle-counts", authenticate, async (req, res) => {
  try {
    const { warehouse_id, cycle_type, zone_name, planned_date, notes } = req.body;

    if (!warehouse_id) {
      return res.status(400).json({ error: "warehouse_id is required" });
    }

    // Generate cycle code
    const cycleCode = `CC-${Date.now()}`;

    const result = await pool.query(
      `INSERT INTO cycle_counts (warehouse_id, cycle_code, cycle_type, zone_name, planned_date, created_by_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [warehouse_id, cycleCode, cycle_type || 'partial', zone_name || null, planned_date || null, req.user.id, notes || null]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get cycle counts
router.get("/cycle-counts", authenticate, async (req, res) => {
  try {
    const { warehouse_id, status } = req.query;
    let query = `
      SELECT cc.*, w.name as warehouse_name, u.username as created_by_username
      FROM cycle_counts cc
      LEFT JOIN warehouses w ON cc.warehouse_id = w.id
      LEFT JOIN users u ON cc.created_by_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (warehouse_id) {
      query += ` AND cc.warehouse_id = $${params.length + 1}`;
      params.push(warehouse_id);
    }
    if (status) {
      query += ` AND cc.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY cc.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start cycle count
router.post("/cycle-counts/:id/start", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE cycle_counts SET status = 'in_progress', start_date = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Cycle count not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Record cycle count item scan
router.post("/cycle-counts/:id/scan", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { product_id, batch_id, bin_id, counted_quantity, barcode_scanned, notes } = req.body;

    if (!product_id || counted_quantity === undefined) {
      return res.status(400).json({ error: "product_id and counted_quantity are required" });
    }

    // Get expected quantity
    const current = await pool.query(
      `SELECT COALESCE(SUM(ib.quantity_available), 0) as expected_qty
       FROM inventory_batches ib
       WHERE ib.product_id = $1 AND ib.warehouse_id = (SELECT warehouse_id FROM cycle_counts WHERE id = $2)
       ${batch_id ? `AND ib.id = ${batch_id}` : ''}`,
      [product_id, id]
    );

    const expectedQuantity = current.rows[0].expected_qty;
    const variance = counted_quantity - expectedQuantity;

    const result = await pool.query(
      `INSERT INTO cycle_count_items (cycle_count_id, product_id, batch_id, bin_id, expected_quantity, counted_quantity, variance, barcode_scanned, scanned_by_id, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [id, product_id, batch_id || null, bin_id || null, expectedQuantity, counted_quantity, variance, barcode_scanned || null, req.user.id, notes || null, variance === 0 ? 'counted' : 'variance_noted']
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complete cycle count
router.post("/cycle-counts/:id/complete", authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Get all items for this cycle count
    const items = await pool.query("SELECT * FROM cycle_count_items WHERE cycle_count_id = $1", [id]);

    let hasVariances = false;
    for (const item of items.rows) {
      if (item.variance !== 0) {
        hasVariances = true;
        break;
      }
    }

    const result = await pool.query(
      `UPDATE cycle_counts SET status = 'completed', completion_date = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    res.json({ ...result.rows[0], has_variances: hasVariances, total_items: items.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPIRY ALERTS & BEST-BEFORE TRACKING
// ─────────────────────────────────────────────────────────────────────────────

// Get expiry alerts
router.get("/alerts/expiry", authenticate, async (req, res) => {
  try {
    const { warehouse_id, alert_type, acknowledged } = req.query;
    let query = `
      SELECT ea.*, b.batch_number, p.name as product_name, w.name as warehouse_name
      FROM expiry_alerts ea
      JOIN inventory_batches b ON ea.batch_id = b.id
      JOIN products p ON ea.product_id = p.id
      LEFT JOIN warehouses w ON ea.warehouse_id = w.id
      WHERE ea.alert_date >= CURRENT_DATE - INTERVAL '30 days'
    `;
    const params = [];

    if (warehouse_id) {
      query += ` AND ea.warehouse_id = $${params.length + 1}`;
      params.push(warehouse_id);
    }
    if (alert_type) {
      query += ` AND ea.alert_type = $${params.length + 1}`;
      params.push(alert_type);
    }
    if (acknowledged !== undefined) {
      query += ` AND ea.acknowledged = $${params.length + 1}`;
      params.push(acknowledged === 'true');
    }

    query += ` ORDER BY ea.alert_type DESC, b.best_before_date ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Acknowledge expiry alert
router.post("/alerts/expiry/:id/acknowledge", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { action_taken, notes } = req.body;

    const result = await pool.query(
      `UPDATE expiry_alerts SET acknowledged = true, acknowledged_by_id = $1, acknowledged_date = NOW(), action_taken = $2, notes = $3 WHERE id = $4 RETURNING *`,
      [req.user.id, action_taken || null, notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Alert not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
