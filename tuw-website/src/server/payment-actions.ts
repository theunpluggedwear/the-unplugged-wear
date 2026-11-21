'use server';

import { z } from 'zod';
import * as cart from '@tuw/heart/modules/cart';
import * as orders from '@tuw/heart/modules/orders';
import * as payments from '@tuw/heart/modules/payments';
import { confirmPaidOrder } from '@tuw/heart/modules/orders';
import { getPaymentGateway, paymentAdapters, type PaymentGateway } from '@tuw/heart/integrations/payments';
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
  // Single source of truth for gateway resolution (registry + env override).
  const envSlug = (process.env.PAYMENT_PROVIDER || '').trim();
  let gateway: PaymentGateway | null = null;
  try {
    gateway = await getPaymentGateway();
  } catch {
    // No usable gateway: report unavailable instead of failing the action.
  }
  if (!gateway?.clientConfig?.()) {
    return { provider: (gateway?.slug ?? envSlug) || 'unavailable', available: false, live: false, testMode: true, keyId: null as string | null };
  }
  const cfg = gateway.clientConfig();
  return {
    provider: gateway.slug,
    available: true,
    live: (process.env.RAZORPAY_KEY_ID ?? '').startsWith('rzp_live_'),
    testMode: (process.env.RAZORPAY_KEY_ID ?? '').startsWith('rzp_test_'),
    keyId: cfg?.keyId ?? null,
  };
});

/** Server quote for the current bag, so the UI shows exactly what the provider will charge. */
export const getCheckoutQuoteAction = guards.action({ access: 'guestOrCustomer', input: quoteInput }, async ({ input, ctx }) => {
  const owner: cart.CartOwner = ctx.user
    ? { userId: ctx.user.id }
    : ctx.guestSessionId ? { sessionId: ctx.guestSessionId } : { sessionId: '' };
  const bag = await cart.getCart(owner);
  if (!bag.lines.length) return { payablePaise: 0, totalPaise: 0, discountPaise: 0, giftCardPaise: 0 };
  return orders.quoteCheckout(
    bag.lines.map((l) => ({ productUuid: l.productUuid, variantId: l.variantId, unitPaise: l.unitPaise, qty: l.qty })),
    { discountCode: input.discountCode, giftCardCode: input.giftCardCode, speed: input.speed, method: input.method },
  );
});

/** Validate input, create the pending order, then create the provider order outside the DB transaction. */
export const createPaymentIntentAction = guards.action({ access: 'guestOrCustomer', input: orders.orderSchemas.placeOrder }, async ({ input, ctx }) => {
  const buyer: orders.Buyer = ctx.user ? { userId: ctx.user.id, email: input.email ?? '' } : { sessionId: ctx.guestSessionId! };
  return payments.prepareCheckout(buyer, input);
});

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
  input: z.object({ orderNumber: z.string().trim().max(30), receipt: z.string().optional() }),
}, ({ input, ctx }) => orders.getOrderForViewer(input.orderNumber, { userId: ctx.user?.id ?? null, receipt: input.receipt }));
