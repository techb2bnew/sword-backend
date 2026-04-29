const express = require("express");
const router = express.Router();
const pool = require("../db");

// Warehouses
router.get("/", async (req, res) => {
  try {
    const warehouses = await pool.query("SELECT * FROM warehouses ORDER BY id DESC");
    res.json(warehouses.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, location, capacity_sqft, manager_name } = req.body;
    const newWarehouse = await pool.query(
      "INSERT INTO warehouses (name, location, capacity_sqft, manager_name) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, location, capacity_sqft, manager_name]
    );
    res.json(newWarehouse.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bins
router.get("/bins", async (req, res) => {
  try {
    const { warehouse_id } = req.query;
    let query = `
      SELECT b.*, p.name as product_name, p.stock as product_stock, p.uom, p.barcode
      FROM bins b
      LEFT JOIN products p ON b.id = p.bin_id
    `;
    let params = [];
    if (warehouse_id) {
      query += " WHERE b.warehouse_id = $1";
      params.push(warehouse_id);
    }
    query += " ORDER BY b.rack_code, b.bin_code";
    const bins = await pool.query(query, params);
    res.json(bins.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/bins", async (req, res) => {
  try {
    const { warehouse_id, rack_code, bin_code } = req.body;
    const newBin = await pool.query(
      "INSERT INTO bins (warehouse_id, rack_code, bin_code) VALUES ($1, $2, $3) RETURNING *",
      [warehouse_id, rack_code, bin_code]
    );
    res.json(newBin.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/bins/bulk", async (req, res) => {
  const client = await pool.connect();
  try {
    const { warehouse_id, rack_code, bin_count } = req.body;
    await client.query("BEGIN");
    for (let i = 1; i <= bin_count; i++) {
      const binCode = `B-${i.toString().padStart(2, '0')}`;
      await client.query(
        "INSERT INTO bins (warehouse_id, rack_code, bin_code) VALUES ($1, $2, $3)",
        [warehouse_id, rack_code, binCode]
      );
    }
    await client.query("COMMIT");
    res.json({ message: `Rack ${rack_code} with ${bin_count} bins created.` });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.delete("/bins/rack/:warehouse_id/:rack_code", async (req, res) => {
  const client = await pool.connect();
  try {
    const { warehouse_id, rack_code } = req.params;
    await client.query("BEGIN");
    
    // Check if any bin in this rack is occupied
    const occupied = await client.query(
      "SELECT id FROM bins WHERE warehouse_id = $1 AND rack_code = $2 AND status = 'Occupied'",
      [warehouse_id, rack_code]
    );

    if (occupied.rows.length > 0) {
      throw new Error("Cannot delete rack: Some bins are currently occupied.");
    }

    await client.query(
      "DELETE FROM bins WHERE warehouse_id = $1 AND rack_code = $2",
      [warehouse_id, rack_code]
    );
    
    await client.query("COMMIT");
    res.json({ message: `Rack ${rack_code} deleted successfully.` });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.put("/bins/rack/:warehouse_id/:old_code", async (req, res) => {
  const client = await pool.connect();
  try {
    const { warehouse_id, old_code } = req.params;
    const { new_code, bin_count } = req.body;
    await client.query("BEGIN");

    // 1. Rename if needed
    if (new_code && new_code !== old_code) {
      await client.query(
        "UPDATE bins SET rack_code = $1 WHERE warehouse_id = $2 AND rack_code = $3",
        [new_code, warehouse_id, old_code]
      );
    }

    const currentCode = new_code || old_code;

    // 2. Adjust Bin Count if provided
    if (bin_count) {
      const currentBins = await client.query(
        "SELECT * FROM bins WHERE warehouse_id = $1 AND rack_code = $2 ORDER BY bin_code ASC",
        [warehouse_id, currentCode]
      );
      const currentCount = currentBins.rows.length;

      if (bin_count > currentCount) {
        // Add more bins
        for (let i = currentCount + 1; i <= bin_count; i++) {
          const binCode = `B-${i.toString().padStart(2, '0')}`;
          await client.query(
            "INSERT INTO bins (warehouse_id, rack_code, bin_code) VALUES ($1, $2, $3)",
            [warehouse_id, currentCode, binCode]
          );
        }
      } else if (bin_count < currentCount) {
        // Remove trailing bins (only if empty)
        const binsToDelete = currentBins.rows.slice(bin_count);
        for (const bin of binsToDelete) {
          if (bin.status === 'Occupied') {
            throw new Error(`Cannot reduce bin count: Bin ${bin.bin_code} is occupied.`);
          }
        }
        const idsToDelete = binsToDelete.map(b => b.id);
        await client.query("DELETE FROM bins WHERE id = ANY($1)", [idsToDelete]);
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Rack updated successfully." });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Stock Movements (Updated for Bins)
router.get("/movements", async (req, res) => {
  try {
    const movements = await pool.query(`
      SELECT m.*, p.name as product_name, p.barcode,
             w1.name as from_warehouse, w2.name as to_warehouse,
             b1.rack_code as from_rack, b1.bin_code as from_bin,
             b2.rack_code as to_rack, b2.bin_code as to_bin
      FROM stock_movements m
      JOIN products p ON m.product_id = p.id
      LEFT JOIN warehouses w1 ON m.from_warehouse_id = w1.id
      LEFT JOIN warehouses w2 ON m.to_warehouse_id = w2.id
      LEFT JOIN bins b1 ON m.from_bin_id = b1.id
      LEFT JOIN bins b2 ON m.to_bin_id = b2.id
      ORDER BY m.movement_date DESC
    `);
    res.json(movements.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/movements", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { product_id, from_warehouse_id, to_warehouse_id, from_bin_id, to_bin_id, quantity, reason } = req.body;
    
    // Create movement record
    const movement = await client.query(
      "INSERT INTO stock_movements (product_id, from_warehouse_id, to_warehouse_id, from_bin_id, to_bin_id, quantity, reason) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [product_id, from_warehouse_id, to_warehouse_id, from_bin_id, to_bin_id, quantity, reason]
    );

    // Update product's current location
    await client.query(
      "UPDATE products SET warehouse_id = $1, bin_id = $2 WHERE id = $3",
      [to_warehouse_id, to_bin_id, product_id]
    );

    // Update bin status
    if (to_bin_id) {
      await client.query("UPDATE bins SET status = 'Occupied' WHERE id = $1", [to_bin_id]);
    }
    if (from_bin_id) {
      // Check if any other products are in this bin (simple logic for now)
      const otherProds = await client.query("SELECT id FROM products WHERE bin_id = $1 AND id != $2", [from_bin_id, product_id]);
      if (otherProds.rows.length === 0) {
        await client.query("UPDATE bins SET status = 'Empty' WHERE id = $1", [from_bin_id]);
      }
    }

    await client.query("COMMIT");
    res.json(movement.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
