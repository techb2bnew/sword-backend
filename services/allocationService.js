const pool = require('../db');

/**
 * Automatically allocates a warehouse bin for an accepted quotation.
 * Selection Rules:
 * 1. Find available bins in active warehouses.
 * 2. Ensure enough remaining capacity for the quotation quantity.
 * 3. Prioritize bins with the lowest utilization.
 * 4. Transaction-safe to prevent race conditions.
 */
async function autoAllocateWarehouse(quotationId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch quotation details
    const quoteRes = await client.query(
      `SELECT q.*, p.name as product_name, p.id as product_id, p.category 
       FROM quotations q 
       JOIN products p ON q.product_id = p.id 
       WHERE q.id = $1`,
      [quotationId]
    );

    if (quoteRes.rows.length === 0) {
      throw new Error('Quotation not found');
    }

    const quotation = quoteRes.rows[0];
    const requiredQty = quotation.quantity;

    // 2. Find best available bin
    // Rules: Strict Category Match for prototype automation demonstration
    const binRes = await client.query(
      `SELECT b.*, w.name as warehouse_name, 
              (CAST(b.used_capacity AS FLOAT) / b.capacity) as utilization
       FROM bins b
       JOIN warehouses w ON b.warehouse_id = w.id
       WHERE w.status = 'Active' 
         AND (b.capacity - b.used_capacity) >= $1
         AND (
           ($2 != '' AND b.category = $2) OR 
           ($2 = '' AND b.category IS NULL)
         )
       ORDER BY utilization ASC, b.id ASC
       LIMIT 1`,
      [requiredQty, quotation.category || '']
    );

    if (binRes.rows.length === 0) {
      throw new Error('No warehouse space available');
    }

    const bin = binRes.rows[0];

    // 3. Calculate Delivery Due Date
    const acceptedAt = new Date();
    const deliveryDueAt = new Date();
    deliveryDueAt.setDate(acceptedAt.getDate() + (quotation.credit_days || 0));

    // 4. Update Quotation with timestamps
    await client.query(
      `UPDATE quotations 
       SET accepted_at = $1, delivery_due_at = $2, status = 'Accepted'
       WHERE id = $3`,
      [acceptedAt, deliveryDueAt, quotationId]
    );

    // 5. Generate Barcode ID: WH{ID}-R{CODE}-B{CODE}
    // Cleaning rack/bin codes from potential dashes for cleaner barcode
    const cleanRack = bin.rack_code.replace('-', '');
    const cleanBin = bin.bin_code.replace('-', '');
    const barcodeId = `WH${bin.warehouse_id}-${cleanRack}-${cleanBin}`;

    // 6. Create Allocation Record
    await client.query(
      `INSERT INTO warehouse_allocations 
       (quotation_id, product_id, warehouse_id, bin_id, barcode_id, allocated_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'allocated')`,
      [quotationId, quotation.product_id, bin.warehouse_id, bin.id, barcodeId, acceptedAt]
    );

    // 7. Update Bin Capacity and Status
    const newUsedCapacity = bin.used_capacity + requiredQty;
    const newStatus = newUsedCapacity >= bin.capacity ? 'Occupied' : 'Reserved';
    
    await client.query(
      `UPDATE bins 
       SET used_capacity = $1, status = $2 
       WHERE id = $3`,
      [newUsedCapacity, newStatus, bin.id]
    );

    // 8. Update Product location and Weighted Average Price
    const prodStateRes = await client.query(
      `SELECT stock, price FROM products WHERE id = $1`,
      [quotation.product_id]
    );
    const currentProd = prodStateRes.rows[0];
    const currentStock = parseFloat(currentProd.stock) || 0;
    const currentPrice = parseFloat(currentProd.price) || 0;
    const newQty = parseFloat(quotation.quantity);
    const incomingPrice = parseFloat(quotation.unit_price);

    // Weighted Average Formula: ((OldPrice * OldQty) + (NewPrice * NewQty)) / (OldQty + NewQty)
    const totalQty = currentStock + newQty;
    const weightedAvgPrice = totalQty > 0 
      ? ((currentPrice * currentStock) + (incomingPrice * newQty)) / totalQty 
      : incomingPrice;

    await client.query(
      `UPDATE products 
       SET warehouse_id = $1, bin_id = $2, stock = stock + $3, price = $4
       WHERE id = $5`,
      [bin.warehouse_id, bin.id, newQty, weightedAvgPrice.toFixed(2), quotation.product_id]
    );

    await client.query('COMMIT');
    console.log(`[Allocation] Successfully allocated Quote #${quotationId} to Bin #${bin.id} (${barcodeId})`);
    
    return {
      success: true,
      allocation: {
        barcode_id: barcodeId,
        warehouse: bin.warehouse_name,
        bin: `${bin.rack_code} · ${bin.bin_code}`,
        due_at: deliveryDueAt
      }
    };

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[Allocation Error] Quote #${quotationId}: ${err.message}`);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  autoAllocateWarehouse
};
