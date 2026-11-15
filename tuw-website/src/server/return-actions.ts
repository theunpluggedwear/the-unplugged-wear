'use server';

import * as returns from '@tuw/heart/modules/returns';
import { returnSchemas as s } from '@tuw/heart/modules/returns';
import { z } from 'zod';
import { guards } from './session';

// A shopper's own exchange / replacement requests (TL-BE-10, TL-WEB-BE-27).
// The server re-checks delivery, the exchange window, the same-product rule
// and the one-request-per-line rule on every call; the form only asks.

const orderRef = z.object({ orderNumber: z.string().trim().min(5).max(30) });

export const returnableOrdersAction = guards.action({ access: 'customer', input: z.object({}) }, async ({ ctx }) =>
  returns.returnableOrders(ctx.user!.id));

export const returnEligibilityAction = guards.action({ access: 'customer', input: orderRef }, async ({ input, ctx }) =>
  returns.returnEligibility(ctx.user!.id, input.orderNumber));

/** Demo upload: the file names become media rows (demo:// URLs), no bytes are sent. */
export const recordReturnEvidenceAction = guards.action({
  access: 'customer',
  input: z.object({
    files: z.array(z.object({
      name: z.string().trim().min(1).max(120),
      mimeType: z.string().max(100).optional(),
      sizeBytes: z.number().int().min(0).max(50_000_000).optional(),
    })).min(1).max(10),
  }),
}, async ({ input, ctx }) => returns.recordDemoEvidence(ctx.user!.id, input.files));

export const createReturnAction = guards.action({ access: 'customer', input: s.create }, async ({ input, ctx }) =>
  returns.createReturn(ctx.user!.id, input));

export const myReturnsAction = guards.action({ access: 'customer', input: z.object({}) }, async ({ ctx }) =>
  returns.listMyReturns(ctx.user!.id));

export const getReturnAction = guards.action({ access: 'customer', input: s.returnRef }, async ({ input, ctx }) =>
  returns.getMyReturn(ctx.user!.id, input.returnId));

export const payDifferenceAction = guards.action({ access: 'customer', input: s.payDifference }, async ({ input, ctx }) =>
  returns.payExchangeDifference(ctx.user!.id, input));
