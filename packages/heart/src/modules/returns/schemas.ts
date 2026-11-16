import { z } from 'zod';

// Input shapes for exchange / replacement requests (DOC/backend/13 "Returns").
// The database is the last line of defence: reason codes, dispositions and the
// one-request-per-line rules are also CHECKs and partial unique indexes.

export const reasonCode = z.enum(['size_fit', 'wrong_variant', 'damaged', 'misprint', 'wrong_item', 'quality']);

export const returnStatus = z.enum([
  'requested', 'approved', 'rejected', 'pickup_scheduled', 'in_transit',
  'received', 'inspected', 'completed', 'cancelled', 'disputed',
]);
export type ReturnStatus = z.infer<typeof returnStatus>;

export const disposition = z.enum(['pending', 'restock', 'scrap', 'return_to_customer', 'exchange', 'replacement']);
export type Disposition = z.infer<typeof disposition>;

export const create = z.object({
  orderNumber: z.string().trim().min(5, 'Enter the order number').max(30),
  type: z.enum(['exchange', 'replacement']),
  items: z.array(z.object({
    orderItemId: z.string().uuid(),
    qty: z.number().int().min(1, 'Choose how many').max(20),
    reasonCode,
    /** Required for an exchange line: the variant the customer wants instead. */
    exchangeVariantId: z.string().uuid().optional(),
    conditionNote: z.string().trim().max(500).optional(),
  })).min(1, 'Choose at least one item').max(20),
  note: z.string().trim().max(500).optional(),
  /**
   * At least one photo on every request (DOC/backend/06). The storefront
   * records the chosen files as demo media rows before calling this.
   */
  evidenceMediaIds: z.array(z.string().uuid()).min(1, 'Add at least one photo').max(10),
  /** Qikink demands the unboxing video for wrong / missing items (015). */
  unboxingVideo: z.boolean().default(false),
  /** One per submit, reused on retries: the same key returns the same request. */
  requestKey: z.string().uuid(),
});
export type CreateReturnInput = z.infer<typeof create>;

export const returnRef = z.object({ returnId: z.string().uuid() });

export const payDifference = z.object({
  returnId: z.string().uuid(),
  method: z.enum(['card', 'upi']),
  /** Demo gateway only: exercise the decline path. */
  simulate: z.literal('decline').optional(),
});

export const adminList = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.union([returnStatus, z.literal('all')]).default('all'),
  type: z.union([z.enum(['exchange', 'replacement']), z.literal('all')]).default('all'),
  page: z.number().int().min(1).max(100_000).default(1),
  perPage: z.number().int().min(1).max(200).default(20),
});

export const adminStatus = z.object({
  returnId: z.string().uuid(),
  to: returnStatus,
  note: z.string().trim().max(500).optional(),
  /** Required when rejecting; the customer sees it. */
  rejectionReason: z.string().trim().max(255).optional(),
});

export const adminItem = z.object({
  returnId: z.string().uuid(),
  itemId: z.string().uuid(),
  disposition,
  exchangeVariantId: z.string().uuid().optional(),
});

export const adminRefund = z.object({
  returnId: z.string().uuid(),
  method: z.enum(['source', 'upi', 'bank_transfer']),
  /** UPI id or bank account for a COD payout; only a masked copy is stored. */
  destination: z.string().trim().max(60).optional(),
  /** One per staff intent, reused on retries. */
  refundKey: z.string().uuid(),
});
