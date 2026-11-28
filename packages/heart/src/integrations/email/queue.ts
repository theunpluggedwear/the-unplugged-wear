import 'server-only';
import { sql } from 'drizzle-orm';
import { withTransaction } from '../../platform/db/index.ts';
import { getEmailSender } from './adapters.ts';
import type { EmailMessage } from './adapters.ts';

type QueuedRow = {
  id: string;
  recipient: string;
  subject: string | null;
  template: string | null;
  dedupe_key: string | null;
};

const LOCK_ID = 727014;

export async function sendQueuedEmails(limit = 50): Promise<number> {
  const sender = getEmailSender();
  return withTransaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_ID})`);
    const { rows } = await tx.execute<QueuedRow>(sql`
      SELECT id, recipient, subject, template, dedupe_key
      FROM email_logs WHERE status = 'queued'
      ORDER BY created_at, id LIMIT ${limit}`);

    for (const row of rows) {
      const message: EmailMessage = {
        to: row.recipient,
        subject: row.subject ?? '',
        template: row.template ?? 'generic',
        dedupeKey: row.dedupe_key ?? undefined,
      };
      try {
        await sender.deliver({ logId: row.id, message });
        await tx.execute(sql`UPDATE email_logs SET status = 'sent', error = NULL WHERE id = ${row.id}::uuid AND status = 'queued'`);
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Delivery failed';
        await tx.execute(sql`UPDATE email_logs SET status = 'failed', error = ${detail.slice(0, 500)} WHERE id = ${row.id}::uuid AND status = 'queued'`);
      }
    }
    return rows.length;
  });
}
