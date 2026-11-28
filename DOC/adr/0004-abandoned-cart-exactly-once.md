# 0004 — Abandoned cart reminders are exactly-once

Status: Accepted

## Context

An idle cart may be detected by more than one job run. A shopper must never receive multiple reminders for the same abandonment.

## Decision

`abandoned_carts.cart_id` is unique. `reminded_at` is written only when the row is still in `detected` state, and the email dedupe key is `cart.abandoned:<cart_id>`.

## Consequences

- Detection is idempotent.
- Reminder sending is idempotent.
- Recovery history is retained for one year so conversion math remains possible.
