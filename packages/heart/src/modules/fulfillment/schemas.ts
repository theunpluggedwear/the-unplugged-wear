import { z } from 'zod';

// Input shapes for fulfilment & shipping (DOC/backend/13, 16). Money is always
// integer paise; the DB stores DECIMAL(12,2) and converts at its boundary.

export const fulfillmentStatus = z.enum([
  'pending', 'submitted', 'on_hold', 'in_production', 'shipped',
  'delivery_exception', 'delivered', 'rto_initiated', 'returned',
  'cancelled', 'failed',
]);
export type FulfillmentStatusValue = z.infer<typeof fulfillmentStatus>;

export const shipmentStatus = z.enum(['pending', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned']);
export type ShipmentStatus = z.infer<typeof shipmentStatus>;

export const claimType = z.enum(['damaged', 'misprint', 'wrong_item', 'missing_item', 'size_discrepancy', 'lost_in_transit']);
export type ClaimType = z.infer<typeof claimType>;

export const adminList = z.object({
  q: z.string().trim().max(100).optional(),
  tab: z.union([z.enum(['all', 'waiting', 'queue', 'hold', 'in_production', 'shipped', 'issues']), z.literal('')]).default('all'),
  page: z.number().int().min(1).max(100_000).default(1),
  perPage: z.number().int().min(1).max(200).default(20),
});

export const fulfillmentRef = z.object({ fulfillmentId: z.string().uuid() });

/** Staff presses "Submit now" on a waiting order: one provider send, no duplicate. */
export const submitNow = z.object({ orderNumber: z.string().trim().min(5).max(30) });

export const syncNow = fulfillmentRef;

export const adminCancel = z.object({
  fulfillmentId: z.string().uuid(),
  note: z.string().trim().max(300).optional(),
});

export const adminShipmentList = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.union([shipmentStatus, z.literal('all')]).default('all'),
  page: z.number().int().min(1).max(100_000).default(1),
  perPage: z.number().int().min(1).max(200).default(20),
});

export const shipmentRef = z.object({ shipmentId: z.string().uuid() });

/** Manual dispatch (Custom Atelier or any order a partner did not ship). */
export const addTracking = z.object({
  orderNumber: z.string().trim().min(5).max(30),
  carrier: z.string().trim().min(2, 'Name the courier').max(50),
  trackingNumber: z.string().trim().min(3, 'Enter the tracking number').max(100),
  shippedAt: z.string().datetime().optional(),
  estimatedDeliveryAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  note: z.string().trim().max(255).optional(),
});

export const setShipmentStatus = z.object({
  shipmentId: z.string().uuid(),
  status: shipmentStatus,
  location: z.string().trim().max(255).optional(),
  note: z.string().trim().max(255).optional(),
});

export const walletEntry = z.object({
  kind: z.enum(['recharge', 'withdrawal', 'adjustment']),
  amountPaise: z.number().int().min(1, 'Amount must be positive').max(100_000_000_00),
  note: z.string().trim().min(3, 'Say what this entry is for').max(255),
  externalRef: z.string().trim().max(100).optional(),
  /** adjustment only: is the provider balance going up or down? */
  direction: z.enum(['credit', 'debit']).optional(),
});

export const codRemittance = z.object({
  transferRef: z.string().trim().min(3, 'Enter the transfer id').max(100),
  amountPaise: z.number().int().min(1, 'Amount must be positive').max(100_000_000_00),
  feesPaise: z.number().int().min(0).max(100_000_000_00).default(0),
  remittedTo: z.enum(['wallet', 'bank']),
  remittedAt: z.string().datetime(),
  fulfillmentIds: z.array(z.string().uuid()).max(200).default([]),
});

export const claimCreate = z.object({
  fulfillmentId: z.string().uuid(),
  type: claimType,
  evidenceMediaIds: z.array(z.string().uuid()).min(1, 'Add the photos / unboxing video').max(10),
  hasUnboxingVideo: z.boolean().default(false),
  customerNote: z.string().trim().max(1000).optional(),
  returnId: z.string().uuid().optional(),
});

export const claimUpdate = z.object({
  claimId: z.string().uuid(),
  status: z.enum(['submitted', 'approved', 'rejected', 'resolved']),
  resolution: z.enum(['reprint', 'wallet_credit', 'refund', 'none']).optional(),
  staffNote: z.string().trim().max(1000).optional(),
  providerTicketRef: z.string().trim().max(100).optional(),
});

/** A new provider order for a parcel that came back (RTO) or was lost. */
export const reship = z.object({
  fulfillmentId: z.string().uuid(),
  note: z.string().trim().max(255).optional(),
});
