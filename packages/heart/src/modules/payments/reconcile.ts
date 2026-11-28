import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, withTransaction } from '../../platform/db/index.ts';
import { paymentAdapters } from '../../integrations/payments/index.ts';
import { confirmPaidOrder, expirePendingPayment, markPaymentFailed } from '../orders/payment-confirmation.ts';

const CLAIM_PREFIX = 'reconcile-claim|';

function claimNote(): string {
  return `${CLAIM_PREFIX}${new Date(Date.now() + 60_000).toISOString()}`;
}

/** Poll the provider for pending intents. This is the real safety net, not just a retry timer. */
export async function reconcilePendingPayments(limit = 20): Promise<{ processed: number; failed: number; expired: number }> {
  const db = getDb();
  const intents = await withTransaction(async (tx) => {
    const { rows: claimed } = await tx.execute<{
      id: string; provider: string; provider_order_id: string | null; provider_payment_id: string | null;
      order_id: string | null; amount_paise: string; currency: string; created_at: string;
    }>(sql`
      SELECT id, provider, provider_order_id, provider_payment_id, order_id, amount_paise, currency, created_at
      FROM payment_intents WHERE status='created' AND order_id IS NOT NULL AND created_at < now() - interval '1 minute'
        AND (note IS NULL OR note NOT LIKE ${`${CLAIM_PREFIX}%`} OR split_part(note, '|', 2)::timestamptz <= now())
      ORDER BY created_at LIMIT ${limit} FOR UPDATE SKIP LOCKED`);
    for (const intent of claimed) {
      await tx.execute(sql`UPDATE payment_intents SET note=${claimNote()}, updated_at=now() WHERE id=${intent.id}::uuid AND status='created'`);
    }
    return claimed;
  });

  let processed = 0;
  let failed = 0;
  let expired = 0;
  for (const intent of intents) {
    const adapter = paymentAdapters.find((a) => a.slug === intent.provider);
    if (!adapter?.getPayment) continue;
    try {
      if (!intent.provider_order_id) {
        if (Date.now() - new Date(intent.created_at).getTime() > 30 * 60_000 && intent.order_id) {
          await expirePendingPayment(intent.order_id);
          expired += 1;
        }
        continue;
      }
      if (!intent.provider_payment_id && adapter.getOrderPayments) {
        const payments = await adapter.getOrderPayments(intent.provider_order_id);
        const paid = payments.find((p) => p.status === 'captured' || p.status === 'authorized');
        if (paid) {
          await db.execute(sql`UPDATE payment_intents SET provider_payment_id=${paid.id}, updated_at=now() WHERE id=${intent.id}::uuid`);
          intent.provider_payment_id = paid.id;
        }
      }
      if (!intent.provider_payment_id) {
        if (Date.now() - new Date(intent.created_at).getTime() > 30 * 60_000 && intent.order_id) {
          await expirePendingPayment(intent.order_id);
          expired += 1;
        }
        continue;
      }
      const status = await adapter.getPayment(intent.provider_payment_id);
      if (status?.status === 'captured') {
        await confirmPaidOrder({
          providerOrderId: intent.provider_order_id,
          providerPaymentId: intent.provider_payment_id,
          amountPaise: Number(intent.amount_paise),
          currency: intent.currency,
        });
        processed += 1;
      } else if (status?.status === 'failed') {
        await markPaymentFailed(intent.provider_order_id, 'failed');
        failed += 1;
      }
    } catch {
      failed += 1;
    }
    await db.execute(sql`UPDATE payment_intents SET note=NULL WHERE id=${intent.id}::uuid AND note LIKE ${`${CLAIM_PREFIX}%`}`);
  }
  return { processed, failed, expired };
}
