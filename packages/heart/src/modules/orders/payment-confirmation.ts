import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, withTransaction, type Transaction } from '../../platform/db/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import { toRupees } from '../../platform/money/index.ts';
import * as giftCards from '../gift-cards/index.ts';
import { release } from '../inventory/index.ts';
import { canTransitionOrder } from '../../platform/status/index.ts';
import type { OrderStatus } from '../../platform/status/index.ts';

export interface ConfirmPaidInput {
  providerOrderId: string;
  providerPaymentId: string;
  amountPaise: number;
  currency?: string;
}

export async function confirmPaidOrder(input: ConfirmPaidInput): Promise<{ orderId: string; orderNumber: string }> {
  return withTransaction(async (tx) => {
    const { rows: intents } = await tx.execute<{
      id: string; order_id: string | null; amount_paise: string; currency: string; status: string; confirmed_at: string | null;
    }>(sql`SELECT id, order_id, amount_paise, currency, status, confirmed_at FROM payment_intents WHERE provider_order_id=${input.providerOrderId} FOR UPDATE`);
    const intent = intents[0];
    if (!intent || !intent.order_id) throw new AppError('NOT_FOUND', 'No order is attached to that payment.');
    if (Number(intent.amount_paise) !== input.amountPaise) {
      throw new Error(`Webhook amount ${input.amountPaise} does not match intent ${intent.amount_paise}`);
    }
    if (input.currency && input.currency.toUpperCase() !== intent.currency.toUpperCase()) {
      throw new Error(`Webhook currency ${input.currency} does not match intent ${intent.currency}`);
    }
    if (intent.status === 'paid' && intent.confirmed_at) {
      const { rows: ordersDone } = await tx.execute<{ order_number: string }>(sql`SELECT order_number FROM orders WHERE id=${intent.order_id}::uuid`);
      return { orderId: intent.order_id, orderNumber: ordersDone[0]!.order_number };
    }

    const { rows: orders } = await tx.execute<{ order_number: string; payment_status: string; guest_email: string | null; placed_by_user_id: string | null }>(sql`
      SELECT order_number, payment_status, guest_email, placed_by_user_id FROM orders WHERE id=${intent.order_id}::uuid FOR UPDATE`);
    const order = orders[0];
    if (!order) throw new AppError('NOT_FOUND', 'Order not found.');

    const { rows: payments } = await tx.execute<{ id: string; status: string; transaction_id: string | null }>(sql`
      SELECT id, status, transaction_id FROM payments WHERE order_id=${intent.order_id}::uuid ORDER BY created_at DESC LIMIT 1 FOR UPDATE`);
    const payment = payments[0];
    if (!payment) throw new AppError('NOT_FOUND', 'Pending payment not found.');

    if (payment.status !== 'captured') {
      await tx.execute(sql`UPDATE payments SET status='captured', transaction_id=${input.providerPaymentId}, paid_at=now(), updated_at=now() WHERE id=${payment.id}::uuid`);
    }
    if (order.payment_status !== 'paid') {
      await tx.execute(sql`UPDATE orders SET payment_status='paid', updated_at=now() WHERE id=${intent.order_id}::uuid`);
    }

    await tx.execute(sql`UPDATE payment_intents SET status='paid', provider_payment_id=${input.providerPaymentId},
      signature_verified_at=now(), paid_at=now(), confirmed_at=now(), updated_at=now() WHERE id=${intent.id}::uuid`);

    await issueGiftCards(tx, intent.order_id, order.placed_by_user_id, order.guest_email);
    return { orderId: intent.order_id, orderNumber: order.order_number };
  });
}

