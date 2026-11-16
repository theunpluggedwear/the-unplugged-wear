'use server';

import { z } from 'zod';
import * as giftCards from '@tuw/heart/modules/gift-cards';
import { guards } from './session';

export const checkGiftCardBalanceAction = guards.action({
  access: 'public',
  input: z.object({ code: z.string().trim().min(8).max(64) }),
}, async ({ input }) => giftCards.balance(input.code));