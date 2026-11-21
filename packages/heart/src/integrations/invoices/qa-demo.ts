import 'server-only';
import { QA_DEMO_FIXED_PAISE, QA_DEMO_INVOICE_PROVIDER } from '../../platform/qa-demo-product/index.ts';
import type {
  CreateInvoiceInput,
  InvoiceCapabilities,
  InvoiceProvider,
  InvoiceResult,
  NormalizedInvoiceEvent,
} from './types.ts';

const CAPS: InvoiceCapabilities = {
  create: true, issue: true, fetch: true, cancel: true,
  webhooks: false, hostedUrl: true, pdf: false, taxLines: false,
};

const urlFor = (id: string): string => `/demo-invoice/${encodeURIComponent(id)}`;

const result = (id: string, status: InvoiceResult['status'], amountPaise = QA_DEMO_FIXED_PAISE): InvoiceResult => ({
  providerDocumentId: id,
  providerOrderId: `qa_demo_order_${id}`,
  url: urlFor(id),
  status,
  amountPaise,
  amountDuePaise: status === 'paid' ? 0 : amountPaise,
  expiresAt: null,
  raw: { mode: 'qa_demo', noRealPayment: true, status },
});

/**
 * Local invoice provider for the isolated QA demo product.
 * It creates no provider request and collects no money.
 */
export const qaDemoInvoiceProvider: InvoiceProvider = {
  slug: QA_DEMO_INVOICE_PROVIDER,
  paymentProviderSlug: 'mock',
  liveReady: () => true,
  capabilities: CAPS,

  async create(input) {
    if (input.amountPaise !== QA_DEMO_FIXED_PAISE) {
      throw new Error('QA demo invoices must be exactly 100 paise.');
    }
    const id = `qa_demo_${input.checkoutKey}`;
    return result(id, 'draft');
  },

  async issue(id) {
    return result(id, 'issued');
  },

  async fetch(id) {
    return result(id, 'issued');
  },

  async cancel(id) {
    return result(id, 'cancelled');
  },
};

export function parseQaDemoInvoiceWebhook(_raw: string, _headers: Headers): NormalizedInvoiceEvent | null {
  return null;
}
