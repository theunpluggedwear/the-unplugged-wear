import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb } from '../../platform/db/index.ts';

export interface EventActor {
  sessionId: string;
  userId: string | null;
}

export interface PageViewEvent {
  id: string;
  page: string;
  referrer?: string | null;
  eventKind?: 'pageview' | 'heartbeat';
  durationMs?: number | null;
  exited?: boolean;
}

export interface ProductViewEvent {
  id: string;
  productId: string;
}

export interface CartEventInput {
  id: string;
  cartId: string;
  eventType: 'item_added' | 'item_removed' | 'qty_changed' | 'cart_viewed';
  payload?: Record<string, unknown>;
}

export interface SearchEventInput {
  id: string;
  term: string;
  hits: number;
  resultsClicked?: number;
}

export interface AnalyticsEventBatch {
  pageViews?: PageViewEvent[];
  productViews?: ProductViewEvent[];
  cartEvents?: CartEventInput[];
  searches?: SearchEventInput[];
}

export interface EventWriteResult {
  pageViews: number;
  productViews: number;
  cartEvents: number;
  searches: number;
}

function tsFor(id: string): string {
  const hex = id.replace(/-/g, '').slice(0, 12);
  if (/^[0-9a-f]{12}$/i.test(hex)) {
    const ms = Number.parseInt(hex, 16);
    if (Number.isFinite(ms) && ms > 0) return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}

function stamped<T extends { id: string }>(rows: T[]): Array<T & { ts: string }> {
  return rows.map((row) => ({ ...row, ts: tsFor(row.id) }));
}

export async function recordAnalyticsEvents(actor: EventActor, batch: AnalyticsEventBatch): Promise<EventWriteResult> {
  const db = getDb();
  const pages = batch.pageViews ?? [];
  const products = batch.productViews ?? [];
  const carts = batch.cartEvents ?? [];
  const searches = batch.searches ?? [];

  await db.execute(sql`
    INSERT INTO analytics_sessions (id, session_id, user_id, started_at, last_seen_at)
    VALUES (gen_random_uuid(), ${actor.sessionId}, ${actor.userId}::uuid, now(), now())
    ON CONFLICT (session_id) DO UPDATE SET
      last_seen_at = now(),
      user_id = COALESCE(EXCLUDED.user_id, analytics_sessions.user_id)`);

  let recordedPages = 0;
  if (pages.length) {
    const result = await db.execute<{ n: number }>(sql`
      WITH written AS (
        INSERT INTO page_views (id, session_id, user_id, page, referrer, event_kind, duration_ms, exited, ts)
        SELECT x.id::uuid, ${actor.sessionId}, ${actor.userId}::uuid, x.page, x.referrer,
          COALESCE(x.kind, 'pageview'), x.duration, COALESCE(x.exited, false), x.ts::timestamptz
        FROM jsonb_to_recordset(${JSON.stringify(stamped(pages))}::jsonb)
          AS x(id text, page text, referrer text, kind text, duration int, exited bool, ts text)
        ON CONFLICT (id, ts) DO NOTHING RETURNING id)
      SELECT count(*)::int AS n FROM written`);
    recordedPages = result.rows[0]?.n ?? 0;
  }

  let recordedProducts = 0;
  if (products.length) {
    const result = await db.execute<{ n: number }>(sql`
      WITH written AS (
        INSERT INTO product_views (id, product_id, session_id, user_id, ts)
        SELECT x.id::uuid, x.product_id::uuid, ${actor.sessionId}, ${actor.userId}::uuid, x.ts::timestamptz
        FROM jsonb_to_recordset(${JSON.stringify(stamped(products))}::jsonb) AS x(id text, product_id text, ts text)
        ON CONFLICT (id, ts) DO NOTHING RETURNING id)
      SELECT count(*)::int AS n FROM written`);
    recordedProducts = result.rows[0]?.n ?? 0;
  }

  let recordedCarts = 0;
  if (carts.length) {
    const result = await db.execute<{ n: number }>(sql`
      WITH written AS (
        INSERT INTO cart_events (id, cart_id, user_id, event_type, payload, ts)
        SELECT x.id::uuid, x.cart_id::uuid, ${actor.userId}::uuid, x.event_type, x.payload::jsonb, x.ts::timestamptz
        FROM jsonb_to_recordset(${JSON.stringify(stamped(carts))}::jsonb)
          AS x(id text, cart_id text, event_type text, payload jsonb, ts text)
        ON CONFLICT (id, ts) DO NOTHING RETURNING id)
      SELECT count(*)::int AS n FROM written`);
    recordedCarts = result.rows[0]?.n ?? 0;
  }

  let recordedSearches = 0;
  if (searches.length) {
    const result = await db.execute<{ n: number }>(sql`
      WITH written AS (
        INSERT INTO search_terms (id, term, hits, results_clicked, session_id, ts)
        SELECT x.id::uuid, x.term, x.hits, COALESCE(x.clicked, 0), ${actor.sessionId}, x.ts::timestamptz
        FROM jsonb_to_recordset(${JSON.stringify(stamped(searches))}::jsonb)
          AS x(id text, term text, hits int, clicked int, ts text)
        ON CONFLICT (id, ts) DO NOTHING RETURNING id)
      SELECT count(*)::int AS n FROM written`);
    recordedSearches = result.rows[0]?.n ?? 0;
  }

  return {
    pageViews: recordedPages,
    productViews: recordedProducts,
    cartEvents: recordedCarts,
    searches: recordedSearches,
  };
}
