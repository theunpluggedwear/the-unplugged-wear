import 'server-only';
import type { PaymentGateway, PaymentIntentInput, PaymentResult } from './adapters.ts';

const BASE = 'https://api.razorpay.com/v1';

function config(): { keyId: string; secret: string } | null {
  const keyId = (process.env.RAZORPAY_KEY_ID ?? '').trim();
  const secret = (process.env.RAZORPAY_KEY_SECRET ?? '').trim();
  return keyId && secret ? { keyId, secret } : null;
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const cfg = config();
  if (!cfg) throw new Error('Razorpay is not configured.');
  const auth = Buffer.from(`${cfg.keyId}:${cfg.secret}`).toString('base64');
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}`, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const message = typeof body === 'object' && body && 'error' in body
      ? JSON.stringify((body as { error: unknown }).error)
      : text.slice(0, 300);
    throw new Error(`Razorpay ${path} failed (${res.status}): ${message}`);
  }
  return body as T;
}

export const razorpayGateway: PaymentGateway = {
  slug: 'razorpay',
  liveReady: () => Boolean(config()),

  clientConfig() {
    const cfg = config();
    return cfg ? { keyId: cfg.keyId } : null;
  },

  async createPayment(input: PaymentIntentInput): Promise<PaymentResult> {
    if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) {
      throw new RangeError('amountPaise must be a positive integer');
    }
    const order = await call<{ id: string; status: string }>('/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': input.reference },
      body: JSON.stringify({
        amount: input.amountPaise,
        currency: input.currency,
        receipt: input.reference.slice(0, 40),
        notes: { reference: input.reference },
      }),
    });
    return { providerRef: order.id, status: 'pending', providerStatus: order.status };
  },

  async getPayment(providerPaymentId) {
    const payment = await call<{ id: string; status: string; amount?: number; currency?: string; error_code?: string | null }>(
      `/payments/${encodeURIComponent(providerPaymentId)}`, { method: 'GET' });
    return { status: payment.status, amountPaise: payment.amount, currency: payment.currency };
  },

  async getOrderPayments(providerOrderId) {
    const result = await call<{ items?: { id: string; status: string; amount?: number; currency?: string }[] }>(
      `/orders/${encodeURIComponent(providerOrderId)}/payments`, { method: 'GET' });
    return (result.items ?? []).map((p) => ({ id: p.id, status: p.status, amountPaise: p.amount, currency: p.currency }));
  },

  async refund(input: { providerRef: string; amountPaise: number; reference: string }): Promise<PaymentResult> {
    if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) {
      throw new RangeError('amountPaise must be a positive integer');
    }
    const refund = await call<{ id: string; status: string }>(`/payments/${encodeURIComponent(input.providerRef)}/refund`, {
      method: 'POST',
      headers: { 'Idempotency-Key': input.reference },
      body: JSON.stringify({ amount: input.amountPaise, notes: { reference: input.reference } }),
    });
    return { providerRef: refund.id, status: 'refunded', providerStatus: refund.status };
  },
};
