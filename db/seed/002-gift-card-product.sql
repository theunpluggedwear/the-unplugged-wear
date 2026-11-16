-- Demo gift-card product so the storefront purchase flow is testable.
-- One denomination (₹1000); staff can add more variants in the admin.
INSERT INTO products (
  id, sku, name, slug, short_description, description, price, stock,
  product_kind, exchange_policy, status, photo_settings, source, external_id,
  monogram_enabled, monogram_max_chars, monogram_upcharge, details, price_is_draft,
  slug_aliases, created_at, updated_at
) VALUES (
  '00000000-0000-4000-8000-000000000900', 'GIFT-1000', 'The Unplugged Wear Gift Card',
  'gift-card', 'A thoughtful gift, delivered by email.',
  'A digital gift card that never gets printed or shipped. The recipient receives a code by email and can use it at checkout. Valid for six months from issue.',
  1000, 999999, 'gift_card', 'defects_only', 'active', '{}'::jsonb, 'local', 'gift-card',
  false, 2, 0, '{}'::text[], false, '{}'::varchar(280)[], now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_variants (id, product_id, sku, variant_key, price, price_overridden, stock, is_active)
VALUES ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000900',
        'GIFT-1000', 'One size', 1000, false, 999999, true)
ON CONFLICT (id) DO NOTHING;
