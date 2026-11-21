import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, withTransaction, type Transaction } from '../../platform/db/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { getInvoiceProvider } from '../../integrations/invoices/index.ts';
import type { CreateInvoiceInput, InvoiceStatus, NormalizedInvoiceEvent } from '../../integrations/invoices/index.ts';
import { createPendingOrder } from '../orders/checkout.ts';
import { confirmPaidOrder, expirePendingPayment as expireByOrder } from '../orders/payment-confirmation.ts';
import { attachProviderOrder, getIntentByCheckoutKey } from '../payments/intent.ts';
import type { Buyer } from '../orders/checkout.ts';
import type { PlaceOrderInput } from '../orders/schemas.ts';

export interface PreparedInvoiceCheckout {
  orderId: string;
  orderNumber: string;
  receipt: string;
  amountPaise: number;
  invoiceUrl: string;
  provider: string;
  providerDocumentId: string;
  replayed: boolean;
  /** True when a prior attempt failed and the shopper must start a fresh one. */
  retryable: boolean;
  reason?: string;
}

export interface InvoiceDocument {
  id: string;
  paymentIntentId: string;
  orderId: string;
  provider: string;
  providerDocumentId: string;
  providerOrderId: string | null;
  url: string | null;
  status: InvoiceStatus;
  amountPaise: number;
  currency: string;
}

type Row = {
  id: string; payment_intent_id: string; order_id: string; provider: string;
  provider_document_id: string; provider_order_id: string | null; url: string | null;
  status: InvoiceStatus; amount_paise: string; currency: string;
};

const toDocument = (r: Row): InvoiceDocument => ({
  id: r.id, paymentIntentId: r.payment_intent_id, orderId: r.order_id, provider: r.provider,
  providerDocumentId: r.provider_document_id, providerOrderId: r.provider_order_id, url: r.url,
  status: r.status, amountPaise: Number(r.amount_paise), currency: r.currency,
});

async function readDocument(tx: Transaction, intentId: string): Promise<InvoiceDocument | null> {
  const { rows } = await tx.execute<Row>(sql`
    SELECT id, payment_intent_id, order_id, provider, provider_document_id, provider_order_id, url, status, amount_paise, currency
    FROM payment_documents WHERE payment_intent_id = ${intentId}::uuid ORDER BY created_at DESC LIMIT 1`);
  return rows[0] ? toDocument(rows[0]) : null;
}

export async function getDocumentByIntent(intentId: string): Promise<InvoiceDocument | null> {
  const { rows } = await getDb().execute<Row>(sql`
    SELECT id, payment_intent_id, order_id, provider, provider_document_id, provider_order_id, url, status, amount_paise, currency
    FROM payment_documents WHERE payment_intent_id = ${intentId}::uuid ORDER BY created_at DESC LIMIT 1`);
  return rows[0] ? toDocument(rows[0]) : null;
}

export async function getDocumentByOrder(orderId: string): Promise<InvoiceDocument | null> {
  const { rows } = await getDb().execute<Row>(sql`
    SELECT id, payment_intent_id, order_id, provider, provider_document_id, provider_order_id, url, status, amount_paise, currency
    FROM payment_documents WHERE order_id = ${orderId}::uuid ORDER BY created_at DESC LIMIT 1`);
  return rows[0] ? toDocument(rows[0]) : null;
}

function buildInput(pending: Awaited<ReturnType<typeof createPendingOrder>>, input: PlaceOrderInput): CreateInvoiceInput {
  const a = input.shippingAddress;
  const name = a.fullName.trim() || 'Customer';
  const email = (input.email ?? '').trim();
  if (!email) throw new AppError('VALIDATION_FAILED', 'Enter your email so the invoice can be sent.', [{ field: 'email', message: 'Email required.' }]);
  return {
    orderId: pending.orderId,
    orderNumber: pending.orderNumber,
    checkoutKey: input.checkoutKey,
    amountPaise: pending.amountPaise,
    currency: 'INR',
    description: `Order ${pending.orderNumber} — The Unplugged Wear`,
    expiresAt: new Date(Date.now() + 30 * 60_000),
    idempotencyKey: `invoice_${input.checkoutKey}`,
    buyer: { name, email, phone: a.phone },
    billingAddress: { line1: a.line1, line2: a.line2 ?? null, city: a.city, state: a.state, postalCode: a.postalCode, country: a.country },
    shippingAddress: { line1: a.line1, line2: a.line2 ?? null, city: a.city, state: a.state, postalCode: a.postalCode, country: a.country },
    lines: [{
      name: `The Unplugged Wear order ${pending.orderNumber}`,
      description: 'Printed to order in India',
      amountPaise: pending.amountPaise,
      quantity: 1,
    }],
    notes: { orderId: pending.orderId, orderNumber: pending.orderNumber },
  };
}

/**
 * Create internal pending order first, then ask the active invoice provider to
 * create and issue a hosted invoice. Provider calls are never inside a DB
 * transaction. A failure cancels the pending order immediately.
 */
