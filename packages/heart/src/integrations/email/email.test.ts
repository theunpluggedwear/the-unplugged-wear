import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getEmailSender, outboxSender, resendSender } from './adapters.ts';
import { sendQueuedEmails } from './queue.ts';
import { createTestDatabase, hasTestDatabase } from '../../platform/test/index.ts';
import { getDb } from '../../platform/db/index.ts';
import { sql } from 'drizzle-orm';

function withEnv<T>(values: Record<string, string | undefined>, run: () => T): T {
  const saved = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    saved.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return run();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('the transport follows configuration, with real keys taking over automatically', () => {
  withEnv({ EMAIL_PROVIDER: undefined, RESEND_API_KEY: undefined, EMAIL_FROM: undefined }, () => {
    assert.equal(getEmailSender().slug, 'outbox');
    assert.equal(getEmailSender().liveReady(), false);
  });
  withEnv({ EMAIL_PROVIDER: undefined, RESEND_API_KEY: 're_test', EMAIL_FROM: 'shop@example.com' }, () => {
    assert.equal(getEmailSender().slug, 'resend');
    assert.equal(resendSender.liveReady(), true);
  });
  withEnv({ EMAIL_PROVIDER: 'outbox', RESEND_API_KEY: 're_test', EMAIL_FROM: 'shop@example.com' }, () => {
    assert.equal(getEmailSender().slug, 'outbox');
  });
  withEnv({ EMAIL_PROVIDER: 'mock_email', RESEND_API_KEY: undefined, EMAIL_FROM: undefined }, () => {
    assert.equal(getEmailSender().slug, 'outbox');
  });
  assert.equal(outboxSender.slug, 'outbox');
});

test('templates render the link as escaped HTML', async () => {
  const { renderTemplate } = await import('./templates.ts');
  const rendered = renderTemplate('auth.reset', 'https://example.com/reset?a=1&b=2');
  assert.match(rendered.subject, /Reset/);
  assert.match(rendered.html, /a=1&amp;b=2/);
});

test('queued emails are drained once and dedupe keys stay unique', { skip: !hasTestDatabase() && 'no database' }, async () => {
  const dbTest = await createTestDatabase();
  try {
    const first = await outboxSender.send({
      to: 'qa@example.com', subject: 'Confirm your email', template: 'auth.verify',
      dedupeKey: 'auth.verify:qa-1',
    });
    const second = await outboxSender.send({
      to: 'qa@example.com', subject: 'Confirm your email', template: 'auth.verify',
      dedupeKey: 'auth.verify:qa-1',
    });
    assert.ok(first.logId);
    assert.equal(second.logId, null);

    const before = await getDb().execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM email_logs WHERE status = 'queued'`);
    assert.equal(before.rows[0]?.n, 1);

    const processed = await sendQueuedEmails();
    assert.equal(processed, 1);

    const after = await getDb().execute<{ status: string; delivered_error: string | null }>(
      sql`SELECT status, error AS delivered_error FROM email_logs WHERE id = ${first.logId!}::uuid`,
    );
    assert.equal(after.rows[0]?.status, 'sent');
  } finally {
    await dbTest.drop();
  }
});
