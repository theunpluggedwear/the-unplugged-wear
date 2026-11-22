# 0011 — Admin rendering boundaries

Status: Accepted

## Context

Cache Components validate instant navigations. Auth-gated pages read per-request cookies, and many admin views mix static shells with live data.

## Decision

Protected admin routes opt out of instant validation with `instant = false`. Dashboard cards use Suspense boundaries for streamed live data, and client components stay small around primitives.

## Consequences

- Auth-gated navigation blocks instead of producing Instant errors.
- Static shell and live regions are separated explicitly.
- New protected pages must opt out unless they can prerender without runtime reads.
