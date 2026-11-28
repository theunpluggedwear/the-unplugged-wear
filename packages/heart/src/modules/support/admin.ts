import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '../../platform/db/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import * as svc from './service.ts';

async function requirePermission(actorId: string, permission: string): Promise<void> {
  const { rows } = await getDb().execute<{ ok: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = ${actorId}::uuid AND p.slug = ${permission}
    ) AS ok`);
  if (rows[0]?.ok !== true) throw new AppError('FORBIDDEN', `${permission} is required.`);
}

export async function adminListTickets(status: svc.SupportTicketRow['status'] | undefined, actorId: string) {
  await requirePermission(actorId, 'customer.view');
  return svc.listTickets(status);
}

export async function adminReplyTicket(ticketId: string, body: string, actorId: string) {
  await requirePermission(actorId, 'customer.update_status');
  return svc.replyToTicket(ticketId, body, actorId);
}

export async function adminSetTicketStatus(ticketId: string, status: svc.SupportTicketRow['status'], actorId: string) {
  await requirePermission(actorId, 'customer.update_status');
  return svc.setTicketStatus(ticketId, status, actorId);
}
