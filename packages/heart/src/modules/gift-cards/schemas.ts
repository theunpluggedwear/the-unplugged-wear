import { z } from 'zod';

export const issueCard = z.object({
  recipientName: z.string().trim().max(150).optional(),
  recipientEmail: z.string().trim().email().optional(),
  message: z.string().trim().max(500).optional(),
  amountPaise: z.number().int().min(100).max(10_000_000_00),
  issuedBy: z.string().uuid().optional(),
});

export const redeemCard = z.object({
  code: z.string().trim().min(8).max(64),
  amountPaise: z.number().int().min(1).max(10_000_000_00),
  orderId: z.string().uuid(),
});

export const adjustCard = z.object({
  cardId: z.string().uuid(),
  amountPaise: z.number().int().min(1).max(10_000_000_00),
  direction: z.enum(['credit', 'debit']),
  note: z.string().trim().min(1).max(255),
  idempotencyKey: z.string().trim().min(8).max(255),
  actor: z.string().min(1).max(50),
});

export const setStatus = z.object({
  cardId: z.string().uuid(),
  status: z.enum(['active', 'disabled']),
});

export const balanceCheck = z.object({
  code: z.string().trim().min(8).max(64),
});

export const adminList = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['all', 'active', 'disabled', 'expired', 'depleted']).default('all'),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(20),
});

export const cardRef = z.object({ cardId: z.string().uuid() });

export type IssueCardInput = z.infer<typeof issueCard>;
export type RedeemCardInput = z.infer<typeof redeemCard>;
export type AdjustCardInput = z.infer<typeof adjustCard>;