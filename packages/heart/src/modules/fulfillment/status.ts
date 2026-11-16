import 'server-only';
import { sql } from 'drizzle-orm';
import type { Transaction } from '../../platform/db/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import type { FulfillmentStatus } from '../../integrations/fulfillment/index.ts';

// The order axis only ever moves forward, and it never hides a failure: a
// cancelled/failed provider order drags the order with it, but "delivered" is
// final (DOC/backend/06 §status axes).

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'failed' | 'refunded';

const RANK: Record<OrderStatus, number> = {
  pending: 0, confirmed: 1, processing: 2, shipped: 3, delivered: 4,
  cancelled: 5, failed: 5, refunded: 6,
};

/** Which order status a provider state implies (null = leave the order alone). */
export function orderStatusFor(status: FulfillmentStatus): OrderStatus | null {
  switch (status) {
    case 'pending': return null;
    case 'submitted':
    case 'on_hold': return 'confirmed';
    case 'in_production': return 'processing';
    case 'shipped':
    case 'delivery_exception':
    case 'rto_initiated': return 'shipped';
    case 'delivered': return 'delivered';
    case 'returned': return 'failed';
    case 'cancelled': return 'cancelled';
    case 'failed': return 'failed';
  }
}

/**
 * Move orders.status forward inside the caller's transaction and write the
 * history row. Returns true when the status actually changed.
 */
export async function advanceOrderStatus(tx: Transaction, orderId: string, to: OrderStatus, note: string, actor = 'system'): Promise<boolean> {
  const { rows: [order] } = await tx.execute<{ status: OrderStatus }>(sql`SELECT status FROM orders WHERE id = ${orderId} FOR UPDATE`);
  if (!order || order.status === to) return false;
  const from = order.status;
  const forward = RANK[to] > RANK[from];
  // Cancel/fail may close a live order, but never after the parcel landed.
  const closes = (to === 'cancelled' || to === 'failed') && RANK[from] <= RANK.shipped;
  if (!forward && !closes) return false;
  await tx.execute(sql`UPDATE orders SET status = ${to}, updated_at = now() WHERE id = ${orderId}`);
  await tx.execute(sql`INSERT INTO order_status_history (id, order_id, from_status, to_status, note, actor)
    VALUES (${uuidv7()}, ${orderId}, ${from}, ${to}, ${note.slice(0, 500)}, ${actor})`);
  return true;
}
