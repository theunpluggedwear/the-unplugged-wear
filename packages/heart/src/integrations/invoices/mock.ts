import 'server-only';
import { razorpayConfig } from '../payments/razorpay.ts';
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
  webhooks: false, hostedUrl: true, pdf: false, taxLines: false,
};

/** Deterministic provider for tests and local simulation. No money moves. */
export const mockInvoiceProvider: InvoiceProvider = {
  slug: 'mock_invoice',
  paymentProviderSlug: 'mock',
  liveReady: () => Boolean(razorpayConfig()),
  capabilities: CAPS,
  async create(input) {
    if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) throw new RangeError('amountPaise must be positive');
    const id = `mock_inv_${input.checkoutKey.slice(0, 12)}`;
    return {
      providerDocumentId: id,
      providerOrderId: `mock_inv_order_${input.checkoutKey.slice(0, 12)}`,
      url: `http://localhost:3007/mock-invoice/${id}`,
      status: 'draft',
      amountPaise: input.amountPaise,
      amountDuePaise: input.amountPaise,
      expiresAt: input.expiresAt,
      raw: { id, status: 'draft', entity: 'invoice' },
    };
  },
  async issue(id) {
    return {
      providerDocumentId: id,
      providerOrderId: `mock_inv_order_${id.slice(-12)}`,
      url: `http://localhost:3007/mock-invoice/${id}`,
      status: 'issued',
      amountPaise: 100,
      amountDuePaise: 100,
      raw: { id, status: 'issued', entity: 'invoice' },
    };
  },
  async fetch(id) {
    return {
      providerDocumentId: id,
      status: 'issued' as InvoiceStatus,
      amountPaise: 100,
      amountDuePaise: 100,
      raw: { id, status: 'issued', entity: 'invoice' },
    };
  },
  async cancel(id) {
    return { providerDocumentId: id, status: 'cancelled', amountPaise: 100, raw: { id, status: 'cancelled' } };
  },
};

export function parseMockInvoiceWebhook(_raw: string, _headers: Headers): NormalizedInvoiceEvent | null {
  return null;
}
