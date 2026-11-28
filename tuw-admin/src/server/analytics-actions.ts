'use server';

import { z } from 'zod';
import * as analytics from '@tuw/heart/modules/analytics';
import { guards } from './session';

export const getDashboardAction = guards.action({ permission: 'order.view', input: z.object({}) }, ({ ctx }) =>
  analytics.adminGetDashboard(ctx.user!.id));

export const getReportAction = guards.action({ permission: 'report.view', input: z.object({}) }, ({ ctx }) =>
  analytics.adminGetReport(ctx.user!.id));

export const listAbandonedAction = guards.action({ permission: 'order.view', input: z.object({}) }, ({ ctx }) =>
  analytics.adminListAbandoned(ctx.user!.id));

export const remindAbandonedAction = guards.action({ permission: 'order.update_status', input: z.object({ id: z.string().uuid() }) }, async ({ input, ctx }) => {
  const row = await analytics.adminRemindAbandoned(input.id, ctx.user!.id);
  return { row };
});
