# 0001 — Two deployments share one Neon database

Status: Accepted

## Context

The storefront and admin are separately deployed Next.js applications. They need consistent customer, order, catalogue and content data without duplicating writes or introducing a third service.

## Decision

Both apps connect to one Neon Postgres database. The schema lives in the repository-root `db/` directory and is owned by neither app. Shared backend code lives in `packages/heart`; UI code is never shared between apps.

## Consequences

- Each app serves its own API through route handlers and server actions.
- Schema changes are made through forward-only migrations in `db/migrate`.
- Role checks are declared at every entry point and repeated in the DAL.
