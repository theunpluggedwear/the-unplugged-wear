import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { createTestDatabase, hasTestDatabase } from '../test/index.ts';
import { getDb } from '../db/index.ts';
import { claim, complete, hashRequest, sweepExpired } from './index.ts';

const skip = !hasTestDatabase() && 'no database';
let drop: (() => Promise<void>) | undefined;

before(async () => {
  if (skip) return;
  drop = (await createTestDatabase()).drop;
}, { timeout: 180_000 });
after(async () => { await drop?.(); });

const base = (key: string, over: Record<string, unknown> = {}) => ({
  scope: 'checkout',
  actorRef: 'user:idem-concurrency',
  key,
  requestHash: hashRequest('checkout', { key }),
  leaseSeconds: 60,
  ttlHours: 168,
  ...over,
});

const code = async (p: Promise<unknown>) => {
  try { await p; return 'ok'; } catch (error) { return (error as { code?: string }).code ?? String(error); }
};

const keysOf = async (keys: string[]) => {
  const { rows } = await getDb().execute<{ key: string }>(sql`SELECT key FROM idempotency_keys WHERE key IN (${sql.join(keys.map((k) => sql`${k}`), sql`, `)})`);
  return rows.map((r) => r.key);
};

test('concurrent claims of one key elect exactly one owner', { skip }, async () => {
  const input = base('claim-race-00000001');
  const results = await Promise.allSettled([claim(input), claim(input), claim(input)]);
  const executed = results.flatMap((r) => r.status === 'fulfilled' && r.value.kind === 'execute' ? [r.value] : []);
  assert.equal(executed.length, 1);
  assert.equal(results.filter((r) => r.status === 'fulfilled' && r.value.kind === 'replay').length, 0);
  assert.equal(results.filter((r) => r.status === 'rejected').length, 2);
  assert.equal(await code(claim(input)), 'REQUEST_IN_PROGRESS');
  const owner = executed[0]!;
  if (owner.kind !== 'execute') return;
  await complete(owner.id, 200, { ok: true }, undefined, owner.ownerToken);
  assert.deepEqual(await claim(input), { kind: 'replay', status: 200, body: { ok: true } });
});

test('takeover after an expired lease rejects a late complete', { skip }, async () => {
  const input = base('takeover-0000000001', { leaseSeconds: 1 });
  const first = await claim(input);
  assert.equal(first.kind, 'execute');
  if (first.kind !== 'execute') return;
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const second = await claim({ ...input, leaseSeconds: 60 });
  assert.equal(second.kind, 'execute');
  if (second.kind !== 'execute') return;
  await complete(first.id, 200, { stale: true }, undefined, first.ownerToken);
  await complete(second.id, 200, { fresh: true }, undefined, second.ownerToken);
  const replay = await claim(base('takeover-0000000001'));
  assert.deepEqual(replay, { kind: 'replay', status: 200, body: { fresh: true } });
  const { rows } = await getDb().execute<{ body: unknown }>(sql`SELECT response_body AS body FROM idempotency_keys WHERE key = ${input.key}`);
  assert.deepEqual(rows[0]!.body, { fresh: true });
});

test('sweepExpired keeps live in-flight keys and drops settled or stale keys', { skip }, async () => {
  const liveKey = 'sweep-live-0000001';
  const settledKey = 'sweep-settled-00001';
  const live = await claim(base(liveKey, { ttlHours: 0 }));
  assert.equal(live.kind, 'execute');
  const settled = await claim(base(settledKey, { ttlHours: 0 }));
  if (settled.kind === 'execute') await complete(settled.id, 200, { done: true }, undefined, settled.ownerToken);
  assert.ok(await sweepExpired() >= 1);
  assert.deepEqual(await keysOf([liveKey, settledKey]), [liveKey]);
  await getDb().execute(sql`UPDATE idempotency_keys SET locked_until = now() - interval '1 second' WHERE key = ${liveKey}`);
  assert.ok(await sweepExpired() >= 1);
  assert.deepEqual(await keysOf([liveKey, settledKey]), []);
});
