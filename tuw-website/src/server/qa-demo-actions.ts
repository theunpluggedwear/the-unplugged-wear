'use server';

import { z } from 'zod';
import * as invoices from '@tuw/heart/modules/invoices';
import * as orders from '@tuw/heart/modules/orders';
import { QA_DEMO_INVOICE_PROVIDER } from '@tuw/heart/platform/qa-demo-product';
import { guards } from './session';

/** Mark a local QA demo invoice paid. No provider is contacted. */
export const completeQaDemoPaymentAction = guards.action({
  access: 'customer',
  input: z.object({
    documentId: z.string().uuid(),
    receipt: z.string().optional(),
  }),
}, async ({ input, ctx }) => {
  const doc = await invoices.getDocumentById(input.documentId);
  if (!doc || doc.provider !== QA_DEMO_INVOICE_PROVIDER) {
    throw new Error('This is not a demo payment invoice.');
  }
  if (doc.amountPaise !== 100) {
    throw new Error('The demo invoice amount is invalid.');
  }

  const order = await orders.getOrderForViewer(doc.orderNumber, {
    userId: ctx.user!.id,
    receipt: input.receipt,
  });

  await invoices.markInvoicePaid({
    provider: QA_DEMO_INVOICE_PROVIDER,
    providerDocumentId: doc.providerDocumentId,
    providerOrderId: doc.providerOrderId ?? undefined,
    providerPaymentId: `demo_pay_${doc.providerDocumentId}`,
    status: 'paid',
    paymentStatus: 'captured',
    amountPaise: doc.amountPaise,
    currency: doc.currency,
    raw: { mode: 'qa_demo', noRealPayment: true },
  });

  return { orderNumber: order.orderNumber };
});
