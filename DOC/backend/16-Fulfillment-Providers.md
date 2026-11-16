# Fulfilment & Integration Providers — Registry, Adapters, Qikink

> Status: Draft | Last Updated: 2026-11-10
> DDL: `db/migrate/009-fulfillment.sql` (7 tables). We hold no warehouse:
> fulfilment status **mirrors provider state**. Qikink is the first
> provider, not the shape of the schema.
> Sources: Qikink help centre (qikink.com/help, read 2026-11-10) and the
> Qikink API 08-23 Postman docs. Points not confirmed by a sandbox call are
> marked **unverified**.

## 1. Plug-and-play rule

Every external service — payment gateway, print-on-demand partner,
courier, email/SMS sender — is:

1. one row in `integration_providers` (slug, category, sandbox/live,
   `is_active`, `capabilities`, non-secret `settings`), and
2. one adapter module in the app that uses it, implementing that
   category's interface.

Adding Printrove, Shiprocket or Stripe later = insert a row, write an
adapter, set env secrets. **No schema change, no edits to other modules.**
`products.partner_provider`, `payments.provider` and
`webhook_events.provider` are FKs to `integration_providers.slug`.

Secrets (`QIKINK_CLIENT_ID`, `QIKINK_CLIENT_SECRET`, Razorpay keys) live in
env only — never in `settings`, never in the database.

### Fulfilment adapter interface (admin API owns it)

```ts
interface FulfillmentProvider {
  slug: string;                                    // 'qikink'
  createOrder(input: FulfillmentOrderInput): Promise<ProviderOrderRef>;
  getOrder(ref: ProviderOrderRef): Promise<ProviderOrderState>; // poll
  cancelOrder(ref: ProviderOrderRef): Promise<void>;
  mapStatus(raw: string): FulfillmentStatus;        // raw → normalized
  parseWebhook?(req: Request): Promise<ProviderEvent>; // when supported
}
```

The services call `registry.get(slug)` and never import an adapter
directly, so swapping or adding providers never touches order code.

## 2. Tables (detail in `02-Data-Tables.md`)

| Table | Role |
|---|---|
| `integration_providers` | Registry + capabilities (`cod`, `cancelUntil`, `webhooks`, `tracking: poll`, `claimWindowDays: 7`, `rtoStorageDays: 100`, `wallet`) |
| `provider_product_mappings` | Our variant → provider SKU + payload (Qikink: print type id, design code, placement SKU, design link, mockup link) + unit cost |
| `fulfillment_orders` | One per order per provider send: our `external_ref` (sent as Qikink `order_number`), provider order id, normalized `status`, raw `provider_status`, prepaid/COD, COD amount, provider cost, courier, AWB, RTO storage deadline, sync state |
| `fulfillment_order_items` | Order lines inside each provider order (snapshot of SKU + payload sent) |
| `provider_wallet_ledger` | Prepaid wallet trail: recharge, order debit, cancel credit, claim credit, COD-to-wallet, withdrawal |
| `provider_cod_remittances` | COD collected by the provider and paid back to us (transfer id, amount, fees, wallet or bank) |
| `fulfillment_claims` | Defect / damage / wrong item / lost parcel claims with deadline, evidence media, ticket ref, outcome |

## 3. Order flow (POD)

1. Customer pays (prepaid) or chooses COD → `orders` row.
2. Admin API worker builds a `fulfillment_orders` row per provider from
   `provider_product_mappings` and calls `createOrder`. Gift-card lines
   (`products.product_kind = 'gift_card'`) are never sent.
3. Provider debits its wallet → `provider_wallet_ledger` `order_debit`.
   Insufficient credits → Qikink puts the order **On Hold**; we show
   `status = 'on_hold'` and alert staff (`notifications`, kind `payment`).
4. Poll worker (`idx_fulfillment_orders_sync`, stalest first) calls
   `getOrder`, stores raw `provider_status`, maps to `status`, writes AWB /
   courier, creates or updates `shipments` (+ `shipment_events`) and moves
   `orders.status`.
5. COD: courier collects → provider remits to us (Qikink: wallet or bank,
   a few working days after delivery) → `provider_cod_remittances` row, and
   each covered `fulfillment_orders.cod_remittance_id` is set.

## 4. Qikink facts that shape the product (help centre, 2026-11-10)

