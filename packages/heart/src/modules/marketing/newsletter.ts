import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, withTransaction } from '../../platform/db/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import { getEmailSender, showDevLinks } from '../../integrations/email/index.ts';
import { hashSecret, randomSecret } from '../auth/tokens.ts';

export const NEWSLETTER_TAG = 'newsletter';

export interface Subscriber {
  id: string;
  email: string;
  status: string;
  source: string;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
}

export async function listSubscribers(): Promise<Subscriber[]> {
  const { rows } = await getDb().execute<{ id: string; email: string; status: string; source: string; confirmed_at: string | null; unsubscribed_at: string | null }>(sql`
    SELECT id, email, status, source, confirmed_at, unsubscribed_at FROM newsletter_subscribers ORDER BY created_at DESC`);
  return rows.map((r) => ({
    id: r.id, email: r.email, status: r.status, source: r.source,
    confirmedAt: r.confirmed_at ? new Date(r.confirmed_at).toISOString() : null,
    unsubscribedAt: r.unsubscribed_at ? new Date(r.unsubscribed_at).toISOString() : null,
  }));
}

export async function subscribe(rawEmail: string, source: 'footer' | 'checkout' | 'account' | 'admin' | 'import' = 'footer'): Promise<{ ok: true; devLink?: string }> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    throw new AppError('VALIDATION_FAILED', 'Enter a valid email address.');
  }
  const token = randomSecret(24);
  const hash = hashSecret(token);
  return withTransaction(async (tx) => {
    const { rows } = await tx.execute<{ id: string; status: string }>(sql`
      SELECT id, status FROM newsletter_subscribers WHERE lower(email) = ${email}`);
    const existing = rows[0];
    if (existing?.status === 'subscribed') return { ok: true as const };
    const id = existing?.id ?? uuidv7();
    if (existing) {
      await tx.execute(sql`UPDATE newsletter_subscribers SET status='pending', confirm_token_hash=${hash},
        confirmed_at=NULL, unsubscribed_at=NULL, source=${source}, updated_at=now() WHERE id=${id}::uuid`);
    } else {
      await tx.execute(sql`INSERT INTO newsletter_subscribers (id, email, source, status, confirm_token_hash, created_at, updated_at)
        VALUES (${id}::uuid, ${email}, ${source}, 'pending', ${hash}, now(), now())`);
    }
    const sender = getEmailSender();
    await sender.send({
      to: email,
      subject: 'Confirm your The Unplugged Wear newsletter subscription',
      template: 'newsletter.confirm',
      link: `/newsletter/confirm?token=${token}`,
      dedupeKey: `newsletter.confirm:${id}`,
    });
    const devLink = showDevLinks() ? `/newsletter/confirm?token=${token}` : undefined;
    return { ok: true as const, ...(devLink ? { devLink } : {}) };
  });
}

export async function confirm(token: string): Promise<{ ok: true; email: string }> {
  const hash = hashSecret(token);
  return withTransaction(async (tx) => {
    const { rows } = await tx.execute<{ id: string; email: string; status: string }>(sql`
      SELECT id, email, status FROM newsletter_subscribers WHERE confirm_token_hash = ${hash}`);
    const row = rows[0];
    if (!row) throw new AppError('RULE_VIOLATION', 'That confirmation link is invalid or has already been used.');
    if (row.status !== 'subscribed') {
      await tx.execute(sql`UPDATE newsletter_subscribers SET status='subscribed', confirmed_at=now(), unsubscribed_at=NULL, updated_at=now() WHERE id=${row.id}::uuid`);
    }
    return { ok: true as const, email: row.email };
  });
}

export async function unsubscribe(token: string): Promise<{ ok: true; email: string }> {
  const hash = hashSecret(token);
  return withTransaction(async (tx) => {
    const { rows } = await tx.execute<{ id: string; email: string }>(sql`
      SELECT id, email FROM newsletter_subscribers WHERE confirm_token_hash = ${hash}`);
    const row = rows[0];
    if (!row) throw new AppError('RULE_VIOLATION', 'That unsubscribe link is invalid or has already been used.');
    await tx.execute(sql`UPDATE newsletter_subscribers SET status='unsubscribed', unsubscribed_at=now(), confirm_token_hash=NULL, updated_at=now() WHERE id=${row.id}::uuid`);
    return { ok: true as const, email: row.email };
  });
}
