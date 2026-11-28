import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const read = (relative) => readFileSync(join(root, relative), 'utf8');

test('notification retention keeps a 30-day default and a bounded prune', () => {
  const service = read('packages/heart/src/modules/notifications/service.ts');
  assert.match(service, /NOTIFICATION_RETENTION_DAYS\s*=\s*30/);
  assert.match(service, /DELETE FROM notifications/);
  assert.match(service, /Math\.min\(365, Math\.max\(1, Math\.trunc\(days\)\)\)/);
});

test('the prune job is registered and scheduled', () => {
  const catalog = read('packages/heart/src/platform/jobs/catalog.ts');
  assert.match(catalog, /name: 'notifications\.pruneOld'/);
  assert.match(catalog, /pruneNotifications\(\)/);
  const cron = JSON.parse(read('tuw-admin/vercel.json'));
  assert.ok(cron.crons.some((entry) => entry.path === '/api/cron/platform.runDaily'));
  assert.match(catalog, /'notifications\.pruneOld'/);
});