| Topic | Qikink rule | What we do |
|---|---|---|
| Money-back returns / size exchanges | Not offered — the seller places a new order at their own cost | **No money-back returns.** Exchanges = new replacement order paid by us; customer pays any price difference (file 06) |
| Defects, misprints, damage, wrong / missing items | **Confirmed by Qikink support (2026-11-10):** an **unboxing video is mandatory** for *wrong product delivered* and *missing product/item* claims; for other quality issues (damage, misprint, quality) Qikink reviews the details + supporting images and guides case by case. Claim within 7 days of delivery | `returns.type = 'replacement'` + `fulfillment_claims`. Reasons `wrong_item` / `missing_item` need the video (`fulfillment_claims.has_unboxing_video`, DB CHECK from `015-claim-evidence.sql`); damage / misprint / quality need photos. Storefront tells customers to record an unboxing video on every parcel (order email + delivery page). `products.exchange_policy` defaults to `defects_only` |
| Lost in transit | Refunded once marked lost | Claim type `lost_in_transit` → `claim_credit` in the wallet ledger |
| RTO (undelivered) | Returns to Qikink's Coimbatore warehouse; stored **100 days**; can be re-shipped from the dashboard; no RTO charge (pricing page lists ₹20/product storage — conflicting) | `status = 'rto_initiated' / 'returned'`, `rto_storage_until`; re-ship = new `fulfillment_orders` row with `reason = 'reship'` |
| Cancel | Only while **Live** (or Live OOS — pages conflict); full value back to wallet | Customer cancel only while our order is `pending` (before submission); staff cancel → `cancelOrder` + `cancel_credit` |
| Edit | Address/customer details until Printed; products never | Address edits allowed until `in_production` ends |
| NDR (COD) | WhatsApp redeliver/cancel; 3 attempts; auto-RTO after 72 h | `status = 'delivery_exception'`; staff action in Qikink dashboard (no documented API) |
| Wallet | ₹1 = 1 credit, no expiry, manual recharge in dashboard | Admin shows ledger-derived balance; recharges recorded as `recharge` |
| Invoices | Monthly GST invoice report (Excel), per-order invoice in dashboard | Not stored in v1; `provider_cost` holds the per-order charge |
| Tracking | AWB after Manifested; Qikink emails the customer | We also show tracking from `shipments` |
| Couriers | Delhivery, FedEx, eKart, Ecom Express, Xpressbees, India Post (prepaid only; COD not via India Post) | Courier stored as text from the provider |

## 5. Qikink status map (adapter `mapStatus`)

| Qikink | `fulfillment_orders.status` | `orders.status` |
|---|---|---|
| On Hold | `on_hold` | `confirmed` |
| Live OOS | `on_hold` | `confirmed` |
| Live | `submitted` | `confirmed` |
| To be Printed, Partially Picklisted, Printed, Manifested | `in_production` | `processing` |
| In-Transit | `shipped` | `shipped` |
| Exception | `delivery_exception` | `shipped` |
| Delivered | `delivered` | `delivered` |
| RTO Initiated | `rto_initiated` | `shipped` (ops alert) |
| Returned | `returned` | `failed` until re-shipped |
| Cancelled | `cancelled` | `cancelled` |

Shipment-level statuses (Pickup Scheduled … RTO Delivered, Reverse Pickup
Initiated) map onto `shipment_events.status` in the adapter.

## 6. How order lines name what to print (strategy A vs B)

| | **A — Store SKU** (`search_from_my_products: 1`) | **B — design per order** (`search_from_my_products: 0`) |
|---|---|---|
| Setup | Add each design to a blank in the Qikink dashboard (My Products); copy the generated Store SKU (`v-…`) per colour/size into our admin | Admin stores blank SKU (e.g. `MRnHs-Bk-M`), print type, placement, design + mockup links |
| Per order | Just the Store SKU + qty + price | SKU + print type + design code + design link + mockup link + placement + size in inches |
| Verified in live | **Yes** — used by production integrations | **Not confirmed** — public write-ups show it only as the sandbox test format |
| Strengths | Qikink has the artwork on file; less per-order data; errors caught at setup | One place to manage products; new designs need no Qikink dashboard work; scales to many designs |
| Weaknesses | Double setup per product; mapping must be kept in sync | Depends on Qikink allowing it in live; design files must be publicly hosted (R2) |

Decision (2026-11-10): **build for A** (the verified path) and keep the
adapter able to send B — `provider_product_mappings.provider_sku` holds the
Store SKU for A, `provider_payload` holds the design fields for B, so a
switch is data, not code. Ask Qikink support whether
`search_from_my_products: 0` is accepted in live (TL-INT-QIKINK).

Known API rules (third-party integration write-ups, unverified by Qikink
docs): `order_number` ≤ 15 characters, no dashes; `quantity`, `price`,
`total_order_value` sent as strings; token `POST /api/token`
(`ClientId`, `client_secret` → `Accesstoken`); sandbox and live have
separate product databases (sandbox cannot see My Products); one invalid
line holds the whole order; no webhooks (poll status).

## 7. API — **verified against the sandbox, 2026-11-16**

One base URL, set by `QIKINK_BASE_URL` (`https://api.qikink.com` by default;
`https://sandbox.qikink.com` while the store still holds sandbox keys). There
is **no mode switch in code**: keys decide whether the adapter is real, the URL
decides which environment it talks to.

