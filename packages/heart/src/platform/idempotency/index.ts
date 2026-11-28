import 'server-only';
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { withTransaction } from '../db/index.ts';
import { AppError } from '../errors/index.ts';

// Layer-1 retry guard (DOC/backend/21 §2). claim() decides whether a request
// runs or replays; complete()/fail() record the outcome. Keys are unique per
// (scope, actor_ref, key), so one caller can never replay another's response.

export type Claim =
  | { kind: 'execute'; id: string; ownerToken: string }
  | { kind: 'replay'; status: number; body: unknown };

export interface ClaimInput {
  scope: string;
  actorRef: string; // 'user:<uuid>' | 'guest:<session id>'
  key: string;
  requestHash: string;
  userId?: string | null;
  ttlHours?: number; // 24 for checkout, 168 (7 days) otherwise
  leaseSeconds?: number;
}

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,255}$/;

export function hashRequest(scope: string, payload: unknown): string {
  return createHash('sha256').update(scope).update('\n').update(canonicalJson(payload)).digest('hex');
}

/** JSON with sorted object keys, so equal payloads hash equally. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

function leaseToken(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function claim(input: ClaimInput): Promise<Claim> {
  if (!KEY_PATTERN.test(input.key)) {
    throw new AppError('VALIDATION_FAILED', 'A valid Idempotency-Key is required.', [{ field: 'idempotencyKey', message: 'Missing or malformed key' }]);
  }
  if (!/^[0-9a-f]{64}$/.test(input.requestHash)) throw new TypeError('requestHash must be a sha256 hex digest (use hashRequest)');
  const ttl = input.ttlHours ?? 168;
  const lease = input.leaseSeconds ?? 60;

  return withTransaction(async (tx) => {
    const inserted = await tx.execute<{ id: string; locked_until: unknown }>(sql`
      INSERT INTO idempotency_keys (id, scope, actor_ref, key, user_id, request_hash, status, locked_until, expires_at)
      VALUES (gen_random_uuid(), ${input.scope}, ${input.actorRef}, ${input.key}, ${input.userId ?? null}, ${input.requestHash}, 'in_progress', now() + make_interval(secs => ${lease}), now() + make_interval(hours => ${ttl}))
      ON CONFLICT (scope, actor_ref, key) DO NOTHING
      RETURNING id, locked_until`);
    if (inserted.rows[0]) return { kind: 'execute' as const, id: inserted.rows[0].id, ownerToken: leaseToken(inserted.rows[0].locked_until) };

    const { rows } = await tx.execute<{ id: string; status: string; request_hash: string; response_code: number | null; response_body: unknown; lease_live: boolean; locked_until: unknown }>(sql`
      SELECT id, status, request_hash, response_code, response_body, (locked_until > now()) AS lease_live, locked_until
        FROM idempotency_keys WHERE scope = ${input.scope} AND actor_ref = ${input.actorRef} AND key = ${input.key} FOR UPDATE`);
    const row = rows[0];
    if (!row) throw new AppError('IDEMPOTENCY_CONFLICT', 'Please retry the request.');
    if (row.request_hash !== input.requestHash) {
      throw new AppError('IDEMPOTENCY_KEY_REUSED', 'This request key was already used for a different request.');
    }
    if (row.status === 'completed') return { kind: 'replay' as const, status: row.response_code ?? 200, body: row.response_body };
    if (row.status === 'in_progress' && row.lease_live) {
      throw new AppError('REQUEST_IN_PROGRESS', 'This request is already being processed.');
    }
    const taken = await tx.execute<{ locked_until: unknown }>(sql`
      UPDATE idempotency_keys SET status = 'in_progress', locked_until = now() + make_interval(secs => ${lease})
      WHERE id = ${row.id}::uuid AND (status = 'failed' OR locked_until <= now())
      RETURNING locked_until`);
    if (!taken.rows[0]) throw new AppError('REQUEST_IN_PROGRESS', 'This request is already being processed.');
    return { kind: 'execute' as const, id: row.id, ownerToken: leaseToken(taken.rows[0].locked_until) };
  });
}

export async function complete(id: string, status: number, body: unknown, resource?: { table: string; id: string }, ownerToken?: string): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.execute(sql`
      UPDATE idempotency_keys SET status = 'completed', response_code = ${status}, response_body = ${JSON.stringify(body ?? null)}::jsonb,
              resource_table = ${resource?.table ?? null}, resource_id = ${resource?.id ?? null}, completed_at = now(), locked_until = NULL
        WHERE id = ${id}::uuid AND status = 'in_progress' AND locked_until > now()
          AND (${ownerToken ?? null}::timestamptz IS NULL OR locked_until = ${ownerToken ?? null}::timestamptz)`);
  });
}

/** 5xx / unexpected failures stay retryable; terminal 4xx are stored and replayed. */
export async function fail(id: string, status: number, body: unknown, ownerToken?: string): Promise<void> {
  if (status >= 500) {
    await withTransaction(async (tx) => {
      await tx.execute(sql`
        UPDATE idempotency_keys SET status = 'failed', locked_until = NULL
        WHERE id = ${id}::uuid AND status = 'in_progress' AND locked_until > now()
          AND (${ownerToken ?? null}::timestamptz IS NULL OR locked_until = ${ownerToken ?? null}::timestamptz)`);
    });
  } else {
    await complete(id, status, body, undefined, ownerToken);
  }
}

/** Housekeeping job: drop expired keys. */
export async function sweepExpired(): Promise<number> {
  return withTransaction(async (tx) => {
    const { rowCount } = await tx.execute(sql`
      DELETE FROM idempotency_keys WHERE expires_at < now()
        AND (locked_until IS NULL OR locked_until <= now() OR status IN ('completed','failed'))`);
    return rowCount ?? 0;
  });
}
