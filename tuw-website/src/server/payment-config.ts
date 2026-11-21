import 'server-only';
import { getPaymentGateway, type PaymentGateway } from '@tuw/heart/integrations/payments';
import type { PaymentConfig } from '@storefront/lib/payment-config';

const UNAVAILABLE: PaymentConfig = {
  provider: 'mock',
  available: false,
  live: false,
  testMode: true,
  keyId: null,
};

/**
 * The public, per-deployment gateway capabilities. This deliberately omits the
 * action guards (no cookies / request id), so it can be started in a Server
 * Component and streamed to the browser via use() (CLN-NXT-006). It mirrors
 * getPaymentConfigAction, which stays the client-callable form for any future
 * on-demand refresh.
 */
export async function readPaymentConfig(): Promise<PaymentConfig> {
  const envSlug = (process.env.PAYMENT_PROVIDER || '').trim();
  let gateway: PaymentGateway | null = null;
  try {
    gateway = await getPaymentGateway();
  } catch {
    // No usable gateway: report unavailable instead of failing the layout.
  }
  if (!gateway?.clientConfig?.()) {
    return { ...UNAVAILABLE, provider: (gateway?.slug ?? envSlug) || 'unavailable' };
  }
  const cfg = gateway.clientConfig();
  return {
    provider: gateway.slug,
    available: true,
    live: (process.env.RAZORPAY_KEY_ID ?? '').startsWith('rzp_live_'),
    testMode: (process.env.RAZORPAY_KEY_ID ?? '').startsWith('rzp_test_'),
    keyId: cfg?.keyId ?? null,
  };
}
