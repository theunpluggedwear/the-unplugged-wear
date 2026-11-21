import 'server-only';
import type { InvoiceProvider } from './types.ts';
import { mockInvoiceProvider } from './mock.ts';
import { razorpayInvoiceProvider } from './razorpay.ts';

/** Every invoice provider must be registered here once; app code stays provider-neutral. */
export const invoiceAdapters: readonly InvoiceProvider[] = [mockInvoiceProvider, razorpayInvoiceProvider];

export function findInvoiceProvider(slug: string): InvoiceProvider | undefined {
  return invoiceAdapters.find((a) => a.slug === slug);
}