| Call | Shape (verified) |
|---|---|
| Token | `POST /api/token`, **`application/x-www-form-urlencoded`**, fields `ClientId` + `client_secret` → `{ ClientId, Accesstoken }`. JSON bodies make the endpoint answer `500`; the form is mandatory. |
| Auth on every other call | headers `Accesstoken` **and** `ClientId`. `Accesstoken` alone → `401 "Invalid AccessToken or Client Id"`. Bearer auth is not accepted. |
| Create order | `POST /api/order/create` (JSON) |
| Read one order | `GET /api/order?order_id=<Qikink numeric id>` |
| List orders | `GET /api/order` → array (used to find our `order_number`) |
| Cancel | `POST /api/order/cancel` |

Create-order body (rejections observed in order, each fixed in the adapter):
`order_number` (≤ 15 chars, no dashes), `qikink_shipping: 1`, `gateway`
(`Prepaid`/`COD`), `total_order_value` as a string, `line_items[]`,
`shipping_address`.

* `shipping_address` needs `first_name`, `last_name`, `address1`, `address2`,
  `city`, `province`, `zip`, `phone`, **`email`** and **`country_code`**
  (`"IN"`). A `country` field is rejected as *unexpected*.
* A store-SKU line is `{ search_from_my_products: 1, quantity, sku, price }`.
  `print_type_id` and `designs` are **rejected** in that mode — Qikink reads
  both from the SKU. Strategy B (our artwork) is the other way round:
  `print_type_id` + `designs`, no `search_from_my_products`.
* Sandbox and live have separate product databases, so a sandbox key can only
  print SKUs that exist in the sandbox store (`Invalid SKU` otherwise).

The public help centre documents **no webhooks and no pincode lookup**:
tracking is poll-only (`GET /api/order`), NDR and claims are handled in the
Qikink dashboard, and the admin has per-row **Sync now**.

## 8. Open verifications

**Answered 2026-11-16 (sandbox):** token params (§7), auth headers (§7),
order-status/tracking endpoint (§7), and the create body (§7). The store's
current keys are **sandbox keys** — `api.qikink.com` answers
`401 "Invalid client_id or client_secret"` for them, so live needs credentials
from the Qikink dashboard and one env change (`QIKINK_BASE_URL`).

Still open:

1. Cancel accepted statuses (does **Live OOS** cancel?) — `/api/order/cancel`
   answers only for real orders, so this waits for the first live order.
2. Claim (replacement/refund) submission by API or dashboard only. (Evidence rules answered 2026-11-10 — see §4.)
3. Design upload: link-based only, or an upload endpoint (files ≤ 25 MB,
   300 DPI PNG/JPEG).
4. Whether the RTO storage charge (₹20/product) applies.
5. Live credentials: when Qikink issues them, set
   `QIKINK_CLIENT_ID`/`QIKINK_CLIENT_SECRET` and remove `QIKINK_BASE_URL`
   (defaults to live), then switch the provider row to `live` in Settings.

## 9. As built (TL-BE-04, 2026-11-11)

`packages/heart/src/integrations/`:

| Folder | What is there now |
|---|---|
| `registry/` | `listProviders`, `activeProviderSlug`, `updateProvider` — owns `integration_providers` |
| `payments/` | `PaymentGateway` interface + `mock` demo gateway (captures, `simulate: 'decline'`); `getPaymentGateway()` picks the active row |
| `fulfillment/` | `FulfillmentPartner` interface (§1) + `qikink` **simulator** (sandbox only, §5 status map, cancel only while Live) + `custom_atelier` (in-house, manual) |
| `storage/` | `ObjectStore` interface + in-memory mock (R2 in TL-INT-R2) |
| `email/` | mock sender (email_logs only) |

Registry rules (tests: `registry.int.test.ts`):

1. A provider switches **on** only if an adapter exists (Razorpay, Stripe,
   Printrove, Shiprocket: integrations phase).
2. **Live** only if the adapter reports live keys (`liveReady()`); mocks and
   the Qikink simulator never do. Custom Atelier is in-house, so it may.
3. `payment` and `email` keep **exactly one** active provider: switching one
   on switches the others off; the last one cannot be switched off.
4. Toggles lock the category's rows (`FOR UPDATE`) and are audited
   (`integration.update`).
5. Unknown Qikink status words map to `on_hold` (ops alert), never to a
   happy state.

## 10. Partner SKU editor (TL-BE-05 slice 3, 2026-11-11)

Product editor → **Partner SKU** tab, backed by `modules/catalog/mappings.ts`
and `provider_product_mappings`. One row per variant: the partner SKU (strategy
A) and unit cost, with the cost from the imported sheet shown as a hint.

- A SKU may be used once: duplicates are refused within a save and across
  products.
- A variant from another product is refused.
- Clearing the SKU removes the mapping.
- Strategy B design fields (§6) are stored in `payload` when sent; there is no
  editor for them yet.