async function issueGiftCards(tx: Transaction, orderId: string, userId: string | null, guestEmail: string | null): Promise<void> {
  const { rows: giftLines } = await tx.execute<{ id: string; qty: number; unit_price: string; personalization: { recipientName?: string; recipientEmail?: string; message?: string } | null }>(sql`
    SELECT oi.id, oi.qty, oi.unit_price, oi.personalization FROM order_items oi JOIN products p ON p.id=oi.product_id
    WHERE oi.order_id=${orderId}::uuid AND p.product_kind='gift_card'`);
  if (!giftLines.length) return;
  let buyerEmail = guestEmail;
  if (!buyerEmail && userId) {
    const { rows: u } = await tx.execute<{ email: string }>(sql`SELECT email FROM users WHERE id=${userId}::uuid`);
    buyerEmail = u[0]?.email ?? null;
  }
  for (const line of giftLines) {
    for (let unit = 1; unit <= line.qty; unit++) {
      const recipientEmail = line.personalization?.recipientEmail ?? buyerEmail;
      const issued = await giftCards.issue(tx, {
        amountPaise: Math.round(Number(line.unit_price) * 100),
        purchasedOrderItemId: line.id,
        purchasedUnitNo: unit,
        issuedBy: userId ?? null,
        recipientName: line.personalization?.recipientName ?? null,
        recipientEmail,
        message: line.personalization?.message ?? null,
      });
      if (recipientEmail) {
        const sender = await import('../../integrations/email/index.ts').then((m) => m.getEmailSender());
        const expiry = new Date(issued.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
        await sender.send({
          to: recipientEmail,
          subject: 'Your The Unplugged Wear gift card',
          template: 'gift_card.issued',
          link: `code:${issued.code};expires:${expiry}`,
          dedupeKey: `gift_card.issued:${issued.id}`,
        });
      }
    }
  }
}

export async function markPaymentFailed(providerOrderId: string, reason: string): Promise<void> {
  await getDb().execute(sql`UPDATE payment_intents SET status='failed', note=${reason.slice(0, 500)}, updated_at=now()
    WHERE provider_order_id=${providerOrderId} AND status NOT IN ('paid','cancelled')`);
}

/** Cancel an unpaid pending order and give back everything it reserved. Idempotent. */
export async function expirePendingPayment(orderId: string): Promise<void> {
  await withTransaction(async (tx) => {
    const { rows: intents } = await tx.execute<{ id: string; status: string; payload: Record<string, unknown> | null }>(sql`
      SELECT id, status, payload FROM payment_intents WHERE order_id=${orderId}::uuid FOR UPDATE`);
    const intent = intents[0];
    if (!intent || intent.status === 'paid' || intent.status === 'expired') return;
    const { rows: orders } = await tx.execute<{ status: OrderStatus; payment_status: string; discount_code_id: string | null }>(sql`
      SELECT status, payment_status, discount_code_id FROM orders WHERE id=${orderId}::uuid FOR UPDATE`);
    const order = orders[0];
    if (!order || order.payment_status === 'paid' || !canTransitionOrder(order.status, 'cancelled')) return;

    // Stock and gift-card credits are released by their own idempotent helpers.
    await release(tx, { orderId });
    await giftCards.reverseForOrder(tx, orderId, 'system');
    if (order.discount_code_id) {
      await tx.execute(sql`UPDATE discount_codes SET uses_count = greatest(0, uses_count - 1), updated_at = now()
        WHERE id = ${order.discount_code_id}::uuid`);
    }

    // The converted bag still has its lines: give it back to the buyer when no
    // newer active bag would collide with the one-active-cart-per-user rule.
    const cartId = typeof intent.payload?.cartId === 'string' ? intent.payload.cartId : null;
    if (cartId) {
      const { rows: cart } = await tx.execute<{ user_id: string | null }>(sql`
        SELECT user_id FROM carts WHERE id = ${cartId}::uuid AND status = 'converted'`);
      const userId = cart[0]?.user_id ?? null;
      if (!userId) {
        await tx.execute(sql`UPDATE carts SET status='active', last_activity_at=now(), updated_at=now()
          WHERE id=${cartId}::uuid AND status='converted'`);
      } else {
        const { rows: active } = await tx.execute(sql`
          SELECT 1 FROM carts WHERE user_id=${userId}::uuid AND status='active' AND id <> ${cartId}::uuid LIMIT 1`);
        if (!active.length) {
          await tx.execute(sql`UPDATE carts SET status='active', last_activity_at=now(), updated_at=now()
            WHERE id=${cartId}::uuid AND status='converted'`);
        }
      }
    }

    await tx.execute(sql`UPDATE payment_intents SET status='expired', updated_at=now() WHERE id=${intent.id}::uuid`);
    await tx.execute(sql`UPDATE orders SET status='cancelled', updated_at=now() WHERE id=${orderId}::uuid`);
    await tx.execute(sql`UPDATE payments SET status='failed', updated_at=now() WHERE order_id=${orderId}::uuid AND status='pending'`);
    await tx.execute(sql`INSERT INTO order_status_history (id, order_id, from_status, to_status, note, actor)
      VALUES (${uuidv7()}, ${orderId}::uuid, ${order.status}, 'cancelled', 'Payment not completed', 'system')`);
  });
}
