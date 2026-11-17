import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, withTransaction } from '../../platform/db/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import { getPaymentGateway } from '../../integrations/payments/index.ts';
import { verifyRazorpayPaymentSignature } from '../../integrations/webhooks/index.ts';

export interface IntentInput {
  checkoutKey: string;
  amountPaise: number;
}

export interface CreatedIntent {
  providerOrderId: string;
  keyId: string;
  amountPaise: number;
}

/** Create a provider order for a checkout attempt. Idempotent by checkout key. */
export async function createPaymentIntent(input: IntentInput): Promise<CreatedIntent> {
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new AppError('VALIDATION_FAILED', 'The order total must be a positive amount.');
  }
  const gateway = await getPaymentGateway();
  const keyId = gateway.clientConfig?.()?.keyId;
  if (!keyId) throw new AppError('RULE_VIOLATION', 'The active payment provider cannot create a checkout intent.');

  const existing = await getDb().execute<{ provider_order_id: string }>(sql`
    SELECT provider_order_id FROM payment_intents WHERE checkout_key = ${input.checkoutKey}::uuid`);
  if (existing.rows[0]) {
    return { providerOrderId: existing.rows[0].provider_order_id, keyId, amountPaise: input.amountPaise };
  }

  const result = await gateway.createPayment({
    reference: input.checkoutKey,
    amountPaise: input.amountPaise,
    currency: 'INR',
  });
  await getDb().execute(sql`
    INSERT INTO payment_intents (id, checkout_key, provider, provider_order_id, amount_paise, currency, status)
    VALUES (${uuidv7()}, ${input.checkoutKey}::uuid, ${gateway.slug}, ${result.providerRef}, ${input.amountPaise}, 'INR', 'created')
    ON CONFLICT (checkout_key) DO NOTHING`);
  return { providerOrderId: result.providerRef, keyId, amountPaise: input.amountPaise };
}

export interface ConfirmInput {
  checkoutKey: string;
  providerPaymentId: string;
  signature: string;
}

/** Verify the client callback, return the provider order id the order must use. */
export async function confirmPaymentIntent(input: ConfirmInput): Promise<{ providerOrderId: string; providerPaymentId: string }> {
  const { rows } = await getDb().execute<{ provider_order_id: string; status: string; amount_paise: string }>(sql`
    SELECT provider_order_id, status, amount_paise FROM payment_intents WHERE checkout_key = ${input.checkoutKey}::uuid FOR UPDATE`);
  const intent = rows[0];
  if (!intent) throw new AppError('NOT_FOUND', 'That checkout attempt was not found.');
  if (!verifyRazorpayPaymentSignature(intent.provider_order_id, input.providerPaymentId, input.signature)) {
    throw new AppError('RULE_VIOLATION', 'Payment signature verification failed.');
  }
  if (intent.status === 'paid') return { providerOrderId: intent.provider_order_id, providerPaymentId: input.providerPaymentId };
  if (intent.status === 'failed') throw new AppError('RULE_VIOLATION', 'That payment attempt failed. Start a new checkout.');
  await withTransaction(async (tx) => {
    await tx.execute(sql`
      UPDATE payment_intents SET status='paid', payment_id=${input.providerPaymentId}, signature_verified_at=now(), paid_at=now(), updated_at=now()
      WHERE checkout_key=${input.checkoutKey}::uuid`);
  });
  return { providerOrderId: intent.provider_order_id, providerPaymentId: input.providerPaymentId };
}
