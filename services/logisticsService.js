const pool = require('../db');

// Distance calculation helper (Haversine formula)
function getDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * High-Intelligence Logistics Automation (V2 Schema Optimized)
 */
async function processLogistics(orderId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch Order details
    const orderRes = await client.query(
      `SELECT co.*, c.customer_name, s.vehicle_id as current_vehicle_id
       FROM customer_orders co 
       JOIN customers c ON co.customer_id = c.id 
       LEFT JOIN shipments s ON co.shipment_id = s.id
       WHERE co.id = $1`, 
      [orderId]
    );
    if (orderRes.rows.length === 0) throw new Error("Order not found");
    const order = orderRes.rows[0];

    // 2. Automated Warehouse Selection
    const itemsRes = await client.query("SELECT * FROM customer_order_items WHERE order_id = $1", [orderId]);
    const items = itemsRes.rows;
    const warehousesRes = await client.query("SELECT * FROM warehouses WHERE status ILIKE 'active'");
    const warehouses = warehousesRes.rows;

    const eligibleWarehouses = [];
    for (const wh of warehouses) {
      let hasAllStock = true;
      for (const item of items) {
        const stockRes = await client.query(
          "SELECT SUM(stock) as total_stock FROM products WHERE name = $1 AND warehouse_id = $2",
          [item.product_name, wh.id]
        );
        if (parseInt(stockRes.rows[0].total_stock || 0) < item.quantity) {
          hasAllStock = false;
          break;
        }
      }
      if (hasAllStock) {
        eligibleWarehouses.push({ ...wh, distance: getDistance(order.delivery_latitude, order.delivery_longitude, wh.latitude, wh.longitude) });
      }
    }

    if (eligibleWarehouses.length === 0) throw new Error("Insufficient warehouse stock.");

    eligibleWarehouses.sort((a, b) => a.distance - b.distance);
    const bestWH = eligibleWarehouses[0];

    // 3. Batching
    const dateStr = order.required_delivery_date ? new Date(order.required_delivery_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const sameDateOrders = await client.query(
      `SELECT co.* FROM customer_orders co 
       WHERE (co.required_delivery_date::date = $1 OR co.id = $2)
         AND (co.status = 'approved' OR co.status = 'warehouse_selected' OR co.id = $2)
         AND (co.selected_warehouse_id = $3 OR co.selected_warehouse_id IS NULL)`,
      [dateStr, orderId, bestWH.id]
    );

    const batchedOrders = sameDateOrders.rows;
    const totalWeight = batchedOrders.reduce((sum, o) => sum + parseFloat(o.total_weight_kg || 0), 0);

    // 4. Vehicle Assignment
    // Intelligence: Include the vehicle already assigned to this order (if any) in the search
    const vehicleRes = await client.query(
      `SELECT * FROM vehicles 
       WHERE (status ILIKE 'available' OR id = $2)
       ORDER BY assigned_warehouse_id = $1 DESC, capacity_kg ASC`,
      [bestWH.id, order.current_vehicle_id || -1]
    );
    
    let vehicles = vehicleRes.rows;
    let assignedVehicle = null;
    for (const v of vehicles) {
      if (parseFloat(v.capacity_kg) >= totalWeight) {
        assignedVehicle = v;
        break;
      }
    }

    if (!assignedVehicle && vehicles.length > 0) {
      assignedVehicle = vehicles[vehicles.length - 1];
    }

    // 5. Route Sequence
    batchedOrders.forEach(o => {
      o.distFromWH = getDistance(bestWH.latitude, bestWH.longitude, o.delivery_latitude, o.delivery_longitude);
    });
    batchedOrders.sort((a, b) => a.distFromWH - b.distFromWH);

    // 6. Create/Update Shipment
    let shipmentId = order.shipment_id;
    if (assignedVehicle) {
      const firstOrder = batchedOrders[0];
      const lastOrder = batchedOrders[batchedOrders.length - 1];

      if (shipmentId) {
        // Update existing shipment
        await client.query(
          `UPDATE shipments SET 
            vehicle_id = $1, route_details = $2, 
            origin_lat = $3, origin_lng = $4, dest_lat = $5, dest_lng = $6,
            origin_name = $7, dest_name = $8, distance_km = $9
          WHERE id = $10`,
          [
            assignedVehicle.id, `Optimized Route: ${batchedOrders.map(o => o.order_number).join(' -> ')}`,
            bestWH.latitude, bestWH.longitude, lastOrder.delivery_latitude, lastOrder.delivery_longitude,
            bestWH.name, lastOrder.order_number, lastOrder.distFromWH, shipmentId
          ]
        );
      } else {
        // Create new shipment
        const shipmentRes = await client.query(
          `INSERT INTO shipments (
            vehicle_id, route_details, status, dispatch_date,
            origin_lat, origin_lng, dest_lat, dest_lng,
            origin_name, dest_name, distance_km
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
          [
            assignedVehicle.id, `Auto Route: ${batchedOrders.map(o => o.order_number).join(' -> ')}`, 
            'Pending', order.required_delivery_date,
            bestWH.latitude, bestWH.longitude, lastOrder.delivery_latitude, lastOrder.delivery_longitude,
            bestWH.name, lastOrder.order_number, lastOrder.distFromWH
          ]
        );
        shipmentId = shipmentRes.rows[0].id;
      }
      
      await client.query("UPDATE vehicles SET status = 'assigned' WHERE id = $1", [assignedVehicle.id]);
    }

    // 7. Update All Orders
    for (let i = 0; i < batchedOrders.length; i++) {
      const o = batchedOrders[i];
      await client.query(
        `UPDATE customer_orders SET 
          status = 'warehouse_selected',
          selected_warehouse_id = $1,
          selected_warehouse_name = $2,
          warehouse_distance_km = $3,
          shipment_id = $4,
          delivery_sequence = $5,
          warehouse_selected_at = CURRENT_TIMESTAMP
        WHERE id = $6`,
        [bestWH.id, bestWH.name, o.distFromWH, shipmentId, i + 1, o.id]
      );
    }

    await client.query('COMMIT');
    
    return {
      success: true,
      warehouse: bestWH.name,
      vehicle: assignedVehicle ? `${assignedVehicle.vehicle_type} (${assignedVehicle.vehicle_number})` : "Manual Assignment Required",
      driver: assignedVehicle ? assignedVehicle.driver_name : "N/A",
      batchSize: batchedOrders.length,
      route: batchedOrders.map(o => o.order_number).join(' -> ')
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { processLogistics };
