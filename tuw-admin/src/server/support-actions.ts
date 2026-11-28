'use server';

import { z } from 'zod';
import * as support from '@tuw/heart/modules/support';
import { guards } from './session';

const status = z.enum(['open', 'pending', 'resolved']);

export const listTicketsAction = guards.action({ permission: 'customer.view', input: z.object({ status: status.optional() }) }, ({ input, ctx }) =>
  support.adminListTickets(input.status, ctx.user!.id));

export const replyTicketAction = guards.action({ permission: 'customer.update_status', input: z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(5000) }) }, async ({ input, ctx }) => {
  await support.adminReplyTicket(input.id, input.body, ctx.user!.id);
  return { ok: true };
});

export const setTicketStatusAction = guards.action({ permission: 'customer.update_status', input: z.object({ id: z.string().uuid(), status }) }, async ({ input, ctx }) => {
  await support.adminSetTicketStatus(input.id, input.status, ctx.user!.id);
  return { ok: true };
});
