'use server';

import { z } from 'zod';
import * as cart from '@tuw/heart/modules/cart';
import * as orders from '@tuw/heart/modules/orders';
import * as payments from '@tuw/heart/modules/payments';
import { activeProviderSlug } from '@tuw/heart/integrations/registry';
import { paymentAdapters } from '@tuw/heart/integrations/payments';
import { guards } from './session';

const quoteInput = z.object({
  checkoutKey: z.string().uuid(),
  discountCode: z.string().trim().max(50).optional(),
  giftCardCode: z.string().trim().max(64).optional(),
  speed: z.enum(['standard', 'express']).default('standard'),
  method: z.enum(['card', 'upi']).default('card'),
});

/** Public config for the browser: active provider and its public key (never secrets). */
export const getPaymentConfigAction = guards.action({ access: 'public', input: z.object({}) }, async () => {
  const slug = await activeProviderSlug('payment');
  const adapter = paymentAdapters.find((a) => a.slug === slug);
  if (!adapter || adapter.slug === 'mock') return { provider: slug ?? 'mock', live: false, keyId: null as string | null };
  const cfg = adapter.clientConfig?.() ?? null;
  return { provider: adapter.slug, live: Boolean(cfg), keyId: cfg?.keyId ?? null };
});

export const createPaymentIntentAction = guards.action({ access: 'guestOrCustomer', input: quoteInput }, async ({ input, ctx }) => {
  const owner: cart.CartOwner = ctx.user ? { userId: ctx.user.id } : { sessionId: ctx.guestSessionId! };
  const bag = await cart.getCart(owner);
  if (!bag.lines.length) throw new Error('Your bag is empty.');
  const quote = await orders.quoteCheckout(bag.lines.map((l) => ({
    productUuid: l.productUuid, variantId: l.variantId, unitPaise: l.unitPaise, qty: l.qty,
  })), input);
  return payments.createPaymentIntent({ checkoutKey: input.checkoutKey, amountPaise: quote.payablePaise });
});

export const confirmPaymentAction = guards.action({
  access: 'guestOrCustomer',
  input: z.object({
    checkoutKey: z.string().uuid(),
    providerPaymentId: z.string().trim().min(1).max(150),
    signature: z.string().trim().min(1).max(500),
  }),
}, async ({ input }) => payments.confirmPaymentIntent(input));
