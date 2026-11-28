'use server';

import * as orders from '@tuw/heart/modules/orders';
import { orderSchemas as s } from '@tuw/heart/modules/orders';
import { guards } from './session';





export const listOrdersAction = guards.action({ permission: 'order.view', input: s.adminList }, async ({ input }) => orders.adminListOrders(input));

export const getOrderAction = guards.action({ permission: 'order.view', input: s.orderRef }, async ({ input }) => orders.adminGetOrder(input.orderNumber));

export const setOrderStatusAction = guards.action({ permission: 'order.update_status', input: s.adminStatus }, async ({ input, ctx }) =>
  orders.adminSetOrderStatus(input, ctx.user!.id, { canRefund: ctx.user!.permissions.includes('order.refund') }));

export const setOrdersStatusAction = guards.action({ permission: 'order.update_status', input: s.adminBulkStatus }, async ({ input, ctx }) =>
  orders.adminSetOrdersStatus(input.orderNumbers, input.to, ctx.user!.id, { canRefund: ctx.user!.permissions.includes('order.refund') }));
