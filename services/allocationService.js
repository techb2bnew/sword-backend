const pool = require('../db');

/**
 * Automatically allocates warehouse bin(s) for an accepted quotation.
 * Enhanced Logic:
 * 1. Consolidates stock: Prioritizes bins already holding the same product.
 * 2. Intelligent Filling: Fills bins to capacity before moving to the next.
 * 3. Multi-Bin Splitting: Splits large quotations across multiple bins if necessary.
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
    let remainingQty = parseFloat(quotation.quantity);
    const productId = quotation.product_id;
    const category = quotation.category || '';

    const allocations = [];

    // 2. Loop until all quantity is allocated
    while (remainingQty > 0) {
      // Find best bin:
      // Priority 1: Bins already holding this product (consolidation)
      // Priority 2: Bins with highest utilization (to fill them up)
      // Must match category and have at least 1 unit of space
      const binRes = await client.query(
        `SELECT b.*, w.name as warehouse_name,
                (SELECT COUNT(*) FROM warehouse_allocations wa WHERE wa.bin_id = b.id AND wa.product_id = $1) as existing_prod_count
         FROM bins b
         JOIN warehouses w ON b.warehouse_id = w.id
         WHERE w.status = 'Active' 
           AND b.capacity > b.used_capacity
           AND (
             ($2 != '' AND b.category = $2) OR 
             ($2 = '' AND b.category IS NULL)
           )
         ORDER BY existing_prod_count DESC, (CAST(b.used_capacity AS FLOAT) / b.capacity) DESC, b.id ASC
         LIMIT 1`,
        [productId, category]
      );

      if (binRes.rows.length === 0) {
        throw new Error(`Insufficient warehouse space. ${remainingQty} units remaining unallocated.`);
      }

      const bin = binRes.rows[0];
      const availableSpace = bin.capacity - bin.used_capacity;
      const qtyToAllocate = Math.min(remainingQty, availableSpace);

      // Create Allocation Record
      const cleanRack = bin.rack_code.replace('-', '');
      const cleanBin = bin.bin_code.replace('-', '');
      // Barcode must be unique, adding Quotation ID ensures this even for same bin
      const barcodeId = `WH${bin.warehouse_id}-${cleanRack}-${cleanBin}-Q${quotationId}`;

      await client.query(
        `INSERT INTO warehouse_allocations 
         (quotation_id, product_id, warehouse_id, bin_id, barcode_id, allocated_at, status, quantity)
         VALUES ($1, $2, $3, $4, $5, NOW(), 'allocated', $6)`,
        [quotationId, productId, bin.warehouse_id, bin.id, barcodeId, qtyToAllocate]
      );

      // Update Bin Capacity
      const newUsedCapacity = bin.used_capacity + qtyToAllocate;
      const newStatus = newUsedCapacity >= bin.capacity ? 'Occupied' : 'Reserved';
      
      await client.query(
        `UPDATE bins SET used_capacity = $1, status = $2 WHERE id = $3`,
        [newUsedCapacity, newStatus, bin.id]
      );

      allocations.push({
        barcode_id: barcodeId,
        warehouse: bin.warehouse_name,
        warehouse_id: bin.warehouse_id,
        bin: `${bin.rack_code} · ${bin.bin_code}`,
        bin_id: bin.id,
        qty: qtyToAllocate
      });

      remainingQty -= qtyToAllocate;
    }

    // 3. Update Quotation Status
    const acceptedAt = new Date();
    const deliveryDueAt = new Date();
    deliveryDueAt.setDate(acceptedAt.getDate() + (quotation.credit_days || 0));

    await client.query(
      `UPDATE quotations 
       SET accepted_at = $1, delivery_due_at = $2, status = 'Accepted'
       WHERE id = $3`,
      [acceptedAt, deliveryDueAt, quotationId]
    );

    // 4. Update Product Stock (Aggregate quantity)
    await client.query(
      `UPDATE products 
       SET warehouse_id = $1, bin_id = $2, stock = stock + $3
       WHERE id = $4`,
      [allocations[0].warehouse_id, allocations[0].bin_id, quotation.quantity, productId]
    );

    await client.query('COMMIT');
    
    return {
      success: true,
      allocations
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  autoAllocateWarehouse
};
