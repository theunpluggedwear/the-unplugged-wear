# 0010 — Admin money and status invariants

Status: Accepted

## Context

Orders have independent payment, fulfilment and return axes. Money is stored as decimal rupees and calculated in integer paise at API boundaries.

## Decision

Admin mutations preserve the DB status vocabulary and never conflate payment status with fulfilment status. Refunds, discounts and totals are derived from persisted rows, never from localStorage fixtures.

## Consequences

- Order history remains auditable.
- Partial refunds cannot exceed captured amounts.
- Status labels map to SQL values, not legacy UI words.
