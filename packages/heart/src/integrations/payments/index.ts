import 'server-only';
import { AppError } from '../../platform/errors/index.ts';
import { activeProviderSlug } from '../registry/index.ts';
import { paymentAdapters, type PaymentGateway } from './adapters.ts';

export * from './adapters.ts';

/** The gateway checkout should use now (registry row → adapter). */
export async function getPaymentGateway(): Promise<PaymentGateway> {
  const slug = (process.env.PAYMENT_PROVIDER || '').trim() || await activeProviderSlug('payment');
  const gateway = paymentAdapters.find((a) => a.slug === slug);
  if (!gateway) throw new AppError('RULE_VIOLATION', 'Online payments are not available right now. Please try again later or contact support.');
  return gateway;
}
