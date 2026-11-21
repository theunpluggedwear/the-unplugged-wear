import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '../../platform/db/index.ts';

/** Attach a provider order to an already-created pending order. No DB transaction around provider calls. */
export async function attachProviderOrder(input: { intentId: string; provider: string; providerOrderId: string }): Promise<void> {
  await getDb().execute(sql`
    UPDATE payment_intents SET provider_order_id=${input.providerOrderId}, provider=${input.provider}, updated_at=now()
    WHERE id=${input.intentId}::uuid AND provider_order_id IS NULL`);
}

export async function getIntentByCheckoutKey(checkoutKey: string): Promise<{
  id: string; orderId: string | null; providerOrderId: string | null; amountPaise: number; status: string;
} | null> {
  const { rows } = await getDb().execute<{ id: string; order_id: string | null; provider_order_id: string | null; amount_paise: string; status: string }>(sql`
    SELECT id, order_id, provider_order_id, amount_paise, status FROM payment_intents WHERE checkout_key=${checkoutKey}::uuid`);
  const r = rows[0];
  return r ? { id: r.id, orderId: r.order_id, providerOrderId: r.provider_order_id, amountPaise: Number(r.amount_paise), status: r.status } : null;
}
