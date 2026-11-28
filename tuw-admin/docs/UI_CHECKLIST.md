# Frontend acceptance checklist

## Setup and boundaries

- [x] Website and admin run independently with documented commands (`pnpm dev:admin` / `pnpm dev:website`).
- [x] Each application has its own routing, components, styling and configuration without cross-app imports.
- [x] UI uses mock adapters (`src/mocks/`); no real service credentials or live transactions.
- [x] Actual implemented routes are listed; missing screens are recorded (41 admin routes + 31 website routes fully built and pre-rendered).

## Design

- [x] Urbanist loads with required weights and currency glyphs (`₹` symbol across products and checkout).
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

## Recent PEDIT evidence

### Basic Information card + DrawerCard primitive (2026-10-20)

- [x] `pnpm run typecheck` passes with no diagnostics.
- [x] `pnpm run test` passed 66/66 tests at this slice (now 71/71 after the tooltip position suite).
- [x] `pnpm run build` completes with all 40 routes prerendered.
- [x] Static audit: all six Basic Information fields load and save; Category is required from the existing five labels; Gender and Publication status moved without dropping fields; the Internal fields count no longer includes Gender.
- [x] Static audit: `FormSelect` labels are linked and helper copy is wired through `aria-describedby`; required `Input`/`FormSelect` labels show a quiet trailing asterisk while retaining native `required`.
- [ ] Browser visual pass at 360 / 768 / 1024 / 1440: card rhythm, paired Input/FormSelect alignment, keyboard focus order, Category/Gender/Status persistence, Reset Demo. User verification pending.

### DrawerCard v2 header + drawer canvas (2026-10-20)

