# 0002 — Decimal rupees in DB, paise at API boundaries

Status: Accepted

## Context

Floating-point arithmetic cannot represent currency reliably. The UI also needs stable two-decimal rupee display.

## Decision

The database stores money as `DECIMAL(12,2)` rupees. Application code may calculate in integer paise to avoid float error and converts at the API boundary.

## Consequences

- No floats are used for money calculations.
- `priceINR: 3899` maps to `priceMinorINR: 389900`.
- Display code formats from rupee columns or converts paise once.
