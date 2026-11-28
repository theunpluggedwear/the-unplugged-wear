# Architecture Decision Records

This directory holds permanent records for non-obvious architectural decisions.

Source code must not carry decision comments. Decision comments are moved here by the `/delete-comment` skill and removed from source.

## Index

- [0001 — Two deployments share one Neon database](./0001-two-deployments-one-db.md)
- [0002 — Decimal rupees in DB, paise at API boundaries](./0002-decimal-money.md)
- [0003 — Razorpay-hosted invoices are non-GST](./0003-non-gst-razorpay-invoices.md)
- [0004 — Abandoned cart reminders are exactly-once](./0004-abandoned-cart-exactly-once.md)
- [0005 — QA demo product guardrail is code-only and removable](./0005-qa-demo-product-guardrail.md)
- [0006 — Fixed dashboard slot pool](./0006-dashboard-slot-pool.md)
- [0007 — Dashboard bar normalization](./0007-dashboard-bar-normalization.md)
- [0008 — Dashboard status pill sizing](./0008-dashboard-status-pill-sizing.md)
- [0009 — Admin auth and permission boundaries](./0009-admin-auth-and-permissions.md)
- [0010 — Admin money and status invariants](./0010-admin-money-and-status-invariant.md)
- [0011 — Admin rendering boundaries](./0011-admin-rendering-boundaries.md)
- [0012 — Admin provider boundaries](./0012-admin-provider-boundaries.md)
- [0013 — Admin component and token discipline](./0013-admin-component-and-token-discipline.md)
