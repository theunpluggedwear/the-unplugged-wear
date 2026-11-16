'use server';

import * as giftCards from '@tuw/heart/modules/gift-cards';
import { giftCardSchemas as s } from '@tuw/heart/modules/gift-cards';
import { guards } from './session';

export const listGiftCardsAction = guards.action({ permission: 'giftcard.manage', input: s.adminList }, ({ input, ctx }) =>
  giftCards.adminListGiftCards(input, ctx.user!.id));

export const getGiftCardAction = guards.action({ permission: 'giftcard.manage', input: s.cardRef }, ({ input, ctx }) =>
  giftCards.adminGetGiftCard(input.cardId, ctx.user!.id));

export const issueGiftCardAction = guards.action({ permission: 'giftcard.manage', input: s.issueCard }, ({ input, ctx }) =>
  giftCards.adminIssueCard(input, ctx.user!.id));

export const adjustGiftCardAction = guards.action({ permission: 'giftcard.manage', input: s.adjustCard }, ({ input, ctx }) =>
  giftCards.adminAdjustCard(input, ctx.user!.id));

export const setGiftCardStatusAction = guards.action({ permission: 'giftcard.manage', input: s.setStatus }, ({ input, ctx }) =>
  giftCards.adminSetStatus(input.cardId, input.status, ctx.user!.id));

export const checkBalanceAction = guards.action({ permission: 'giftcard.manage', input: s.balanceCheck }, ({ input }) =>
  giftCards.balance(input.code));