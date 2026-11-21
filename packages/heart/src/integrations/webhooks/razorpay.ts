import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { NormalizedWebhookEvent, WebhookKind, WebhookProvider } from './types.ts';

const numbers = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim());
  return undefined;
};

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Verify a Checkout payment signature (order_id|payment_id). */
export function verifyRazorpayPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !signature) return false;
  return safeEqual(sign(`${orderId}|${paymentId}`, secret), signature);
}

const kindFor = (eventType: string): WebhookKind => {
  if (eventType === 'order.paid' || eventType === 'payment.captured') return 'payment_captured';
  if (eventType === 'payment.failed') return 'payment_failed';
  if (eventType === 'invoice.paid') return 'invoice_paid';
  if (eventType === 'invoice.partially_paid') return 'invoice_partially_paid';
  if (eventType === 'invoice.expired') return 'invoice_expired';
  if (eventType === 'refund.created') return 'refund_created';
  if (eventType === 'refund.processed') return 'refund_processed';
  if (eventType === 'refund.failed') return 'refund_failed';
  if (eventType === 'payment.authorized') return 'authorization';
  if (eventType === 'payment.pending') return 'pending';
  if (eventType.startsWith('payment.downtime.')) return 'downtime';
  if (eventType === 'refund.speed_changed') return 'refund_speed_changed';
  if (eventType.startsWith('payment.dispute.')) return 'dispute';
  return 'unknown';
};

export const razorpayWebhookProvider: WebhookProvider = {
  slug: 'razorpay',

  verify(rawBody, headers) {
    const signature = headers.get('x-razorpay-signature');
    if (!signature) return false;
    const secrets = [process.env.RAZORPAY_WEBHOOK_SECRET, process.env.RAZORPAY_WEBHOOK_SECRET_PREVIOUS].filter(Boolean) as string[];
    return secrets.some((secret) => safeEqual(sign(rawBody, secret), signature));
  },

  normalize(rawBody, headers) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }
    const eventType = typeof parsed.event === 'string' ? parsed.event : '';
    if (!eventType) return null;

    const providerEventId = headers.get('x-razorpay-event-id')
      || (typeof parsed.id === 'string' ? parsed.id : '')
      || createHash('sha256').update(rawBody).digest('hex');

    const payload = (parsed.payload ?? {}) as Record<string, unknown>;
    const sub = (key: string): Record<string, unknown> => {
      const wrapper = payload[key];
      if (!wrapper || typeof wrapper !== 'object') return {};
      const entity = (wrapper as Record<string, unknown>).entity;
      return entity && typeof entity === 'object' ? (entity as Record<string, unknown>) : {};
    };
    const payment = sub('payment');
    const order = sub('order');
    const refund = sub('refund');
    const invoice = sub('invoice');

    const event: NormalizedWebhookEvent = {
      provider: 'razorpay',
      providerEventId,
      eventType,
      kind: kindFor(eventType),
      raw: parsed,
      providerOrderId: typeof order.id === 'string' ? order.id : typeof payment.order_id === 'string' ? payment.order_id : typeof invoice.order_id === 'string' ? invoice.order_id : undefined,
      providerPaymentId: typeof payment.id === 'string' ? payment.id : typeof invoice.payment_id === 'string' ? invoice.payment_id : undefined,
      providerRefundId: typeof refund.id === 'string' ? refund.id : undefined,
      providerDocumentId: typeof invoice.id === 'string' ? invoice.id : undefined,
      documentStatus: typeof invoice.status === 'string' ? invoice.status : undefined,
      amountPaise: numbers(refund.amount) ?? numbers(payment.amount) ?? numbers(invoice.amount),
      currency: typeof payment.currency === 'string' ? payment.currency : typeof refund.currency === 'string' ? refund.currency : typeof invoice.currency === 'string' ? invoice.currency : undefined,
      status: typeof payment.status === 'string' ? payment.status : typeof refund.status === 'string' ? refund.status : typeof invoice.status === 'string' ? invoice.status : undefined,
      occurredAt: typeof parsed.created_at === 'number' ? new Date(parsed.created_at * 1000).toISOString() : undefined,
    };
    return event;
  },
};
