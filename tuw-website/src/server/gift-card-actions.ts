'use server';

import { z } from 'zod';
import * as giftCards from '@tuw/heart/modules/gift-cards';
import { guards } from './session';

export const checkGiftCardBalanceAction = guards.action({
  access: 'public',
  input: z.object({ code: z.string().trim().min(8).max(64) }),
}, async ({ input }) => giftCards.balance(input.code));

export const previewGiftCardAction = guards.action({
  access: 'public',
  input: z.object({
    code: z.string().trim().min(8).max(64),
    maxPaise: z.number().int().min(1).max(10_000_000_00),
  }),
}, async ({ input }) => giftCards.previewRedeem(input.code, input.maxPaise));