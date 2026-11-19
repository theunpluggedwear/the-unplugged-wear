'use server';

import { z } from 'zod';
import * as orders from '@tuw/heart/modules/orders';
import * as payments from '@tuw/heart/modules/payments';
import { confirmPaidOrder } from '@tuw/heart/modules/orders';
import { activeProviderSlug } from '@tuw/heart/integrations/registry';
import { paymentAdapters, getPaymentGateway } from '@tuw/heart/integrations/payments';
import { verifyRazorpayPaymentSignature } from '@tuw/heart/integrations/webhooks';
import { guards } from './session';

const quoteInput = z.object({
  checkoutKey: z.string().uuid(),
  discountCode: z.string().trim().max(50).optional(),
  giftCardCode: z.string().trim().max(64).optional(),
  speed: z.enum(['standard', 'express']).default('standard'),
  method: z.enum(['card', 'upi']).default('card'),
});

export const getPaymentConfigAction = guards.action({ access: 'public', input: z.object({}) }, async () => {
  const slug = (process.env.PAYMENT_PROVIDER || '').trim() || await activeProviderSlug('payment');
  const adapter = paymentAdapters.find((a) => a.slug === slug);
  if (!adapter || !adapter.clientConfig?.()) {
    return { provider: slug ?? 'unavailable', available: false, live: false, testMode: true, keyId: null as string | null };
  }
  const cfg = adapter.clientConfig();
  return {
    provider: adapter.slug,
    available: true,
    live: (process.env.RAZORPAY_KEY_ID ?? '').startsWith('rzp_live_'),
    testMode: (process.env.RAZORPAY_KEY_ID ?? '').startsWith('rzp_test_'),
    keyId: cfg?.keyId ?? null,
  };
});

/** Validate input, create the pending order, then create the provider order outside the DB transaction. */
export const createPaymentIntentAction = guards.action({ access: 'guestOrCustomer', input: orders.orderSchemas.placeOrder }, async ({ input, ctx }) => {
  const buyer: orders.Buyer = ctx.user ? { userId: ctx.user.id, email: input.email ?? '' } : { sessionId: ctx.guestSessionId! };
  const pending = await orders.createPendingOrder(buyer, input);
  if (pending.replayed) {
    const intent = await payments.getIntentByCheckoutKey(input.checkoutKey);
    if (!intent?.providerOrderId) throw new Error('This checkout is still being prepared. Please wait and try again.');
    return { ...pending, providerOrderId: intent.providerOrderId, keyId: getPaymentGatewayKeyId() };
  }
  const gateway = await getPaymentGateway();
  const result = await gateway.createPayment({
    reference: pending.orderNumber,
    amountPaise: pending.amountPaise,
    currency: 'INR',
  });
  await payments.attachProviderOrder({ intentId: pending.intentId, provider: gateway.slug, providerOrderId: result.providerRef });
  return { ...pending, providerOrderId: result.providerRef, keyId: gateway.clientConfig?.()?.keyId ?? '' };
});

function getPaymentGatewayKeyId(): string {
  return (process.env.RAZORPAY_KEY_ID ?? '').trim();
}

export const confirmPaymentAction = guards.action({
  access: 'guestOrCustomer',
  input: z.object({
    checkoutKey: z.string().uuid(),
    providerPaymentId: z.string().trim().min(1).max(150),
    signature: z.string().trim().min(1).max(500),
  }),
}, async ({ input }) => {
  const intent = await payments.getIntentByCheckoutKey(input.checkoutKey);
  if (!intent?.providerOrderId) throw new Error('This checkout was not found.');
  if (!verifyRazorpayPaymentSignature(intent.providerOrderId, input.providerPaymentId, input.signature)) {
    throw new Error('Payment signature verification failed.');
  }
  const adapter = paymentAdapters.find((a) => a.slug === 'razorpay');
  const status = await adapter?.getPayment?.(input.providerPaymentId);
  if (status?.status !== 'captured') throw new Error('Payment is not captured yet. It will confirm shortly.');
  return confirmPaidOrder({
    providerOrderId: intent.providerOrderId,
    providerPaymentId: input.providerPaymentId,
    amountPaise: intent.amountPaise,
    currency: 'INR',
  });
});

export const getCheckoutStatusAction = guards.action({
  access: 'guestOrCustomer',
  input: z.object({ orderNumber: z.string().trim().max(30) }),
}, ({ input, ctx }) => orders.getOrderForViewer(input.orderNumber, { userId: ctx.user?.id ?? null }));
