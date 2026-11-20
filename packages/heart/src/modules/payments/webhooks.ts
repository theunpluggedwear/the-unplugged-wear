import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, withTransaction } from '../../platform/db/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { getWebhookProvider, type NormalizedWebhookEvent } from '../../integrations/webhooks/index.ts';
import { confirmPaidOrder, markPaymentFailed as markPaymentFailedOrder } from '../orders/payment-confirmation.ts';

export interface IngestResult {
  status: 200 | 401 | 400 | 500;
  body: { received?: boolean; error?: string; ignored?: boolean };
}

/** Verify, dedupe and dispatch a provider webhook. Safe to call for any provider. */
export async function ingestWebhook(provider: string, rawBody: string, headers: Headers): Promise<IngestResult> {
  const adapter = getWebhookProvider(provider);
  if (!adapter) return { status: 400, body: { error: 'Unknown webhook provider' } };

  // 1. Verify signature before any DB write.
  if (!adapter.verify(rawBody, headers)) return { status: 401, body: { error: 'Invalid webhook signature' } };

  const event = adapter.normalize(rawBody, headers);
  if (!event) return { status: 400, body: { error: 'Unusable webhook payload' } };

  const apply = async (eventRowId: string): Promise<IngestResult> => {
    try {
      await processWebhookEvent(event);
      await getDb().execute(sql`
        UPDATE webhook_events SET status='processed', processed_at=now(), error=NULL WHERE id=${eventRowId}::uuid`);
      return { status: 200, body: { received: true } };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await getDb().execute(sql`
        UPDATE webhook_events SET status='failed', attempts=attempts+1, error=${message.slice(0, 2000)},
          next_attempt_at=now() + make_interval(mins => 5) WHERE id=${eventRowId}::uuid`);
      return { status: 500, body: { error: message } };
    }
  };

  // 2. Durable inbox. ON CONFLICT gives us provider-level dedupe.
  const inserted = await withTransaction(async (tx) => {
    const { rows } = await tx.execute<{ id: string; status: string; attempts: number }>(sql`
      INSERT INTO webhook_events (id, provider, provider_event_id, event_type, signature_verified, payload, raw_payload,
        status, business_ref, amount_paise, currency, received_at)
      VALUES (${uuidv7()}, ${event.provider}, ${event.providerEventId}, ${event.eventType}, true,
        ${JSON.stringify(event)}::jsonb, ${JSON.stringify(event.raw)}::jsonb, 'received', ${event.providerOrderId ?? event.providerRefundId ?? null},
        ${event.amountPaise ?? null}, ${event.currency ?? null}, now())
      ON CONFLICT (provider, provider_event_id) DO NOTHING
      RETURNING id, status, attempts`);
    return rows[0] ?? null;
  });

  if (inserted) return apply(inserted.id);

  // Duplicate delivery. A processed event is a pure ack. A failed one is worth
  // retrying here too, so a provider retry heals without waiting for the cron.
  const { rows: existing } = await getDb().execute<{ id: string; status: string; attempts: number }>(sql`
    SELECT id, status, attempts FROM webhook_events
    WHERE provider=${event.provider} AND provider_event_id=${event.providerEventId} FOR UPDATE`);
  const row = existing[0];
  if (!row || row.status !== 'failed' || row.attempts >= 8) return { status: 200, body: { received: true, ignored: true } };
  return apply(row.id);
}

/** Apply a normalized event to business state. Idempotent by provider ids. */
export async function processWebhookEvent(event: NormalizedWebhookEvent): Promise<void> {
  switch (event.kind) {
    case 'payment_captured':
      if (event.status !== 'captured' || !event.providerOrderId || !event.providerPaymentId || event.amountPaise === undefined) break;
      await confirmPaidOrder({
        providerOrderId: event.providerOrderId,
        providerPaymentId: event.providerPaymentId,
        amountPaise: event.amountPaise,
        currency: event.currency,
      });
      break;
    case 'payment_failed':
      if (event.providerOrderId) await markPaymentFailedOrder(event.providerOrderId, event.status ?? 'failed');
      break;
    case 'refund_created':
    case 'refund_processed':
    case 'refund_failed':
      await withTransaction(async (tx) => reconcileRefund(tx, event));
      break;
    default:
      break;
  }
}

async function reconcileRefund(tx: Parameters<Parameters<typeof withTransaction>[0]>[0], event: NormalizedWebhookEvent): Promise<void> {
  if (!event.providerRefundId) return;
  const { rows } = await tx.execute<{ id: string; status: string; order_id: string }>(sql`
    SELECT id, status, order_id FROM refunds WHERE payout_reference=${event.providerRefundId} FOR UPDATE`);
  const refund = rows[0];
  if (!refund) return; // auto-refund or unknown: audit row is enough
  if (event.kind === 'refund_processed' && refund.status === 'processing') {
    await tx.execute(sql`UPDATE refunds SET status='completed', updated_at=now() WHERE id=${refund.id}::uuid`);
    await settleIfFullyRefunded(tx, refund.order_id);
  } else if (event.kind === 'refund_failed') {
    await tx.execute(sql`UPDATE refunds SET status='rejected', updated_at=now() WHERE id=${refund.id}::uuid`);
  }
}

async function settleIfFullyRefunded(tx: Parameters<Parameters<typeof withTransaction>[0]>[0], orderId: string): Promise<void> {
  const { rows: [totals] } = await tx.execute<{ captured: string | null; refunded: string | null }>(sql`
    SELECT (SELECT sum(amount) FROM payments WHERE order_id=${orderId}::uuid AND status IN ('captured','refunded')) AS captured,
           (SELECT sum(amount) FROM refunds WHERE order_id=${orderId}::uuid AND status='completed') AS refunded`);
  const captured = Math.round(Number(totals?.captured ?? 0) * 100);
  const refunded = Math.round(Number(totals?.refunded ?? 0) * 100);
  if (captured > 0 && refunded >= captured) {
    await tx.execute(sql`UPDATE payments SET status='refunded', updated_at=now() WHERE order_id=${orderId}::uuid AND status='captured'`);
  }
}
