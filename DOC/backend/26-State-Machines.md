# State machines — canonical relations and guards

Status: Active | Added 2026-11-27

## Source of truth

`packages/heart/src/platform/status/index.ts` owns the canonical state sets and transition relations:
`ORDER_TRANSITIONS` / `canTransitionOrder`, `ORDER_PAYMENT_TRANSITIONS` / `canTransitionOrderPayment`,
`RETURN_TRANSITIONS`, `REFUND_TRANSITIONS` / `canTransitionRefund`, `FULFILLMENT_STATUSES`,
`ORDER_STATUSES`. Modules and UIs must import these instead of declaring their own copies.
The old rank-based order relation was removed: rank comparison allowed 20 transitions that the
canonical relation forbids, including `delivered → cancelled`.

Migration `037-state-transitions.sql` mirrors the relations in the `state_transitions` table and
installs BEFORE UPDATE triggers on `orders.status`, `orders.payment_status`, `refunds.status` and
`returns.status`. A transition that application code forgets to guard is rejected by Postgres.
History tables now CHECK that `from_status`/`to_status` are valid enum values.

## Model checking

`tuw-admin/tests/state-machine-explorer.test.mjs` exports `explore(initial, rules, invariant)`,
an explicit-state breadth-first checker that returns a counterexample trace. Property tests use it
to prove reachability/liveness for UI machines (nav menu, personalisation, tooltip) and to keep the
canonical relations terminal-state safe. Run with `pnpm run test:admin`.

TLC/TLA+ is not installed locally. The TLA+ specs used during the audit are recorded in the
repository history; the equivalent executable properties live in the Node tests above.

## Rules for new state

1. Add the state set and allowed transitions to `platform/status/index.ts` first.
2. Add the pairs to `state_transitions` via a new append-only migration and a trigger.
3. Write `canTransition*` tests for terminal states and forbidden regressions.
4. Use one transaction for any `FOR UPDATE SKIP LOCKED` claim; the lock must live until commit.
5. Every async flag needs `try/finally` and a request id so a late reply cannot clear a newer run.
6. Every reducer event must be reachable from a real UI host; dead events are removed or wired.

## Known eventual-consistency windows

- Vercel Hobby permits 2 cron jobs/day. `platform.runDaily` (01:30) and `platform.runUrgent`
  (13:30) aggregate the 14 individual jobs into two invocations; individual jobs remain directly
  callable for manual catch-up. Worst-case delay for a non-urgent job is still ~24 h.
- Cross-app cache revalidation failure leaves storefront caches stale for up to one hour.
- Access tokens remain valid up to 15 minutes after revocation (stateless access token, revocation
  enforced on refresh or page reload).
