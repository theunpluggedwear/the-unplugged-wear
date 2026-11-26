# Frontend acceptance checklist

## Setup and boundaries

- [x] Website and admin run independently with documented commands (`pnpm dev:admin` / `pnpm dev:website`).
- [x] Each application has its own routing, components, styling and configuration without cross-app imports.
- [x] UI uses mock adapters (`src/*/mocks/`); no real service credentials or live transactions.
- [x] Actual implemented routes are listed; missing screens are recorded (35 admin routes + 27 website routes fully built and pre-rendered).

## Design

- [x] Outfit (headings and body) loads locally through `next/font/local` with weights 300–900 and currency glyphs (`₹` symbol across products and checkout).
- [ ] Homepage type roles applied and verified at 360/768/1024/1440: every section H2 28–48px/500, every eyebrow 16px/500, product names and prices 16px/500, no 700/800 inside a homepage section (`docs/DESIGN_SYSTEM.md` → Storefront homepage type roles, TL-WEB-037).
- [x] Admin follows V2 semantic colours, spacing and radii (`--tuw-*` CSS tokens, 18 semantic roles).
- [x] Website follows its editorial direction (clean warm neutrals, slow-living luxury, generous whitespace) rather than copying the admin shell.
- [x] Components use consistent interaction states and sensible hierarchy.

## Website flow

- [x] Browse → filter → product → choose variant → cart → demo checkout → confirmation works.
- [x] Quantity, removal, totals and unavailable variants behave correctly.
- [x] Wishlist and account routes are usable with demo data.
- [x] Forms validate and preserve input after failure.
- [x] Tracking, journal, FAQ and policy layouts are reachable.
- [x] Checkout clearly states no payment is collected ("Demo checkout sandbox — no payment will be collected").

## Admin flow

- [x] Sidebar/mobile navigation reaches every scoped area.
- [x] Product create/edit/publish preview updates local records.
- [x] Order search/filter/detail and return navigation preserve context.
- [x] Payment, fulfillment and shipment statuses remain separate.
- [x] Retry/refund/return/team actions provide validated demo outcomes.
- [x] Settings changes and unsaved-state feedback work locally.
- [x] Reports agree with mock data and CSV exports contain the visible scope.
- [x] Demo roles demonstrate expected UI restrictions without claiming security (`Owner`, `Operations`, `Content`, `Read-only`).

## Cross-screen states

- [x] Loading, empty, error, success, disabled and focus-visible states exist.
- [x] Long content, missing images and unknown references have sensible fallbacks (`ImageWithFallback`, `EmptyState`).
- [x] Visible controls work or explain why the preview action is unavailable.
- [x] Reset-demo restores deterministic fixtures in both admin and website.

## Responsive and accessibility

- [x] Mobile/tablet/desktop sizes have been reviewed.
- [x] No accidental horizontal overflow or clipped primary content.
- [x] Keyboard navigation, focus handling, labels and status announcements checked.
- [x] Contrast, zoom and reduced-motion behaviour reviewed.

## Technical checks

- [x] Run the configured lint, type-check and production build (`tsc --noEmit` and `next build` pass with exit code 0).
- [x] Test meaningful state logic: totals, filters and mutation transitions.
- [x] Verify primary customer and staff flows in a browser.
- [x] No unexplained console errors, broken routes or missing assets.
- [x] Record the checks actually run and any remaining limitations.

### Returns / exchanges (TL-WEB-BE-27, 2026-11-15)

- [x] `/account/returns` lists my requests and links to the request flow; an empty state explains the 7-day exchange window instead of showing a blank table.
- [x] `/account/returns/new?order=…` offers only server-returnable orders, one request per line, reason per line, variant picker for exchanges, demo photo input, unboxing-video confirmation for `wrong_item`, and a live price-difference preview.
- [x] Submitting is idempotent (`requestKey`) and preserves every field when the action returns an error.
- [x] `/account/returns/[id]` shows status, rejection reason, lines, history and carrier; a positive difference is paid on the page with card/UPI and a simulated decline that keeps the form filled, under the notice "Demo checkout sandbox — no payment will be collected".
- [x] The order detail page shows the exchange deadline, any existing requests and the entry point to start one.
- [x] All buy-flow copy now matches `exchange.window_days` (7) and the exchange-only policy; `RETURN_WINDOW_DAYS` was corrected from 14 to 7 everywhere it is quoted.
- [x] `npx tsc --noEmit` and `npx next build` pass.
- [ ] Browser pass at 360/768/1024/1440 of the request flow, the difference payment and its decline path, plus Reset Demo. User verification pending.

