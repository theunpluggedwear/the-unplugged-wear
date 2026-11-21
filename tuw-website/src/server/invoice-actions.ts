'use server';

import * as invoices from '@tuw/heart/modules/invoices';
import * as orders from '@tuw/heart/modules/orders';
import { guards } from './session';

/** Create the pending order, then a provider-hosted invoice for it. */
export const createInvoiceCheckoutAction = guards.action({ access: 'guestOrCustomer', input: orders.orderSchemas.placeOrder }, async ({ input, ctx }) => {
  const buyer: orders.Buyer = ctx.user
    ? { userId: ctx.user.id, email: input.email ?? '' }
    : { sessionId: ctx.guestSessionId! };
  return invoices.prepareInvoiceCheckout(buyer, input);
});
