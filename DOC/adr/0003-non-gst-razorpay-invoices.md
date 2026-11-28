# 0003 — Razorpay-hosted invoices are non-GST

Status: Accepted

## Context

The payment-invoice layer uses Razorpay Invoice API to host a payment document. Razorpay-hosted invoices do not support GST tax lines, HSN/SAC fields or PDF tax invoices.

## Decision

Payment invoices and GST tax invoices are separate concerns. The invoice provider advertises `taxLines: false` and `pdf: false`. GST invoices require their own document sequence, tax math and PDF path.

## Consequences

- Checkout can use a hosted payment invoice without pretending it is a GST invoice.
- GST work is a separate backlog item with owner inputs and migrations.
- `payment_documents.document_type` reserves GST values but does not implement them.
