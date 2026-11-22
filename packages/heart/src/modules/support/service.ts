import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, withTransaction } from '../../platform/db/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { AppError } from '../../platform/errors/index.ts';

export interface SupportTicketRow {
  id: string;
  subject: string;
  customerName: string;
  customerEmail: string | null;
  status: 'open' | 'pending' | 'resolved';
  priority: 'high' | 'medium' | 'low';
  source: 'contact_form' | 'account' | 'order' | 'admin';
  updatedAt: string;
  messages: Array<{ id: string; sender: 'customer' | 'staff'; body: string; createdAt: string }>;
}

export async function listTickets(status?: SupportTicketRow['status']): Promise<SupportTicketRow[]> {
  const db = getDb();
  const { rows } = await db.execute<{
    id: string; subject: string; customer_name: string | null; customer_email: string | null;
    status: SupportTicketRow['status']; priority: SupportTicketRow['priority'];
    source: SupportTicketRow['source']; updated_at: Date;
  }>(sql`
    SELECT t.id, t.subject,
      COALESCE(p.first_name || ' ' || p.last_name, t.guest_name, 'Customer') AS customer_name,
      COALESCE(u.email, t.guest_email) AS customer_email,
      t.status, t.priority, t.source, t.updated_at
    FROM support_tickets t
    LEFT JOIN profiles p ON p.user_id = t.user_id
    LEFT JOIN users u ON u.id = t.user_id
    ${status ? sql`WHERE t.status = ${status}` : sql``}
    ORDER BY t.updated_at DESC`);
  const tickets = await Promise.all(rows.map(async (r) => {
    const messages = await db.execute<{ id: string; sender: 'customer' | 'staff'; body: string; created_at: Date }>(sql`
      SELECT id, sender, body, created_at FROM support_messages WHERE ticket_id = ${r.id}::uuid ORDER BY created_at`);
    return {
      id: r.id, subject: r.subject, customerName: r.customer_name ?? 'Customer',
      customerEmail: r.customer_email, status: r.status, priority: r.priority, source: r.source,
      updatedAt: new Date(r.updated_at).toISOString(),
      messages: messages.rows.map((m) => ({ id: m.id, sender: m.sender, body: m.body, createdAt: new Date(m.created_at).toISOString() })),
    };
  }));
  return tickets;
}

export async function replyToTicket(ticketId: string, body: string, actorId: string): Promise<void> {
  if (!body.trim()) throw new AppError('VALIDATION_FAILED', 'Reply cannot be empty.');
  await withTransaction(async (tx) => {
    const { rowCount } = await tx.execute(sql`
      UPDATE support_tickets SET status = 'pending', updated_at = now() WHERE id = ${ticketId}::uuid`);
    if (!rowCount) throw new AppError('NOT_FOUND', 'Support ticket not found.');
    await tx.execute(sql`
      INSERT INTO support_messages (id, ticket_id, sender, staff_id, body)
      VALUES (${uuidv7()}::uuid, ${ticketId}::uuid, 'staff', ${actorId}::uuid, ${body.trim()})`);
  });
}

export async function setTicketStatus(ticketId: string, status: SupportTicketRow['status'], actorId: string): Promise<void> {
  await withTransaction(async (tx) => {
    const { rowCount } = await tx.execute(sql`
      UPDATE support_tickets SET status = ${status}, updated_at = now() WHERE id = ${ticketId}::uuid`);
    if (!rowCount) throw new AppError('NOT_FOUND', 'Support ticket not found.');
    await tx.execute(sql`
      INSERT INTO support_messages (id, ticket_id, sender, staff_id, body)
      VALUES (${uuidv7()}::uuid, ${ticketId}::uuid, 'staff', ${actorId}::uuid, ${`Status changed to ${status}.`})`);
  });
}