export async function prepareInvoiceCheckout(buyer: Buyer, input: PlaceOrderInput): Promise<PreparedInvoiceCheckout> {
  const pending = await createPendingOrder(buyer, input);
  const provider = await getInvoiceProvider();

  if (pending.replayed) {
    const intent = await getIntentByCheckoutKey(input.checkoutKey);
    const existing = intent ? await getDocumentByIntent(intent.id) : null;
    const usable = existing?.url && existing.status !== 'expired' && existing.status !== 'cancelled' && existing.status !== 'failed';
    if (!usable) {
      return {
        orderId: pending.orderId, orderNumber: pending.orderNumber, receipt: pending.receipt,
        amountPaise: pending.amountPaise, invoiceUrl: '', provider: existing?.provider ?? '',
        providerDocumentId: existing?.providerDocumentId ?? '', replayed: true,
        retryable: true, reason: 'PREVIOUS_ATTEMPT_FAILED',
      };
    }
    return {
      orderId: pending.orderId, orderNumber: pending.orderNumber, receipt: pending.receipt,
      amountPaise: pending.amountPaise, invoiceUrl: existing!.url!, provider: existing!.provider,
      providerDocumentId: existing!.providerDocumentId, replayed: true, retryable: false,
    };
  }

  const invoiceInput = buildInput(pending, input);
  let createdDocumentId: string | null = null;
  try {
    const created = await provider.create(invoiceInput);
    if (!created.providerDocumentId) throw new Error('Invoice provider returned no document id.');
    createdDocumentId = created.providerDocumentId;
    const issued = await provider.issue(created.providerDocumentId);

    const status = issued.status ?? created.status;
    const url = issued.url ?? created.url;
    if (!url && provider.capabilities.hostedUrl) throw new Error('Invoice provider returned no hosted URL.');

    await withTransaction(async (tx) => {
      await tx.execute(sql`
        INSERT INTO payment_documents (id, payment_intent_id, order_id, provider, document_type,
          provider_document_id, provider_order_id, provider_payment_id, url, status, amount_paise,
          currency, expires_at, issued_at, idempotency_key, raw_payload, created_at, updated_at)
        VALUES (${uuidv7()}, ${pending.intentId}::uuid, ${pending.orderId}::uuid, ${provider.slug}, 'payment_invoice',
          ${created.providerDocumentId}, ${created.providerOrderId ?? null}, ${created.providerPaymentId ?? null},
          ${url ?? null}, ${status}, ${pending.amountPaise}, 'INR', ${invoiceInput.expiresAt},
          ${status === 'issued' ? new Date() : null}, ${invoiceInput.idempotencyKey},
          ${JSON.stringify({ created: created.raw, issued: issued.raw })}::jsonb, now(), now())
        ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = now()`);
    });

    await attachProviderOrder({
      intentId: pending.intentId,
      provider: provider.paymentProviderSlug ?? 'razorpay',
      providerOrderId: created.providerOrderId ?? created.providerDocumentId,
    });

    return {
      orderId: pending.orderId, orderNumber: pending.orderNumber, receipt: pending.receipt,
      amountPaise: pending.amountPaise, invoiceUrl: url ?? '', provider: provider.slug,
      providerDocumentId: created.providerDocumentId, replayed: false, retryable: false,
    };
  } catch (error) {
    // Best-effort cancellation if the provider invoice exists but was not stored.
    if (createdDocumentId) {
      try { await provider.cancel(createdDocumentId); } catch { /* ignore best-effort cleanup */ }
    }
    await expireByOrder(pending.orderId);
    throw error;
  }
}

export async function markInvoicePaid(event: NormalizedInvoiceEvent): Promise<void> {
  if (!event.providerDocumentId) return;
  if (event.paymentStatus && event.paymentStatus !== 'captured') return;
  if (!event.providerPaymentId || event.amountPaise === undefined) return;

  const doc = await withTransaction(async (tx) => {
    const { rows } = await tx.execute<Row & { amount_paise: string }>(sql`
      SELECT id, payment_intent_id, order_id, provider, provider_document_id, provider_order_id, url, status, amount_paise, currency
      FROM payment_documents WHERE provider_document_id = ${event.providerDocumentId} FOR UPDATE`);
    const found = rows[0];
    if (!found) return null;
    if (Number(found.amount_paise) !== event.amountPaise) throw new Error(`Invoice amount ${event.amountPaise} does not match document ${found.amount_paise}`);
    if (event.currency && found.currency.toUpperCase() !== event.currency.toUpperCase()) throw new Error('Invoice currency does not match document.');
    if (found.status !== 'paid') {
      await tx.execute(sql`UPDATE payment_documents SET status='paid', provider_payment_id=${event.providerPaymentId}, paid_at=now(), updated_at=now() WHERE id=${found.id}::uuid`);
    }
    return toDocument(found);
  });
  if (!doc) return;

  await confirmPaidOrder({
    providerOrderId: doc.providerOrderId ?? doc.providerDocumentId,
    providerPaymentId: event.providerPaymentId,
    amountPaise: event.amountPaise,
    currency: event.currency,
  });
}

export async function markInvoiceExpired(providerDocumentId: string): Promise<void> {
  const doc = await withTransaction(async (tx) => {
    const { rows } = await tx.execute<Row>(sql`
      SELECT id, payment_intent_id, order_id, provider, provider_document_id, provider_order_id, url, status, amount_paise, currency
      FROM payment_documents WHERE provider_document_id = ${providerDocumentId} FOR UPDATE`);
    const found = rows[0];
    if (!found || found.status === 'paid') return null;
    await tx.execute(sql`UPDATE payment_documents SET status='expired', updated_at=now() WHERE id=${found.id}::uuid`);
    return toDocument(found);
  });
  if (doc) await expireByOrder(doc.orderId);
}

export async function markDocumentStatus(docId: string, status: InvoiceStatus, providerPaymentId?: string): Promise<void> {
  await getDb().execute(sql`
    UPDATE payment_documents SET status=${status}, provider_payment_id=COALESCE(${providerPaymentId ?? null}, provider_payment_id),
      paid_at=CASE WHEN ${status} = 'paid' THEN now() ELSE paid_at END, updated_at=now() WHERE id=${docId}::uuid`);
}