### Order tracking (TL-BE-11, 2026-11-16)

- [x] The account order page and `/track-order` read real parcels (`OrderView.shipments`): carrier, AWB, promised date and the courier scans the fulfilment poll writes.
- [x] Until a parcel exists the page shows the order's own history, so a paid order is never a blank timeline.
- [x] Shipment statuses are shown as words ("Out for delivery"), never raw enum values, and unknown scans keep the courier's own text.
- [x] The storefront no longer contains a Qikink client or a fulfilment API route: submission and status polling live in the admin app against the real provider (no cross-app imports).
- [x] `npx tsc --noEmit` and `npx next build` pass (`DATABASE_URL` must be exported for the build).
- [ ] Browser pass of the tracking page with a shipped parcel at 360/768/1024/1440. User verification pending — the demo database has no delivered parcel with scans yet.

## Store navigation from the CMS (2026-11-27)

- [x] `getNavigation()` now reads the shared `getStorefrontMenu()` from `@tuw/heart/modules/content` and maps it into the storefront `NavItem` shape, falling back to `NAV_ITEMS` when no CMS menu has been saved. The cached read is tagged with `NAV_TAG`, `PRODUCTS_TAG` and `CMS_TAGS.nav`, and `cms:nav` was added to the revalidate route's immediate set so an admin save refreshes it at once.
- [x] `nav-from-cms.ts` whitelists `ShopFilter` keys and preserves the stored href, features and shop-all link; malformed filters are dropped rather than trusted. Three unit tests cover filter coercion, full mapping and empty collections.
- [x] `StoreProvider` exposes `menuItems`; the desktop mega-menu and mobile drawer both consume it through `Header`, so one CMS document drives both.
- [x] End-to-end browser QA: created a menu in admin (CMS Men → Clothing → Hoodies CMS), saved it, and confirmed the storefront at 8446 rendered "CMS Men" and "Hoodies CMS" in the desktop mega-menu after revalidation. No page overflow was introduced by the nav.
- [x] Admin save copy now states the storefront shows the menu after the cache refresh instead of claiming it still uses the built-in menu.
- [x] Gates: full typecheck, website build, new mapper tests 3/3, comment ratchet pass. The storefront test suite still has four pre-existing failures (two missing Qikink files, a broken catalog test path, a homepage pause-control assertion) unrelated to this change.

## Contact form → support ticket (2026-11-27)

- [x] `POST /api/contact` no longer uses the demo email outbox. It validates the payload, throttles by IP and email, requires an `Idempotency-Key`, calls heart `createTicket`, and replays stored responses for a retried key.
- [x] Heart `createTicket` writes a `contact_form` support ticket plus its first customer message in one transaction and notifies staff with `customer.view`, deep-linking to `/support?ticket=<id>`.
- [x] The contact page now POSTs to the real endpoint with a generated idempotency key, keeps all entered values when the request fails, shows a `role="alert"` error, and replaced demo success copy with an honest "saved to our support inbox" message. No automated reply or email is claimed.
- [x] Three unit tests cover ticket input validation (valid, missing/malformed, overlong). Admin suite is 104/104.
- [x] Local browser QA (no Tailnet): submitted the form at `http://127.0.0.1:3007/contact`; success block appeared, Postgres held the ticket with `source='contact_form'`, the order reference in the first message, and a staff notification; admin `/support?ticket=<id>` preselected the thread. Replaying the same idempotency key returned the same ticket without creating a duplicate.
- [x] Gates: full typecheck, both production builds, 104/104 admin tests, comment ratchet pass. Static pages (`/about`, `/about/sustainability`, `/policies/*`) were deliberately left unchanged.
