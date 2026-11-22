# Architecture Decision Records

This directory holds permanent records for non-obvious architectural decisions.

Source code must not carry decision comments. Decision comments are moved here by the `/delete-comment` skill and removed from source.

## Index

- [0001 — Two deployments share one Neon database](./0001-two-deployments-one-db.md)
- [0002 — Decimal rupees in DB, paise at API boundaries](./0002-decimal-money.md)
- [0003 — Razorpay-hosted invoices are non-GST](./0003-non-gst-razorpay-invoices.md)
- [0004 — Abandoned cart reminders are exactly-once](./0004-abandoned-cart-exactly-once.md)
- [0005 — QA demo product guardrail is code-only and removable](./0005-qa-demo-product-guardrail.md)
