import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '../../platform/db/index.ts';
import { processWebhookEvent } from './webhooks.ts';
import { getWebhookProvider, type NormalizedWebhookEvent } from '../../integrations/webhooks/index.ts';

/** Retry failed webhook deliveries that are due. Safe to run repeatedly. */
export async function retryFailedWebhooks(limit = 20): Promise<{ processed: number; failed: number }> {
  const db = getDb();
  const { rows } = await db.execute<{ id: string; provider: string; payload: NormalizedWebhookEvent & { event?: string }; attempts: number }>(sql`
    SELECT id, provider, payload, attempts FROM webhook_events
    WHERE status='failed' AND next_attempt_at <= now() AND attempts < 8
    ORDER BY next_attempt_at LIMIT ${limit} FOR UPDATE SKIP LOCKED`);
  let processed = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      // Old rows stored the raw provider envelope; newer rows store the
      // normalized event. Both must be retryable.
      const event = row.payload?.kind
        ? row.payload
        : getWebhookProvider(row.provider)?.normalize(JSON.stringify(row.payload), new Headers());
      if (!event) throw new Error('Stored webhook payload cannot be normalized.');
      await processWebhookEvent(event);
      await db.execute(sql`UPDATE webhook_events SET status='processed', processed_at=now(), error=NULL WHERE id=${row.id}::uuid`);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.execute(sql`UPDATE webhook_events SET attempts=attempts+1, error=${message.slice(0, 2000)}, next_attempt_at=now() + make_interval(mins => 5) WHERE id=${row.id}::uuid`);
      failed += 1;
    }
  }
  return { processed, failed };
}
