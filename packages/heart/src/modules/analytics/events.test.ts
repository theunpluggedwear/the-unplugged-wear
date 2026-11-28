import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { recordAnalyticsEvents } from './events.ts';
import { maintainAnalyticsPartitions } from './partitions.ts';
import { createTestDatabase, hasTestDatabase } from '../../platform/test/index.ts';
import { getDb } from '../../platform/db/index.ts';

const actor = { sessionId: 'qa-analytics-session', userId: null };

test('analytics events are recorded once and partitions can be maintained', { skip: !hasTestDatabase() && 'no database' }, async () => {
  const dbTest = await createTestDatabase();
  try {
    const batch = {
      pageViews: [{ id: '01900000-0000-7000-8000-000000000001', page: '/products' }],
      searches: [{ id: '01900000-0000-7000-8000-000000000002', term: 'hoodie', hits: 3 }],
    };
    const first = await recordAnalyticsEvents(actor, batch);
    assert.equal(first.pageViews, 1);
    assert.equal(first.searches, 1);

    const second = await recordAnalyticsEvents(actor, batch);
    assert.equal(second.pageViews, 0);
    assert.equal(second.searches, 0);

    const views = await getDb().execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM page_views WHERE session_id = ${actor.sessionId}`);
    assert.equal(views.rows[0]?.n, 1);

    const session = await getDb().execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM analytics_sessions WHERE session_id = ${actor.sessionId}`);
    assert.equal(session.rows[0]?.n, 1);

    const result = await maintainAnalyticsPartitions(new Date('2026-11-15T00:00:00Z'));
    assert.equal(result.created.length, 4);
    assert.ok(result.created.includes('page_views_2026_11'));

    const again = await maintainAnalyticsPartitions(new Date('2026-11-15T00:00:00Z'));
    assert.equal(again.created.length, 4);
  } finally {
    await dbTest.drop();
  }
});
