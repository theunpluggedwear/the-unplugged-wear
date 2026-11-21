import 'server-only';
import { AppError } from '../../platform/errors/index.ts';
import { activeProviderSlug } from '../registry/index.ts';
import { findInvoiceProvider, invoiceAdapters } from './adapters.ts';

export * from './types.ts';
export * from './adapters.ts';
export { parseRazorpayInvoiceWebhook } from './razorpay.ts';
export { parseMockInvoiceWebhook } from './mock.ts';

/** Invoice provider is independent of the payment gateway. */
export async function getInvoiceProvider(): Promise<(typeof invoiceAdapters)[number]> {
  const slug = (process.env.INVOICE_PROVIDER ?? '').trim() || await activeProviderSlug('invoice');
  const adapter = slug ? findInvoiceProvider(slug) : undefined;
  if (!adapter) throw new AppError('RULE_VIOLATION', 'No invoice provider is available. Ask an admin to enable one.');
  return adapter;
}
