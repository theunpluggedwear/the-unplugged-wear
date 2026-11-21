import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { razorpayCall, razorpayConfig } from '../payments/razorpay.ts';
import type {
  CreateInvoiceInput,
  InvoiceCapabilities,
  InvoiceProvider,
  InvoiceResult,
  InvoiceStatus,
  NormalizedInvoiceEvent,
} from './types.ts';

const CAPS: InvoiceCapabilities = {
  create: true, issue: true, fetch: true, cancel: true,
  webhooks: true, hostedUrl: true, pdf: false, taxLines: false,
};

interface RazorpayInvoice {
  id: string;
  status?: string;
  order_id?: string;
  payment_id?: string | null;
  short_url?: string;
  amount?: number;
  amount_paid?: number;
  amount_due?: number;
  expire_by?: number;
  [key: string]: unknown;
}

const STATUS: Record<string, InvoiceStatus> = {
  draft: 'draft',
  issued: 'issued',
  partially_paid: 'partially_paid',
  paid: 'paid',
  expired: 'expired',
  cancelled: 'cancelled',
  deleted: 'cancelled',
};

const statusOf = (raw: string | undefined): InvoiceStatus => STATUS[(raw ?? '').trim().toLowerCase()] ?? 'failed';

const asResult = (body: RazorpayInvoice): InvoiceResult => ({
  providerDocumentId: body.id,
  providerOrderId: body.order_id,
  providerPaymentId: body.payment_id ?? undefined,
  url: body.short_url,
  status: statusOf(body.status),
  amountPaise: body.amount ?? 0,
  amountPaidPaise: body.amount_paid ?? 0,
  amountDuePaise: body.amount_due ?? 0,
  expiresAt: body.expire_by ? new Date(body.expire_by * 1000) : null,
  raw: body,
});

const phone = (value: string): string => value.replace(/[^\d+]/g, '').slice(0, 15);
const address = (input: CreateInvoiceInput, kind: 'billingAddress' | 'shippingAddress') => {
  const a = input[kind];
  return {
    line1: a.line1.slice(0, 100),
    line2: (a.line2 ?? '').slice(0, 100),
    city: a.city.slice(0, 60),
    state: a.state.slice(0, 60),
    postalCode: a.postalCode.slice(0, 20),
    country: 'IN',
  };
};

/** Razorpay Invoice API (non-GST invoices: no tax/HSN/SAC fields). */
export const razorpayInvoiceProvider: InvoiceProvider = {
  slug: 'razorpay_invoice',
  paymentProviderSlug: 'razorpay',
  liveReady: () => Boolean(razorpayConfig()),
  capabilities: CAPS,

  async create(input) {
    const body: Record<string, unknown> = {
      type: 'invoice',
      draft: '1',
      description: input.description.slice(0, 2000),
      customer: {
        name: input.buyer.name.trim().slice(0, 50),
        email: input.buyer.email.slice(0, 64),
        contact: phone(input.buyer.phone),
        billing_address: address(input, 'billingAddress'),
        shipping_address: address(input, 'shippingAddress'),
      },
      line_items: input.lines.map((line) => ({
        name: line.name.slice(0, 120),
        description: (line.description ?? '').slice(0, 2000) || undefined,
        amount: line.amountPaise,
        quantity: line.quantity,
        currency: input.currency,
      })),
      partial_payment: false,
      currency: input.currency,
      expire_by: Math.floor(input.expiresAt.getTime() / 1000),
      sms_notify: false,
      email_notify: false,
      notes: { ...(input.notes ?? {}), orderNumber: input.orderNumber, checkoutKey: input.checkoutKey },
    };
    const created = await razorpayCall<RazorpayInvoice>('/invoices', {
      method: 'POST',
      headers: { 'Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify(body),
    });
    return asResult(created);
  },

  async issue(providerDocumentId) {
    const body = await razorpayCall<RazorpayInvoice>(`/invoices/${encodeURIComponent(providerDocumentId)}/issue`, { method: 'POST' });
    return asResult(body);
  },

  async fetch(providerDocumentId) {
    const body = await razorpayCall<RazorpayInvoice>(`/invoices/${encodeURIComponent(providerDocumentId)}`, { method: 'GET' });
    return asResult(body);
  },

  async cancel(providerDocumentId) {
    const body = await razorpayCall<RazorpayInvoice>(`/invoices/${encodeURIComponent(providerDocumentId)}/cancel`, { method: 'POST' });
    return asResult(body);
  },
};

/** Invoice webhooks share the payment webhook signature header/secret. */
export function parseRazorpayInvoiceWebhook(raw: string, headers: Headers): NormalizedInvoiceEvent | null {
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
  const eventType = typeof parsed.event === 'string' ? parsed.event : '';
  if (!eventType.startsWith('invoice.')) return null;

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';
  const signature = headers.get('x-razorpay-signature') ?? '';
  if (!secret || !signature) return null;
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const payload = (parsed.payload ?? {}) as Record<string, unknown>;
  const entityOf = (key: string): Record<string, unknown> => {
    const wrapper = payload[key];
    if (!wrapper || typeof wrapper !== 'object') return {};
    const entity = (wrapper as Record<string, unknown>).entity;
    return entity && typeof entity === 'object' ? entity as Record<string, unknown> : {};
  };
  const invoice = entityOf('invoice');
  const payment = entityOf('payment');
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : undefined);

  return {
    provider: 'razorpay_invoice',
    providerDocumentId: str(invoice.id) ?? '',
    providerOrderId: str(invoice.order_id) ?? str(payment.order_id),
    providerPaymentId: str(payment.id) ?? str(invoice.payment_id),
    status: eventType === 'invoice.paid' ? 'paid' : eventType === 'invoice.expired' ? 'expired' : 'partially_paid',
    paymentStatus: str(payment.status),
    amountPaise: num(payment.amount) ?? num(invoice.amount),
    currency: str(payment.currency) ?? str(invoice.currency),
    raw: parsed,
  };
}
