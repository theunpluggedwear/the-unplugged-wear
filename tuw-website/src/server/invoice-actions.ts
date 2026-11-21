'use server';

import * as invoices from '@tuw/heart/modules/invoices';
import * as orders from '@tuw/heart/modules/orders';
import { guards } from './session';

/** Create the pending order, then a provider-hosted invoice for it. */
export const createInvoiceCheckoutAction = guards.action({ access: 'customer', input: orders.orderSchemas.placeOrder }, async ({ input, ctx }) => {
  const buyer: orders.Buyer = { userId: ctx.user!.id, email: ctx.user!.email };
  return invoices.prepareInvoiceCheckout(buyer, input);
});
