# 0005 — QA demo product guardrail is code-only and removable

Status: Accepted

## Context

Checkout QA needs one fixed-price product that never collects money and never reaches fulfilment. Adding a database flag or admin UI would create permanent product data and operational surface for a temporary QA concern.

## Decision

The guardrail is code-only, keyed by `QA_DEMO_SKU` in `packages/heart/src/platform/qa-demo-product/`. It changes pricing, payment provider selection and fulfilment submission for that one SKU.

## Consequences

- Removing the module and its guarded call sites removes the behaviour completely.
- No schema migration or env flag is required.
- The product must still exist in the catalogue for checkout QA.
