import 'server-only';

export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'partially_paid'
  | 'paid'
  | 'expired'
  | 'cancelled'
  | 'failed';

export interface InvoiceAddress {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CreateInvoiceInput {
  orderId: string;
  orderNumber: string;
  checkoutKey: string;
  amountPaise: number;
  currency: 'INR';
  description: string;
  expiresAt: Date;
  idempotencyKey: string;
  buyer: { name: string; email: string; phone: string };
  billingAddress: InvoiceAddress;
  shippingAddress: InvoiceAddress;
  lines: Array<{
    name: string;
    description?: string;
    amountPaise: number;
    quantity: number;
    sku?: string;
    hsn?: string;
  }>;
  notes?: Record<string, string>;
}

export interface InvoiceResult {
  providerDocumentId: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  url?: string;
  status: InvoiceStatus;
  amountPaise: number;
  amountPaidPaise?: number;
  amountDuePaise?: number;
  expiresAt?: Date | null;
  raw: unknown;
}

export interface InvoiceCapabilities {
  create: boolean;
  issue: boolean;
  fetch: boolean;
  cancel: boolean;
  webhooks: boolean;
  hostedUrl: boolean;
  pdf: boolean;
  taxLines: boolean;
}

export interface InvoiceProvider {
  slug: string;
  /** Underlying payment adapter used to fetch/refund the captured payment. */
  paymentProviderSlug?: string;
  liveReady(): boolean;
  capabilities: InvoiceCapabilities;
  create(input: CreateInvoiceInput): Promise<InvoiceResult>;
  issue(providerDocumentId: string): Promise<InvoiceResult>;
  fetch(providerDocumentId: string): Promise<InvoiceResult | null>;
  cancel(providerDocumentId: string): Promise<InvoiceResult>;
}

export interface NormalizedInvoiceEvent {
  provider: string;
  providerDocumentId?: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  status?: string;
  paymentStatus?: string;
  amountPaise?: number;
  currency?: string;
  raw: unknown;
}
