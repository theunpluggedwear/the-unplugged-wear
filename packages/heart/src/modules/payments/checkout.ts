import 'server-only';
import { getPaymentGateway } from '../../integrations/payments/index.ts';
import { createPendingOrder, type Buyer, type PendingOrder } from '../orders/checkout.ts';
import { expirePendingPayment } from '../orders/payment-confirmation.ts';
import { attachProviderOrder, getIntentByCheckoutKey } from './intent.ts';
import type { PlaceOrderInput } from '../orders/schemas.ts';

export interface PreparedCheckout extends PendingOrder {
  providerOrderId: string;
  keyId: string;
}

/**
 * Create the internal order first, then ask the provider for a checkout order.
 * The provider call is always outside a DB transaction. If it fails, the
 * pending order is cancelled immediately and everything it reserved is released.
 */
export async function prepareCheckout(buyer: Buyer, input: PlaceOrderInput): Promise<PreparedCheckout> {
  const pending = await createPendingOrder(buyer, input);

  if (pending.replayed) {
    const intent = await getIntentByCheckoutKey(input.checkoutKey);
    if (!intent?.providerOrderId) throw new Error('This checkout is still being prepared. Please wait and try again.');
    return { ...pending, providerOrderId: intent.providerOrderId, keyId: (process.env.RAZORPAY_KEY_ID ?? '').trim() };
  }

  const gateway = await getPaymentGateway();
  try {
    const result = await gateway.createPayment({
      reference: pending.orderNumber,
      amountPaise: pending.amountPaise,
      currency: 'INR',
    });
    await attachProviderOrder({ intentId: pending.intentId, provider: gateway.slug, providerOrderId: result.providerRef });
    return { ...pending, providerOrderId: result.providerRef, keyId: gateway.clientConfig?.()?.keyId ?? '' };
  } catch (error) {
    await expirePendingPayment(pending.orderId);
    throw error;
  }
}
