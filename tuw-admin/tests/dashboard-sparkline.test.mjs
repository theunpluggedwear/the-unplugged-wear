import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSparkPath } from '../src/lib/dashboard.ts';

const UP = 'M 0 26 C 12 26, 18 10, 28 16 C 38 22, 44 26, 52 14 C 60 4, 68 8, 76 2 C 82 -2, 86 4, 90 2';
const DOWN = 'M 0 10 C 12 10, 16 2, 24 4 C 32 6, 38 18, 48 14 C 58 10, 64 22, 74 18 C 80 15, 84 22, 90 20';

test('sparkline keeps the original decorative path when there is no real series', () => {
  assert.equal(buildSparkPath([], 'up'), UP);
  assert.equal(buildSparkPath([42], 'down'), DOWN);
  assert.equal(buildSparkPath([5, 5, 5], 'up'), UP);
  assert.equal(buildSparkPath([1, Number.NaN, 2], 'down'), DOWN);
});

test('sparkline path is generated from real values inside the unchanged 90x40 box', () => {
  const path = buildSparkPath([100, 140, 120, 200, 180, 260, 300], 'up');
  assert.match(path, /^M 0 /);
  assert.match(path, /, 90 [\d.]+$/);
  assert.match(path, / C /);
  assert.ok(!path.includes('NaN'));
  const segments = path.split(' C ');
  const first = segments[0].match(/^M ([\d.]+) ([\d.]+)$/).slice(1).map(Number);
  const anchors = [first, ...segments.slice(1).map((s) => s.split(', ').pop().split(' ').map(Number))];
  assert.equal(anchors.length, 7);
  assert.ok(anchors.every(([x, y]) => x >= 0 && x <= 90 && y >= 2 && y <= 34));
});

test('different real series produce different paths', () => {
  const rising = buildSparkPath([1, 2, 3, 4, 5, 6, 7], 'up');
  const falling = buildSparkPath([7, 6, 5, 4, 3, 2, 1], 'down');
  assert.notEqual(rising, falling);
  assert.notEqual(rising, UP);
  assert.notEqual(falling, DOWN);
});
