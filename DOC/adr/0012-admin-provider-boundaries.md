# 0012 — Admin provider boundaries

Status: Accepted

## Context

Payments, invoices, fulfilment, storage and email are external concerns with different credentials and readiness gates.

## Decision

Admin screens read provider-neutral heart modules and guarded actions. Provider selection lives in registries; mock or sandbox adapters are explicit until live credentials exist.

## Consequences

- Swapping a provider does not rewrite admin screens.
- Demo or sandbox state is reported honestly.
- Live readiness is checked by the adapter, not by admin UI labels.