- [x] Static audit: `DrawerCard` header uses 16px padding, 18/26/600 title tokens, 14/22/400 secondary description, 4px title/subtitle gap, and a full-bleed 1px `--tuw-border-subtle` divider; body uses 16px padding and 14px field rhythm.
- [x] Static audit: card outer border and header divider use the same `--tuw-border-subtle` token; card shadow is removed and the card clips the header with `overflow: hidden`.
- [x] Static audit: product editor General opts into `Drawer bodyTone="canvas"` (`--tuw-bg-canvas` #F7F8F9) so white cards separate from the drawer; other drawers and non-cardified tabs keep the surface default.
- [x] Static audit: no card-level “Required” chip; selected/warning header tones are opt-in and use existing semantic tokens only. No per-section colours.
- [ ] Browser visual pass at 360 / 768 / 1024 / 1440: header divider, drawer canvas, title/subtitle spacing, required asterisks, no dead chevron, focus order. User verification pending.

### Basic Information labels + Style Code info tooltip (2026-10-20)

- [x] Static audit: `DrawerCard` body establishes a 14px/600 field-label context; `Input`, `FormSelect` and `FormTextarea` consume it with their existing legacy fallbacks outside cards. The three explicit `labelSize={13}` overrides are removed from Basic Information. Card label rows reserve 24px, so the Style Code hint does not shift the paired Category baseline.
- [x] Static audit: helper lines are removed from URL Slug, Style Code, Category, Gender and Publication status; all six fields and required asterisks remain. The Style Code internal-reference copy is preserved as the tooltip body.
- [x] Static audit: only Style Code renders `InfoTooltip`; the icon is a 24px `type="button"` with a Lucide `Info` glyph and an accessible “More information about Style Code” name.
- [x] Static audit: `Tooltip` portals to `document.body`, uses semantic surface/border/text/shadow tokens, exposes `role="tooltip"` plus `aria-describedby`, prefers top placement with flip/clamp, and closes on Escape/outside click/scroll/resize.
- [x] `pnpm run test` includes five tooltip-position cases covering top placement, bottom flip, preferred-side flip, horizontal clamping and oversized content.
- [x] `pnpm run typecheck` passes and `pnpm run build` prerenders all 40 routes.
- [ ] Browser visual pass at 360 / 768 / 1024 / 1440: 14/600 labels, helper lines gone, info icon only on Style Code, hover/focus/tap tooltip, no clipping by card/drawer, Escape/outside close, tab order. User verification pending.

### Collapsible Basic Information + house dropdowns (2026-10-20)

- [x] Static audit: `DrawerCard` supports opt-in controlled/uncontrolled collapse. Basic Information starts collapsed, uses a real `<button type="button">` with `aria-expanded`, `aria-controls`, `aria-labelledby`, and a labelled body region; Enter/Space toggle and closing returns focus to the header.
- [x] Static audit: the body is mounted only while open, so collapsed fields are not tab stops and cannot contribute hidden required controls or a stale SearchableSelect popover. Field values live in `ProductsView` and survive collapse/reopen.
- [x] Static audit: the collapsed header has no internal divider; the outer card border remains. The chevron rotates and is `aria-hidden`; optional badge/action stay outside the toggle.
- [x] Static audit: Category, Gender and Publication status use `SearchableSelect` instead of native `<select>`. Category is marked required; Gender maps the `unspecified` sentinel back to the form's empty string; all three render 44px triggers.
- [x] Static audit: `SearchableSelect` labels consume the card-scoped 14/600 label context with a 24px row, link `htmlFor`/input `id`, expose `aria-required`, and close on Escape without propagating that Escape to the drawer.
- [x] `pnpm run typecheck` passes with no diagnostics; `pnpm run test` passes 71/71 admin tests; `pnpm run build` prerenders all 40 admin routes.
- [ ] Browser visual pass at 360 / 768 / 1024 / 1440: default-collapsed card, expand/collapse by mouse and keyboard, no tab stops while collapsed, values preserved across tab switches, dropdown open/select/save, popover clipping, Escape closes only the dropdown, Style Code tooltip, Reset Demo. User verification pending.

### Pricing & stock card + compare-at tooltip (2026-10-20)

- [x] Static audit: Pricing & stock is General card 2, built on the same collapsible `DrawerCard`; it starts collapsed, has independent `pricingCardOpen` state, survives tab switches, and resets when a create/edit drawer opens or closes.
- [x] Static audit: Base price and Compare-at price share the first paired row, keeping the validation-dependent pair adjacent; Stock Quantity and Tax Rate share the second row. Both rows use `repeat(auto-fit, minmax(180px, 1fr))` with a 12px gap and 44px `Input` controls.
- [x] Static audit: Tax Rate moved out of the Checkout section into Pricing & stock; the now-empty Checkout section is removed. No field is duplicated or dropped. The remaining flat discount section is retitled “Scheduled discounts” ahead of its own card.
- [x] Static audit: all four Pricing & stock helper lines are removed; no helper text renders below an input. Compare-at retains its native `Input` label hint (`InfoTooltip`) and its inline “higher than the selling price” validation error, and existing value-preserving handlers are unchanged.
- [x] Static audit: compare-at validation failure opens the Pricing & stock card on both create and edit paths before returning to General, so the inline error is not hidden by the collapsed body. Scroll/focus to the first invalid field remains in `TL-UI-PEDIT-SHELL`.
- [x] `pnpm run typecheck` passes with no diagnostics; `pnpm run test` passes 71/71 admin + 7/7 website tests; `pnpm run build` prerenders all 40 admin routes and 27 website routes.
- [ ] Browser visual pass at 360 / 768 / 1024 / 1440: card default-collapsed and independent, base/compare and stock/tax alignment, helper lines absent, compare-at tooltip hover/focus/tap without clipping, auto-open on validation failure, tax save/reload, Reset Demo. User verification pending.

### Scheduled discounts card (2026-10-20)

- [x] Static audit: Scheduled discounts is General card 3, built on the same collapsible `DrawerCard`; it starts collapsed, has independent `discountsCardOpen` state, survives tab switches, and resets when a create/edit drawer opens or closes.
- [x] Static audit: the old flat section and nested `SurfaceCard` rows are replaced by flat bordered rows inside the card; Type, Value, Starts, Ends, Active, remove, and Add Discount are all retained.
- [x] Static audit: Type uses `SearchableSelect`; Value, Starts, and Ends use native `Input`; Active uses `Switch`; each row has a visible heading and a row-scoped remove button with a specific accessible name.
- [x] Static audit: every row input has a unique id, row groups are labelled by their heading, and removing a row returns focus to Add Discount.
- [x] Static audit: the header count badge appears only when rows exist and uses singular/plural copy; the empty state explains that the normal selling price applies. No helper lines are rendered.
- [x] Static audit: switching to Percent clamps the value to 100; date-window requiredness and `endsAt >= startsAt` validation remain a separate follow-up.
- [x] `pnpm run typecheck` passes with no diagnostics; `pnpm run test` passes 71/71 admin + 7/7 website tests; `pnpm run build` prerenders all 40 admin routes and 27 website routes.
- [ ] Browser visual pass at 360 / 768 / 1024 / 1440: default-collapsed card with independent toggle, empty state, add/remove, type switch, value clamp, dates, active switch, save/reload, row focus return, Reset Demo. User verification pending.

### Description folded into Basic Information (2026-10-20)

- [x] Static audit: the standalone Description textarea is removed; Description now renders full-width inside Basic Information directly after URL Slug and before Style Code/Category.
- [x] Static audit: `formDescription` load/save behaviour is unchanged, and no separate Description card or `descriptionCardOpen` state was added. The card subtitle now names storefront copy.
- [x] Static audit: `FormTextarea` now associates its label with the control through a generated or caller-supplied `id`; no visual styling changes beyond the new card text treatment (`fontSize=14`, `10px 12px` padding).
- [x] Static audit: Basic Information retains Product Title, URL Slug, Description, Style Code, Category, Gender and Publication status; no helper lines were added.
- [x] `pnpm run typecheck` passes with no diagnostics; `pnpm run test` passes 71/71 admin + 7/7 website tests; `pnpm run build` prerenders all 40 admin routes and 27 website routes.
- [ ] Browser visual pass at 360 / 768 / 1024 / 1440: Description load/save per product, full-width textarea alignment, label association, Basic collapse/reopen persistence, Reset Demo. User verification pending.

### Fulfillment & shipping card (2026-10-20)

- [x] Static audit: Fulfillment & shipping is General card 4, built on the collapsible `DrawerCard`; it starts collapsed, has independent `fulfillmentCardOpen` state, and resets when a create/edit drawer opens or closes.
- [x] Static audit: Print partner surfaces as a `SearchableSelect`; the legacy Print placement select was removed on 2026-10-22. Print locations are now the internal `Placements` attribute in card 5, the single source for product placement data. Weight and Shipping weight pair below the partner field, and Package dimensions is full width.
- [x] Static audit: weight, shipping weight and package dimensions were moved out of the Internal disclosure without duplication; the disclosure was retitled “Internal attributes” in card 4 and is now replaced by card 5’s Internal only group.
- [x] Static audit: the helper line below the weight fields is gone; all labels are linked, and no new DB columns or logic extraction were introduced. Partner remains demo-only pending a SQL column; Placements remains demo data on the attribute library.
- [x] `pnpm run typecheck` passes with no diagnostics; `pnpm run test` passes 86/86 admin + 7/7 website tests; `pnpm run build` prerenders all 40 admin routes and 27 website routes.
- [ ] Browser visual pass at 360 / 768 / 1024 / 1440: default-collapsed card, partner load/save, no Print placement select, weight/dimension load/save, two-column alignment, card 5 Internal only group, Reset Demo. User verification pending.

### Placements single source (2026-10-22)

- [x] Static audit: removed `ProductItem.placement`, `PLACEMENT_OPTIONS`, `formPlacement`, the create/save/import writes, and the Print placement `SearchableSelect`. `Placements` (`LIB-03`) is the only product-level source, edited in General card 5’s Internal only group.
- [x] Static audit: create mode seeds the Placements attribute with `Front`; imported workbook groups map their Placements column into the same attribute; baseline product fixtures carry canonical six-value selections instead of the old four-value field.
- [x] Static audit: localStorage hydration migrates legacy rows into the attribute — `Chest (45mm)` → `Front`, `Back Oversized` → `Back`, `Sleeve Length` → `Left Sleeve` + `Right Sleeve`, and `Interior Hem` is preserved as a product-local value. Existing non-empty Placements values win.
- [x] Static audit: the product drawer always rebuilds Color, Size and Placements builtins from the product and overlays persisted values, so a fixture carrying only a Placements attribute still shows all three rows.
- [x] Automated verification: `pnpm run typecheck` passes with no diagnostics; `pnpm run test` passes 86/86 admin + 7/7 website tests, including the new import test that keeps Placements product-level and out of variant axes; `pnpm run build` prerenders all 40 admin routes and 27 website routes.
- [ ] Browser visual pass at 360 / 768 / 1024 / 1440: card 4 has no Print placement control, card 5 Placements values load/save, a legacy localStorage product migrates without losing its placement, import stages workbook Placements, create defaults to Front, Reset Demo. User verification pending.

### Attributes & values card + library-owned display type (2026-10-20)

- [x] Static audit: the ATTR-DISPLAY drawer slice consumes the library-owned showcase type via `normalizeAttributeDisplayType(libraryOf(attr)?.displayType)`; the per-product display dropdown and `setDisplayType` are gone. Unlinked legacy attributes fall back to Pill and show an `Unlinked · Pill` warning; `ProductAttribute.displayType` remains persisted for compatibility but is ignored for rendering. No migration.
- [x] Static audit: Attributes & values is General card 5, a collapsible `DrawerCard` with independent `attributesCardOpen` state, reset when a create/edit drawer opens or closes. The old flat section and separate Internal attributes disclosure are replaced by one card with Storefront and Internal only groups.
- [x] Static audit: the two-row top action strip pairs Link from library with a Manage library outline `LinkButton` on row 1, then new-attribute name + Add on row 2; the standalone link is removed. Rows are flat bordered groups; values render as wrapping chips with inline remove; swatch chips use the product-local color input and drop the hex text; radio chips show a dot preview. No value table or nested cards.
- [x] Static audit: swatch inputs use the shared `.tuw-color-swatch` class. It resets native input appearance, rounds the control and the WebKit/Firefox inner swatch at 20px, and adds a `focus-visible` ring. `setSwatchHex` is unchanged.
- [x] Static audit: `linkFromLibrary`, `commitAttrValue`, `removeAttrValue`, `addAttribute`, `removeAttribute`, and `setSwatchHex` are unchanged; default Color/Size/Placements rows remain non-removable; the known-value picker remains when the library has unused values. No new DB columns, dependencies, auth, payment or fulfillment integration.
- [x] `pnpm run typecheck` passes with no diagnostics; `pnpm run test` passes 71/71 admin + 7/7 website tests; `pnpm run build` prerenders all 40 admin routes and 27 website routes. Compiled admin CSS contains `.tuw-color-swatch` plus both inner-swatch pseudo-element rules; a headless Edge probe confirms the class renders both swatches as circles while a border-radius-only input still shows the inner rectangle.
- [ ] Browser visual pass at 360 / 768 / 1024 / 1440: card default-collapsed and independent, Storefront/Internal groups, chip wrapping, Manage library beside the dropdown, fully circular swatch picker, radio previews, add/remove value, known-value picker, default protection, library type reflected read-only, unlinked fallback, Reset Demo. User verification pending.

### General-tab expanded card layout (2026-10-20)

- [x] Static audit: the General form uses `.tuw-pedit-general-grid`. Compact view stays one column; Expanded matrix / Full canvas switches to two columns at 900px and above, pairing cards 1+2 and 3+4. Card 5 spans both columns. `align-items: start` and min-width guards prevent stretched/overflowing cards, and DOM order remains 1–5.
- [x] Static audit: Storefront attribute rows are wrapped in `.tuw-pedit-attribute-grid`, which becomes three columns at the same expanded/wide breakpoint. Internal only remains a separate group below and is never mixed into the Storefront grid, including when the third Storefront slot is empty. Below 900px or in Compact view both grids stay one column.
- [x] `pnpm run typecheck` passes with no diagnostics; `pnpm run test` passes 71/71 admin + 7/7 website tests; `pnpm run build` prerenders all 40 admin routes and 27 website routes. Compiled admin CSS contains `.tuw-pedit-general-grid`, `.tuw-pedit-general-wide`, `.tuw-pedit-attribute-grid`, the two-column expanded rule, and the three-column Storefront rule.
- [ ] Browser visual pass at 360 / 768 / 1024 / 1440: Compact keeps one card per row; Expanded matrix / Full canvas shows two cards per row at 1024/1440; card 5 is full width; Storefront attributes show three per row when expanded/wide; Internal only stays separate; open-card neighbours stay top-aligned; no horizontal overflow; tab order stays 1–5; Reset Demo. User verification pending.


### Workbook import + serial/HSN (2026-10-21)

- [x] Static audit: the CSV importer now finds the real header row (the sheet title is row 1), maps S.No, Gender, Style, sizes, Colors, Weight, Shipping Weight, Base Price, Placements, Package Dimensions (LxBxH), Tax Rate, HSN and optional Category, and preserves every accepted row in `sourceRows` with its physical row number.
- [x] Static audit: rows fold into one draft per style group (style code first, otherwise style name + gender), with a split when non-empty HSN values conflict. Color x Size variants retain the row price, weight, shipping weight, dimensions and source S.No; duplicate combinations keep the first row and add a visible issue.
- [x] Static audit: staging uses one `createProducts` state commit, so a multi-product workbook cannot overwrite itself through the old loop/stale closure. Product IDs are sequential and variant IDs/SKUs are regenerated in the seam.
- [x] Static audit: missing Category falls back to `Uncategorized`, never `T-Shirts`; the category filter and editor picker include imported categories. Gender accepts Female, Male, Unisex, Kids, Boy and Girl.
- [x] Static audit: Pricing & stock exposes an optional HSN field (digits only, 4-8 digits) that auto-opens the card on save failure; imported products show a display-only internal S.No line in Basic Information. Editing an imported product preserves serial, HSN, source group, source rows and variant-level shipping overrides.
- [x] Automated verification: `pnpm run typecheck` passes; `pnpm run test` passes 78/78 admin tests (7 new workbook-grouping cases); `pnpm run build` prerenders all 40 admin routes.
- [x] Dataset audit: the supplied `Final Listing (1).xls` was converted to CSV outside the repo and exercised through the grouping helper. 321 data rows produced 155 draft products and 2,792 variants, with 321 source rows and 321 unique S.No values preserved; zero row/group errors; MP25 split into 7 rows (`61091000`) + 1 row (`610990`); `Classic Crew T-Shirt` Boy and Girl stayed separate; all 155 groups are `Uncategorized` because the workbook has no Category column.
- [ ] Browser visual pass at 360 / 768 / 1024 / 1440: import preview counts, 155-draft staging, localStorage persistence, category filter for `Uncategorized`, HSN validation, internal S.No display, edit/reload preservation, variant table with a 305-variant product, Reset Demo. User verification pending.

### Clothing Specs card stack (2026-10-21)

- [x] Static audit: the Clothing Specs tab now uses `.tuw-pedit-specs-grid` and four collapsible `DrawerCard`s — 1 Display options, 2 Clothing specifications, 3 Size chart, 4 Monogram & custom embroidery. Card 4 mounts only while the Display options switch is on. Each card owns independent open state, starts collapsed, survives tab switches, and resets when a create/edit drawer opens or closes.
- [x] Static audit: size-chart assignment (Associated Size Chart Template link, Size Chart dropdown, size-charts disclosure) moved out of Clothing specifications into card 3 without changing chart CRUD, the in-use delete guard, row drafts, or cell editing. Size-chart entries were flattened from `SurfaceCard` to a flat bordered group so no card nests inside a card; the measurement table keeps its own horizontal scroll.
- [x] Static audit: the Display options switch still controls only whether the monogram card renders, and the monogram card keeps its switch and Max Characters/Upcharge pair, now using the shared auto-fit field grid instead of a fixed 1fr 1fr split. The Clothing Specs drawer body now uses the canvas tone so white cards separate from the `#F7F8F9` body.
- [x] Static audit: Compact keeps one card per row. Expanded matrix / Full canvas switches `.tuw-pedit-specs-grid` to two columns at 900px and above, pairing 1+2 and 3+4; below 900px it stays one column. DOM order remains 1–4 and no card spans columns.
- [x] Automated verification: `pnpm run typecheck` passes; `pnpm run test` passes 78/78 admin + 7/7 website tests; `pnpm run build` prerenders all 40 admin routes. Compiled admin CSS contains `.tuw-pedit-specs-grid`, the shared min-width guard, and the `.tuw-pedit-specs-grid.is-expanded` two-column rule.
- [ ] Browser visual pass at 360 / 768 / 1024 / 1440: Compact one card per row; Expanded/Full two columns at 1024/1440 pairing Display+Clothing and Size chart+Monogram; Display options switch hides/shows card 4; each card collapses independently and keeps state across tab switches; size-chart table scrolls inside a half-width card; monogram pair collapses to one column at 360; feedback for chart add/remove and in-use guard; Reset Demo. User verification pending.

## Recent Journal / CMS evidence

### Admin authoring runtime + Phase 3 storefront journal (2026-10-27)

- [x] Admin `/content/journal/BLOG-001/edit` loads through headless Chrome/CDP with no runtime exceptions. The original `Cannot read properties of undefined (reading 'schema')` is fixed by converting the persisted compact block array to a full ProseMirror document at the Tiptap boundary and converting the editor result back to block JSON (`90c3526`).
- [x] Editor image nodes resolve `src` from `mediaId` for display, then strip URL data on save; the stored body stays media-id-only. Lists and blockquotes are wrapped/unwrapped between the compact model and Tiptap's paragraph/list-item schema.
- [x] Admin editor timestamps use a deterministic `en-IN` / `Asia/Kolkata` formatter (`c081f00`, `dca4e76`); the prior server/client hydration mismatch is gone.
- [x] Storefront `/journal` renders at 360, 768 and 1440 with URL-driven category, author, tag, search and sort controls, result counts and an empty state. CDP reports no console errors and no horizontal overflow.
- [x] `/journal/[slug]` renders the cover, metadata, validated block JSON, tags, author card and three related essays. CDP reports one BlogPosting JSON-LD block, the expected canonical URL, `og:type=article`, Urbanist italic available, no console errors and no horizontal overflow at 360/1440.
- [x] The homepage featured story reads from the same journal model; the legacy `JOURNAL_ARTICLES` fixture and `JournalArticle` type are removed.
- [x] Storefront taxonomy mirrors the admin canonical categories, including `Culture`; there is no published Culture fixture yet, so that pill intentionally reaches the empty state until Phase 4 content exists.
- [x] Storefront journal helpers are covered by native Node tests for reading-time formatting, UTC date formatting, publication gating and related-post ranking (`6c7e124`).
- [x] `pnpm run typecheck` passes with no diagnostics; `pnpm run test` passes 99/99 admin + 11/11 website tests; `pnpm run build` prerenders all 41 admin routes and 31 website routes, with the four journal articles statically generated.
- [ ] Full admin journal list/editor keyboard, focus, empty/loading/error and Reset Demo browser pass at 360/768/1024/1440 remains pending.
- [ ] Runtime PostgreSQL validation remains blocked because `psql`/PostgreSQL is not installed locally; the static schema guard is the current substitute.

## Returns / RMA evidence

### Exchanges + defect replacements (TL-BE-10, 2026-11-15)

- [x] Admin `/returns` reads the DB: stat cards, status/type filters, search, CSV export, and a review drawer with per-line variant/reason, evidence list, history and disposition selects.
- [x] Approve requires a decision note; reject requires a reason (trimmed, max 255) and is refused without one. Both write `return_status_history`.
- [x] Approving an exchange sets `order_lines.returned_qty` and creates the linked follow-up order (`order_type = exchange|replacement`); a negative price difference is refundable only when the original payment was `paid`; refund uses a client idempotency key so a double click cannot double-refund.
- [x] `permission: return.view` (admin + support) / `return.manage` (admin) guard every action through `guards.action`, and the page redirects to `/login` or `/403` rather than rendering a dead screen.
- [x] Storefront `/account/returns` reads the same tables: orders past the exchange window are excluded server-side (7 days from delivery from `store_settings.exchange.window_days`), one open request per line, photo required, unboxing video required for `wrong_item`.
- [x] Copy no longer promises money-back returns: policies, product, checkout, success, invoice and footer all say 7-day exchanges on unworn clothing and free defect replacements.
- [x] `packages/heart/src/modules/returns/returns.int.test.ts` passes 6/6 (window boundary, one-per-line, video rule, difference both ways, approval effect, status transitions).
- [x] `npx tsc --noEmit` passes in both apps; `npx next build` succeeds in both with `/returns` as a Partial Prerender route.
- [ ] Browser pass of the admin board and the storefront request/payment flow at 360/768/1024/1440 with MB-004/MB-005/MB-006 (latent fixture orders only cover two delivered lines), keyboard focus in the drawers, and Reset Demo. User verification pending.
- [ ] Reverse pickup booking, real evidence uploads and reverse AWB stay with TL-BE-11 / TL-INT-R2; the sidebar count badge was removed because it was static demo data.

## Fulfilment board & shipments (TL-BE-11, 2026-11-16)

- [x] `/fulfillment` reads the database: stat cards (waiting, queue, hold, in production, shipped, issues, delivered 30d, COD pending), seven tabs, search, and a row drawer with the provider timeline, lines, wallet debits, claims and the raw provider status.
- [x] Every action round-trips through `guards.action` (`shipment.manage`) into `packages/heart/src/modules/fulfillment`: **Send now**, retry after a failure, **Sync now**, cancel with the partner (credited to the wallet ledger when a cost was charged), manual tracking, re-ship, and claim draft → submitted → approved → resolved.
- [x] "Send now" still works when the auto-submit switch is off, and the board shows a banner naming the switch when it is.
- [x] The provider footer names the API host and whether real keys are configured, so nobody assumes the simulator is Qikink.
- [x] A simulator row (`sim_qk_…`) cannot be synced or cancelled as if Qikink accepted it; the drawer explains why and offers the manual move.
- [x] `/shipments` lists real parcels with carrier, AWB, pieces, promised date, scan count and a status control; the spotlight `!ship` scope searches them instead of apologising.
- [x] Wallet and COD panels read the ledger and remittances: balance, 30-day debits/credits, per-parcel settlement and unallocated amounts; recording a transfer twice is refused as a conflict.
- [x] `packages/heart/src/modules/fulfillment/fulfillment.int.test.ts` passes 7/7 (unpaid skip + one send only, auto-submit gate, cancel credit, manual dispatch + timeline, claim evidence/video/wallet credit, COD remittance and duplicate refusal, board/stats read models). It caught two real bugs: a wrapped unique-violation error that hid duplicates, and a text parameter bound where a `uuid[]` was expected.
- [x] `npx tsc --noEmit` passes in both apps; `npx next build` succeeds with `/fulfillment` and `/shipments` as Partial Prerender routes, and every fulfilment cron is declared in `vercel.json`.
- [ ] Browser pass of the board, the drawer actions, the COD/wallet panels and the shipments table at 360/768/1024/1440, plus keyboard focus and Reset Demo. User verification pending.
- [ ] Live Qikink: the store's current keys are sandbox keys, so no live order has been sent yet; the first live submission, cancellation and sync still need a real key. Reverse pickup and reverse AWB stay with TL-INT-R2.

## Store Navigation tree matrix (TL-UI-NAV-MATRIX, 2026-11-24)

- [x] `/content/navigation` uses an expandable tree table built only from the existing `Table`, `Input`, `IconButton`, `Button`, `Badge`, `ContentCard` and `EmptyState` primitives. No new UI primitive or grid dependency.
- [x] One shared menu, no tabs: items / columns / links plus desktop-only feature tiles and shop-all, caps 20/6/30/2. Tree-guide indentation and chevrons show depth; `aria-expanded` toggles with Enter/Space.
- [x] Cross-level search keeps matching ancestors, auto-reveals matches, reports match count, and disables Collapse/Expand all while active. Collapse hides descendants without losing data.
- [x] Inline editing: click a cell, Enter or blur commits, Escape discards; empty/over-length values stay in the field with an inline error and are never saved. Focus-visible rings and labelled icon buttons verified.
- [x] Capacity bars always show `used / limit`, use semantic warning/error colours at thresholds and expose `role="progressbar"` with aria values. Add controls stop at the cap and state the reason.
- [x] Save persists one `navbar.menu` document through `saveMenuAction` with `content.manage` rechecked in the DAL; a reload through the Tailscale URL restored the tree. Refresh failure is reported truthfully rather than hidden.
- [x] A legacy `navbar.mobile` + `navbar.desktop` pair with one overlapping item was merged on read into one list of three items with no duplicates; the desktop item's `filter`, feature `productSlug` and shop-all filter survived, and both legacy keys remained untouched after saving.
- [x] The page states plainly that the menu is a draft: the storefront still renders its built-in `NAV_ITEMS`; wiring `navbar.menu` into `tuw-website` is a separate task.
- [x] Browser QA at 360/768/1024/1440: no page-level horizontal overflow (the `Table` wrapper scrolls internally below 1440). QA admin and QA nav rows were deleted afterwards.
- [x] Gates: `pnpm run typecheck`, `pnpm run test:admin` (85/85), `pnpm run build:admin`, `pnpm lint:comments` (3012/3016). Full `pnpm run test` still has pre-existing storefront failures (missing `qikink` files and homepage typography assertions); no storefront file was touched.

### Navigation matrix UX pass (2026-11-24)

- [x] Replaced the vague `Label` / `Link / URL` / `Item / column / link` headers with `Structure · Name · Link · Capacity · Actions`. Every row now shows a contextual field name and helper: Menu name / Column heading / Link text / Feature title / Shop-all text, with hints such as "Groups the links beneath it" and "What customers click".
- [x] Column rows now state "A group — no destination" instead of a bare dash, so it is clear why they have no link.
- [x] Rows are rounded white cards using the sidebar's own tokens: `--radius-nav` 10px, `--tuw-bg-surface`, `--tuw-border-subtle`, `--shadow-nav-edge` and `--color-nav-branch-hover`. Hover applies the nav wash; `:focus-within` applies the sidebar's inset bottom edge. Tree guides are curved elbows (`border-bottom-left-radius: var(--radius-nav)`) like the sidebar's `navTree`. Header corners are rounded too.
- [x] The three ambiguous `+` icon buttons are now labelled chips (`Column`, `Feature`, `Shop all`) and column rows use a labelled `Link` chip. Move/remove remain icon buttons with `title` tooltips as a secondary cue.
- [x] Browser QA confirmed the computed row radius is 10px, row background white, focus inset shadow `rgb(214,214,214) 0px -2px 0px inset`, curved guide radius 10px, the labelled chips and tooltips present, and no page-level horizontal overflow at 360/768/1024/1440 (table scrolls internally below 1024).
- [x] Gates re-run clean after the pass.

### One shared menu for drawer and header (2026-11-24)

- [x] Removed the two tabs and the two separate documents. Store Navigation is now one table backed by `navigation_settings.navbar.menu`, matching the storefront's single `NAV_ITEMS` list that feeds both `Header` and `MobileMenu`.
- [x] Unified caps: 20 items, 6 columns, 30 links, 2 feature tiles. Feature tiles and shop-all stay editable on the item and are labelled "Desktop header only"; the phone drawer ignores them.
- [x] Legacy `mobile` / `desktop` documents are merged on read by normalised label + href, carrying over filters, features and shop-all, and appending items that exist in only one document. An explicit empty `menu` is respected, so clearing the menu is not undone by the fallback.
- [x] New pure merge helper with 5 unit tests; admin suite now 90/90. Full typecheck, admin build and comment ratchet (3011/3016) pass.
- [x] Browser QA: seeded overlapping legacy documents, confirmed one merged list of three items with no duplicates, saved, and verified `navbar.menu` was written while both legacy keys remained. Search, labelled chips and responsive widths re-checked. QA admin and nav rows cleaned afterwards.

### Compact matrix rows (2026-11-24)

- [x] Root cause of the ~253px rows found in the browser: the helper line used a unitless React `lineHeight: 16`, which the browser computes as 16 × the 11px font = 176px. Changed to an explicit `'16px'`.
- [x] Helper and column captions are now single-line with ellipsis and a `title` tooltip, so narrow columns cannot inflate a row.
- [x] Actions column widened from 200px to 260px and the other widths rebalanced to 22/24/19/11 percent so the total stays under 100 percent. Chips now occupy one nowrap line (`Column`, `Feature`, `Shop all`) and move/remove a second line.
- [x] Measured row height in the browser at 360 / 768 / 1024 / 1440: **94px at every width** (was 253px), all three chips on one line, no page-level horizontal overflow.
- [x] Gates re-run: typecheck, 90/90 admin tests, build, comment ratchet 3011/3016.

### Continuous tree connectors (2026-11-24)

- [x] Replaced the floating 10px `╰` arcs with a dedicated `TreeGuide` primitive that draws crisp stems and elbows (0px radius), using the sidebar's `--color-nav-guide` / `--color-nav-guide-active` tokens. The sidebar's `.navTree` pseudo-element CSS was inspected but not reused: it is gapless, uses `nth-child` range tricks and the very 10px arc being removed, so it cannot serve `<tr>` rows with 8px gaps and search filtering.
- [x] `withTreeGuides()` computes continuation by checking which later visible rows share each ancestor at each level, so a depth-2 Link under a Column with a following Feature tile gets a pass-through trunk at the ancestor level and a terminal elbow at its own level. Three new unit tests cover middle ancestors, last siblings and recomputation after collapse.
- [x] Expanded parents draw a downward stem from beneath the chevron to the next row, crossing the 8px card gap; its x aligns exactly with the child's trunk. Collapsing removes descendants, their lines and the parent stem together.
- [x] Guides render on leaf rows too, not only rows with children; only parents get a chevron.
- [x] Toolbar uses `alignItems: center` so the row count lines up with the item pill and Collapse/Expand controls; `+ Shop all` is nowrap like `+ Column` and `+ Feature`.
- [x] Browser QA at 360 / 768 / 1024 / 1440: zero connector arcs, chips on one line, no page-level overflow; measured chevron-to-stem offset 9px (half the icon width). Gates: typecheck, 93/93 admin tests, build, comment ratchet 3011/3016.

### Sidebar-matched connector geometry (2026-11-24)

- [x] Replaced the sharp 90° branch with the sidebar's exact elbow recipe: 1px `--color-nav-guide` strokes, `border-bottom-left-radius: var(--radius-nav)` = 10px, 14px elbow width, active path `--color-nav-guide-active`. The sidebar's `.navTree` rules were left untouched; the visual recipe and tokens are shared, not its gapless `nth-child` geometry.
- [x] One coordinate system: `--tree-step` 20px, `--chevron-size` 20px, `--row-gap` 8px, `--tree-elbow` 14px, declared inline on the guide elements because the CSS lives under Tailwind's `@theme`. Every stem/elbow uses `left: calc(var(--tree-step) * level + var(--chevron-size) / 2)`; the toggle has a fixed 20px slot, so its centre is exactly the line's x.
- [x] Parent stem starts at `calc(50% + 10px)` beneath the chevron and ends at `bottom: 0` of the parent row; child elbows start at `-8px` and meet it. Pass-through trunks span the row plus both gaps. Collapsed rows render no descendants and no stems.
- [x] Browser bounding boxes: with one child (Menu item → Feature tile), chevron centre, parent stem and child elbow are all **x=318.8**, stem bottom **457.8** equals elbow top **457.8**, elbow radius **10px**, zero pass-through lines. With siblings + 3 levels, all level-0 segments are at the same x=318.8 (one continuous line), level-1 at 338.8, no offset duplicate. Collapse → 1 row and zero lines; expand → 5 rows and all lines restored. No page overflow at 360/768/1024/1440.
- [x] Gates re-run: typecheck, 93/93 admin tests, build, comment ratchet 3011/3016. QA admin and nav rows cleaned afterwards.

### Adversarial QA pass (2026-11-24)

Every scenario was run against the production build over the Tailscale URL with a temporary QA admin, then the admin and `navbar` were reset.

- [x] **Empty form save (DEFECT FOUND → FIXED):** Add menu item then Save without typing produced a raw Zod message ("String must contain at least 1 character(s)"). Save now validates locally and reports `Fix before saving: Menu item 2: menu name is required · Menu item 2: menu link is required`; inputs remain on screen.
- [x] **One invalid stored row (DEFECT FOUND → FIXED):** `navbar.menu` with one empty-label item made the whole menu disappear (0 rows). `sanitizeMenu()` now keeps valid rows and drops only invalid ones — the valid item survives.
- [x] **Over-cap stored data (same DEFECT → FIXED):** 21 items / 7 columns / 31 links / 3 features previously produced 0 rows; now clamps to 20/6/30/2 and renders 189 rows with `1 / 20 items`, no page overflow.
- [x] Broken `menu` type (string) → graceful empty state, no crash. Long 100/200-char text at 360/768/1024/1440 → 94px rows, zero overflow. Explicit empty menu saved → stays empty after reload. Legacy mobile+desktop merge still yields one deduped item with its feature.
- [x] Caps live: 20 items → Add disabled with "Limit of 20 items reached". Move a parent with children → subtree follows. Two-step remove cancel/confirm works; removing a feature leaves the others intact.
- [x] Search: literal special characters, uppercase, href-only, whitespace-only (treated as no search), and ancestor-sticky reveal of a nested link while its parent is collapsed all pass; Collapse/Expand all disabled during search.
- [x] Keyboard: Enter commits, Escape discards and blur-after-Escape does not commit; chevron toggles with Enter and `aria-expanded` flips.
- [x] Connector geometry unchanged after the patches: chevron centre 318.8, parent stem x=318.8 from 420.8→457.8, child elbow x=318.8 from 457.8 with 10px radius, all trunks at x=318.8.
- [x] Gates: full typecheck, admin tests **96/96** (3 new sanitizer tests), admin build, comment ratchet 3011/3016.

### Notification bell: mobile layout, read state, retention (2026-11-24)

- [x] Root cause of the mobile glitch: the popover was `absolute; right:0; width:400px; max-width:calc(100vw - 32px)`. With the search button hidden below 680px, its left edge computed to roughly -52px on a 360px screen. A `notificationPopover` class now keeps the desktop behaviour and switches to `position:fixed; top:72px; left:12px; right:12px` below 768px, with viewport-height clamping and a wrapping filter rail.
- [x] Browser QA with seven seeded notifications (one per `kind`): desktop popover 400px wide at x=868; at 768/390/360 the popover sits at x=12 with right edge inside the viewport, pills wrap to two rows, no page-level overflow, and tapping the scrim closes it.
- [x] DB `kind` now maps to real categories (`order`/`cart` → Order & Sales, `payment`/`refund` → Payment, etc.) and tones, so the five filter pills are no longer dead controls. Payment shows payment + refund; System shows only system.
- [x] Clicking a notification awaits the guarded mark-read action before navigating; the badge fell 7 → 6 and `read_at` was set for that row in Postgres. Mark all read cleared the badge and set all seven rows. A failed action now leaves the item unread and shows a `role="alert"` message instead of optimistically lying.
- [x] Retention: `pruneNotifications()` deletes rows older than 30 days, registered as `notifications.pruneOld` and scheduled daily at 03:15 UTC in `tuw-admin/vercel.json`. Manual cron call with `CRON_SECRET` returned `processed: 1` for a 60-day-old QA row; all seven recent rows survived.
- [x] Gates: full typecheck, 96/96 admin tests, admin build, comment ratchet 3011/3016. QA admin and seeded notification rows deleted.

### Admin notification archive (2026-11-24)

- [x] Added `/notifications` as an admin-only archive of stored alerts. Server Component guards with `session.requireStaff('product.update', '/notifications')` and reads up to 200 rows from `listNotifications`. A `NotificationsView` client component filters by category, toggles unread-only, marks single/all rows read through the existing guarded actions, pages results and links to each alert's target.
- [x] Extracted kind→category/tone/time helpers into `tuw-admin/src/lib/notifications.ts` so the bell and the archive share one mapping instead of duplicating it.
- [x] Added a System sidebar entry for Notifications (permission `product.update`) and a page title. Added Support to the same group, with a `contact_form` source badge in the ticket list.
- [x] `/support?ticket=<uuid>` preselects the requested thread, so notification deep links can target a conversation instead of the generic inbox.
- [x] Added a guard test covering the 30-day retention constant, prune job registration and cron entry.
- [x] Browser QA with seven seeded alerts: archive showed 7 rows and `7 unread`; Payment filter showed payment + refund; unread-only kept all 7; marking one read dropped the badge to 6 and the row switched to Read. Deep link selected the requested ticket. No page-level overflow at 360/768/1024/1440 (table scrolls internally below 1024). QA admin, tickets and alerts deleted.
- [x] Storefront-dependent work (contact form → support ticket, customer bell) remains pending in the tracker with an explicit deferral note; no storefront file was touched. Gates: full typecheck, 98/98 admin tests, admin build, comment ratchet 3011/3016.

### Top navigation with mega-menu (2026-11-24)

- [x] The desktop sidebar is gone. Navigation lives in a centered `TopNav` strip below the header with four triggers — Core, Operations, Merchandise, System — between the brand on the left and search/bell/profile on the right. `main` now spans the full viewport width.
- [x] Hover or focus a trigger opens a mega-menu panel centered under the strip (`left:50%; transform:translateX(-50%)`, 920px max). Items render in a responsive grid with icons, active-edge treatment and the fulfillment count badge. Hover switches sections; mouse-leave, outside click and Escape close it.
- [x] The desktop sidebar component survives only as the mobile drawer (≤768px), opened by the existing hamburger and closed on link click or Escape. `TopNav` is hidden on mobile. No navigation is lost at any width.
- [x] Extracted nav groups, permissions and active-path resolution into `tuw-admin/src/lib/admin-nav.ts`, shared by the top nav and the mobile drawer. Added `/discounts: order.view`, which was previously unguarded and leaked to staff without order access.
- [x] Browser QA at 1440/1024/768/360: no desktop sidebar, no page overflow; the Operations mega-menu measured x=255/right=1175 in a 1430px viewport (exactly centered); hover switching, click-to-open, Escape and item navigation to `/orders` all worked; active section highlighted Core on `/dashboard`. Found and fixed a click bug where hover had already opened the menu so the click closed it.
- [x] Three new unit tests cover section inventory, permission filtering and active-path resolution. Gates: full typecheck, 101/101 admin tests, admin build, comment ratchet 3011/3016. QA admin deleted.

### Single-row header cleanup (2026-11-24)

- [x] Removed the separate `TopNav` component and its strip. The four triggers and their mega-menu now live inside `Header`, on the same 80px row as the dark brand and the search/bell/avatar actions. `.topBar` is a three-zone grid so the centre zone is exactly centered (measured centreX = headerCentre = 715 at 1440).
- [x] Replaced the purple logo tile with the existing dark stag asset (`tuw-stag-dark.png`) at 26px; computed background is transparent, no purple square.
- [x] Removed the profile name/role text. Only the avatar remains, with `title`/`aria-label` preserving the login name and role for hover and screen readers.
- [x] Removed the page title from the header. Page headings already exist in `<main>` via each page's `PageHeader` — "Welcome back" was confirmed on Dashboard after the change.
- [x] Mega-menu still centered (x=255/right=1175 in a 1430px viewport) and opens from the merged row. Below 768px the centre zone is hidden and the hamburger drawer still opens and navigates.
- [x] Gates: full typecheck, 101/101 admin tests, admin build, comment ratchet 3011/3016. QA admin deleted.

### Mega-menu close behaviour — rigorous QA (2026-11-24)

Root causes found: `onClick` could not close a menu hover had already opened; the document click-outside listener also fired for clicks inside the nav, making toggles inconsistent; and there was no close on route change, so a stale panel survived navigation while the highlight still followed the previous page.

Fixes: click now always closes an already-open trigger; a suppressed-hover flag prevents the cursor resting over a trigger from reopening after an intentional close; the click-outside listener ignores events inside the nav; route changes clear both open state and rendered panel immediately; menu-item clicks and Escape close and suppress hover until the pointer leaves; and the open section now carries the active trigger style.

QA matrix results (all assertions on `[role="menu"]` count and `aria-expanded`):
- [x] Hover opens exactly one panel; moving off the header closes it within ~200ms.
- [x] Hover then click the same trigger closes it (`menus: 1 → 0`, `aria-expanded true → false`) — the reported defect.
- [x] Hover Core then hover System switches panels with never more than one open; the open trigger is the highlighted one.
- [x] Clicking a menu item navigates to `/orders` and leaves `menus: 0` both immediately and after the route settles; no stale panel.
- [x] Escape closes an open panel; clicking outside the nav closes it.
- [x] 1440/1024/768/360: center zone visible on desktop, hidden on mobile, header stays 80px, no page overflow.
- [x] Gates re-run: full typecheck, 101/101 admin tests, admin build, comment ratchet 3011/3016. QA admin and browser tabs cleaned.

### Popover flicker investigation (2026-11-24)

Two distinct code bugs were found and fixed; no speculative changes were made to notification item handling.

- [x] **Shared animation hook:** `usePopoverAnimation.cancelClose()` unconditionally set phase to `open`, even while the controlling `open` prop was false. Re-entering `.topBarCenter` during the 180ms exit cleared the close timer, but the exit effect (`[open, startExit]`) did not re-run, leaving the panel mounted with `aria-expanded=false`. Added an `openRef` guard and `wasOpen` reset so `cancelClose` is a no-op when the popover is already closing. Verified: hover → click same trigger produces one close with no remount (MutationObserver mount count stayed at 1); hover off then back within 100ms never leaves a stale panel.
- [x] **Notification bell:** the click-outside scrim (`z-40`) and the bell shared a stacking context, so the bell was not the hit target while the panel was open — clicks fell through to the scrim and toggled unexpectedly. Raised `.notificationBtn` to `z-index: 45`. Verified with `elementFromPoint` that the bell receives the click; open → close → reopen → outside-click all produced the expected single state change.
- [x] QA note: the browser served a cached CSS chunk after the rebuild; a hard reload with the fresh chunk was required before the z-index fix took effect. This was a QA artifact, not a product bug.
- [x] A notification with no `href` still keeps the panel open after mark-read (it is read in place); that behaviour was left unchanged because no defect in it was confirmed.
- [x] Gates: full typecheck, 101/101 admin tests, admin build, comment ratchet 3011/3016. QA admin, seeded alert and browser tabs cleaned.

### Support inbox receives real contact tickets (2026-11-27)

- [x] Added heart `createTicket` with a pure validator; it inserts a `contact_form` ticket and its first customer message in one transaction and rings staff with `customer.view` and a deep link to the thread.
- [x] The storefront contact form now creates tickets instead of writing a demo outbox row. Local browser QA confirmed a submitted message appeared in `/support`, preselected via `?ticket=<id>`, with the order reference preserved in the thread.
- [x] Admin suite 104/104 with three new validation tests; both production builds and the comment ratchet pass. QA tickets, notifications and admin were removed afterwards.

### Product editor split and explicit state machines (2026-11-27)

- [x] `ProductsView.tsx` reduced from ~4,047 to ~1,900 lines. Pure helpers, five draft hooks, catalog list/hooks and five editor tab sections live under `products/_components/editor/`; every extracted JSX block is byte-identical to the pre-split source and all `data-field` anchors are preserved.
- [x] Explicit machines: `editorMachine` (closed/opening/create/edit), `asyncMachine` (save/bulk), `importMachine` (idle/preview/importing) and `cards` (14-key record). Reducers are pure; side effects stay in the event handlers.
- [x] Browser QA on local `127.0.0.1:3024`: create drawer, edit drawer, save + "Product Updated", import preview + "Import Staged", HSN validation jump (focus `hsnCode`, pricing card auto-opened), card collapse persistence across tab switches, expand-once into Variants, deep link `?open=<uuid>`, bulk selection, search/filter and view toggle. No console errors; no horizontal overflow at 360/768/1024/1440.
- [x] Gates: full typecheck, 124/124 admin tests, both production builds, comment ratchet 3136/3186.
- [x] Diagnosed the "Operational Interface Interruption" report: a production server had been left running while `next build` replaced `.next`, so cached HTML requested a removed chunk (`1bvq_48zwald4.js` → 500) and the root error boundary rendered. Stop → build → restart restored all 13 chunk requests to 200 and a clean console; no code defect was involved. QA note: never rebuild under a live prod server.

### General settings save fix (2026-11-27)

- [x] Root cause: `toDraft()` sent the read-only `store.currency` field on every General tab save; heart `updateSettings` rejected the whole batch with "This setting is fixed.", so the Monogram previews toggle never persisted. Fixed by excluding `kind: 'fixed'` fields from the save payload; backend read-only validation stays strict.
- [x] Browser QA: Settings → General → Monogram previews ON → Save → "Saved — the storefront now shows the new values."; after reload the switch stays checked, no unsaved banner and no fixed-setting error. Two unit tests added; admin suite 126/126.

### State-machine hardening (2026-11-27, CLN-FSM-08)

- [x] Four read-only audits found 45 heart / 79 admin / 62 storefront / 56 db-distributed machines. Explicit-state model checking confirmed 20 order rank/table divergences (including `delivered → cancelled`), a permanent nav-menu suppression dead-end, personalisation dead controls, refund regression, double webhook claim and a tooltip ghost; all now have executable property tests.
- [x] Canonical transition relations live in `packages/heart/src/platform/status/index.ts`; migrations 037/040/041 seed `state_transitions` and install BEFORE UPDATE triggers so forbidden transitions are rejected in SQL. `expirePendingPayment` can no longer cancel a shipped/delivered order; admin status changes report CAS conflicts.
- [x] Refund webhook cannot demote `completed`; gift-card reversals cover every unit; zero-difference exchanges are auto-submitted; claim wallet credit is posted at resolution. Job claims (`FOR UPDATE SKIP LOCKED`) and idempotency takeover are transactional; late `complete()` cannot overwrite the winner.
- [x] Admin and storefront UI FSMs have reachable exits (`RESET_SUPPRESSION`, `RESET → inactive`, guarded `APPROVED`, request-id tracked saves, cancel-during-import marker, tooltip timer cancellation); async flags use `try/finally`; blob URLs and timers are cleaned up. Reset Demo controls exist in both shells.
- [x] Cron consolidated to two Hobby-compatible aggregate jobs; settings seed no longer drifts from the registry.
- [x] Gates: full `pnpm typecheck`, `pnpm test` (heart 249/249, admin 135/135, website 84/84), both production builds, comment ratchet 3129/3186.

### Qikink integration goal (2026-11-28)

- [x] Demo-only previews use existing local `/images/pdp-figma/...` mockups: shirt front/back/side, mug front/handle-side/on-desk, bottles/coasters, kids and hoodie images. Angle selector (Front/Back/Side/Wrap) + text overlay verified in the browser; preview route returns `image/svg+xml` and the UI keeps the truthful "no design file is uploaded" notice.
- [x] Admin `Products → Categories` renders two plug-in slots: Qikink SKU CSV import and per-category demo preview templates, both stored in namespaced settings / `provider_product_mappings`. No core edits beyond slot lines and one server action.
- [x] Heart Qikink adapter normalises per-order designs to snake_case (`design_code`, `width_inches`, `height_inches`, `placement_sku`, `design_link`, `mockup_link`), selects print type per category, retries a stale token once on 401, throttles to 30 req/min, and refuses local `/` URLs as design links when real keys are configured. Store-SKU lines remain unchanged.
- [x] Browser QA at 127.0.0.1:3007: PDP monogram panel, angle switch to Back, text `UK`, generated `/api/previews?...` URL, demo notice and Approve button all present; admin categories slots render without console errors.
- [x] Load test (`pnpm load:check`, autocannon 9): 12 scenarios × 10 s at 1/10/50/100 connections across storefront home, preview API and admin products — 0 errors, 0 5xx. Preview API p99 190 ms at 100 connections; storefront home p99 4.7 s at 100 connections (cached prerender + Neon round trips).
- [ ] **Blocked:** `pnpm qikink:sandbox` cannot create a sandbox order — `POST /api/token` returns `401 Invalid client_id or client_secret` from `https://sandbox.qikink.com`. The configured keys are present but stale or environment-mismatched. No order was sent, and no live API call was attempted. Owner must issue fresh sandbox keys before the end-to-end sandbox order can be verified.

### Local preview photos and print zones (2026-11-28)

- [x] Four supplied mock photos shipped inside `tuw-website/src/storefront/plugins/personalization/assets/` (Front/default, Back, Left Pocket) with a `.gitignore` negation; print zones map the existing artwork area so the monogram replaces it instead of printing below the garment.
- [x] Browser check: Front preview shows `UK` on the shirt chest with the caption in a separate strip; Left Pocket preview shows `UK` inside the pocket area; both verified from screenshots at `127.0.0.1:3007`.
- [x] Local-disk `ObjectStore` adapter in `packages/heart/src/integrations/storage/index.ts` sits behind the existing interface; uploads go to git-ignored `.data/personalization/`, served via `/api/personalization/assets/[key]`; swapping to R2 or a worker later requires one factory change.
- [x] "Use your photo" upload control replaces the base mock image for the demo preview and states clearly that nothing is sent to a print provider. Real API orders still refuse local `/` URLs when keys are present.
- [x] Gates: typecheck, full `pnpm test` (heart 259, admin 154, website 89), both builds, comment ratchet 3129/3186.
