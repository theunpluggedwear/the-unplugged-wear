import 'server-only';
import { getPool } from '../../platform/db/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { renderTemplate } from './templates.ts';

export interface EmailMessage {
  to: string;
  subject: string;
  template: string;
  link?: string;
  dedupeKey?: string;
}

export interface EmailDeliveryResult {
  logId: string | null;
  delivered: boolean;
}

export interface QueuedEmail {
  logId: string;
  message: EmailMessage;
}

export interface EmailSender {
  slug: string;
  liveReady(): boolean;
  send(message: EmailMessage): Promise<EmailDeliveryResult>;
  deliver(email: QueuedEmail): Promise<{ providerRef: string | null; delivered: boolean }>;
}

async function enqueue(message: EmailMessage): Promise<EmailDeliveryResult> {
  const id = uuidv7();
  const { rowCount } = await getPool().query(
    `INSERT INTO email_logs (id, recipient, subject, template, status, dedupe_key)
     VALUES ($1, $2, $3, $4, 'queued', $5)
     ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
    [id, message.to, message.subject, message.template, message.dedupeKey ?? null],
  );
  return { logId: rowCount ? id : null, delivered: false };
}

export const outboxSender: EmailSender = {
  slug: 'outbox',
  liveReady: () => false,
  async send(message) {
    return enqueue(message);
  },
  async deliver(email) {
    await getPool().query(
      `UPDATE email_logs SET status = 'sent', error = NULL WHERE id = $1 AND status = 'queued'`,
      [email.logId],
    );
    return { providerRef: `outbox:${email.logId}`, delivered: false };
  },
};

export const resendSender: EmailSender = {
  slug: 'resend',
  liveReady: () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  async send(message) {
    return enqueue(message);
  },
  async deliver(email) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) throw new Error('RESEND_API_KEY and EMAIL_FROM are required.');
    const body = renderTemplate(email.message.template, email.message.link);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email.message.to],
        subject: email.message.subject || body.subject,
        html: body.html,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Resend rejected the email (${response.status}): ${detail.slice(0, 240)}`);
    }
    const result = await response.json() as { id?: string };
    if (!result.id) throw new Error('Resend returned no message id.');
    await getPool().query(`UPDATE email_logs SET status = 'sent', error = NULL WHERE id = $1`, [email.logId]);
    return { providerRef: result.id, delivered: true };
  },
};

export const emailAdapters: readonly EmailSender[] = [outboxSender, resendSender];

export function getEmailSender(slug = (process.env.EMAIL_PROVIDER ?? '').trim()): EmailSender {
  const requested = slug === 'mock_email' ? 'outbox' : slug;
  if (requested) {
    const adapter = emailAdapters.find((a) => a.slug === requested);
    if (!adapter) throw new Error(`No email adapter for "${slug}".`);
    return adapter;
  }
  return emailAdapters.find((a) => a.liveReady()) ?? outboxSender;
}
