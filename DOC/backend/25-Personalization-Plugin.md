# Personalisation plugin — toggle and removal

Status: Active | Added 2026-11-27

The monogram/preview feature is a removable plugin. Core code talks to a port;
the plugin implements it. No app imports another app's source.

## Toggle it off (no code changes)

1. Admin → Settings → General → **Monogram previews** off. This writes
   `features.personalization` to `store_settings`. The storefront hides the PDP
   panel and the bag approval affordance, and `approveBagPreviewAction` refuses.
2. Hard kill at deploy time: set `TUW_DISABLED_PLUGINS=personalization`. The
   heart registry then returns no plugin, so cart/catalog fall back to plain
   lines even if the setting is on.

Both switches are independent: the admin setting controls UI and the action;
the env var unregisters the implementation everywhere.

## Remove it from the codebase

Delete these paths only — no core edits are required:

- `packages/heart/src/modules/personalization/`
- `tuw-admin/src/plugins/personalization/`
- `tuw-website/src/storefront/plugins/personalization/`
- `tuw-website/src/app/api/previews/route.ts`

Then remove the single registration import in each app that imports the heart
plugin (`tuw-website/src/server/cart-actions.ts`,
`tuw-website/src/server/catalog.ts`) and the plugin UI imports:
- `tuw-admin/src/app/(dashboard)/products/_components/editor/sections/SpecsTab.tsx`
- `tuw-website/src/storefront/components/commerce/VariantSelector.tsx`
- `tuw-website/src/storefront/components/commerce/BagLine.tsx`
- `tuw-website/src/app/cart/page.tsx`
- `tuw-website/src/app/checkout/page.tsx`

Core keeps a no-op default: cart ignores `personalization` payloads, checkout
has no preview blocker, and catalog products no longer expose `monogram`.

Optional data cleanup (only after old carts/orders no longer need the fields):
a new migration in `db/migrate/` dropping `personalization`,
`preview_image_url` and `preview_approved_at` from `cart_items` and
`order_items`, plus the related CHECK and unique constraints. Do not edit an
existing migration.

Finally remove `features.personalization` from
`packages/heart/src/modules/settings/keys.ts`, the seed row in
`db/seed/001-seed-core.sql`, the admin Settings field and
`TUW_DISABLED_PLUGINS` from `DOC/backend/23-Backend-Implementation.md`.

## Verification after removal

`pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm lint:comments`. A grep for
`personalization|monogram|previewImageUrl` across the three `src/` trees should
return no source matches (migrations and seed fixtures are expected to remain
unless the cleanup migration was applied).
