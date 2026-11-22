'use server';

import * as returns from '@tuw/heart/modules/returns';
import { returnSchemas as s } from '@tuw/heart/modules/returns';
import { guards } from './session';





export const listReturnsAction = guards.action({ permission: 'return.view', input: s.adminList }, async ({ input }) => returns.adminListReturns(input));

export const getReturnAction = guards.action({ permission: 'return.view', input: s.returnRef }, async ({ input }) => returns.adminGetReturn(input.returnId));

export const setReturnStatusAction = guards.action({ permission: 'return.manage', input: s.adminStatus }, async ({ input, ctx }) =>
  returns.adminSetReturnStatus(input, ctx.user!.id));

export const setReturnItemAction = guards.action({ permission: 'return.manage', input: s.adminItem }, async ({ input, ctx }) =>
  returns.adminSetReturnItem(input, ctx.user!.id));

export const refundReturnAction = guards.action({ permission: 'return.manage', input: s.adminRefund }, async ({ input, ctx }) =>
  returns.adminRefundReturn(input, ctx.user!.id));
