import { test } from 'node:test';
import assert from 'node:assert/strict';

export function explore(initial, rules, invariant, limit = 20000) {
  const key = (s) => JSON.stringify(s);
  const queue = [[initial, []]];
  const seen = new Set([key(initial)]);
  let explored = 0;
  while (queue.length && explored++ < limit) {
    const [state, path] = queue.shift();
    if (!invariant(state)) return { ok: false, state, trace: path, explored };
    for (const rule of rules) {
      for (const next of rule.next(state)) {
        const k = key(next);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push([next, path.concat(rule.name)]);
      }
    }
  }
  return { ok: true, explored, exhaustive: queue.length === 0 };
}

test('explorer finds a counterexample trace', () => {
  const rules = [
    { name: 'SCHEDULE', next: (s) => (s.phase === 'hidden' ? [{ phase: 'scheduled', timer: true }] : []) },
    { name: 'POINTER_LEAVE', next: (s) => (s.phase === 'scheduled' ? [{ ...s, left: true }] : []) },
    { name: 'TIMER_FIRE', next: (s) => (s.phase === 'scheduled' ? [{ phase: 'visible', reason: 'hover', left: !!s.left }] : []) },
  ];
  const result = explore({ phase: 'hidden' }, rules, (s) => !(s.left && s.phase === 'visible'));
  assert.equal(result.ok, false);
  assert.deepEqual(result.trace, ['SCHEDULE', 'POINTER_LEAVE', 'TIMER_FIRE']);
});

test('explorer proves a property when no violating state is reachable', () => {
  const rules = [
    { name: 'OPEN', next: (s) => (s === 'closed' ? ['open'] : []) },
    { name: 'CLOSE', next: (s) => (s === 'open' ? ['closed'] : []) },
  ];
  const result = explore('closed', rules, (s) => s === 'closed' || s === 'open');
  assert.equal(result.ok, true);
  assert.equal(result.exhaustive, true);
});
