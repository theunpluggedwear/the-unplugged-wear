-- Baseline home page sections (TL-WEB-BE-30). Re-runnable.
INSERT INTO cms_sections (id, key, page_key, type, title, content, settings, sort_order, is_active)
VALUES
  ('00000000-0000-4000-8000-000000000b01', 'home-hero', 'home', 'hero', 'Architectural Form. Pure Permanence.',
   '{"slides":[{"title":"Architectural Form. Pure Permanence.","subtitle":"Dense 500 GSM organic essentials, tailored on-demand.","ctas":[{"label":"Shop Collection","href":"/shop"},{"label":"The Manifesto","href":"/about"}]}]}'::jsonb,
   '{}'::jsonb, 0, true),
  ('00000000-0000-4000-8000-000000000b02', 'home-featured', 'home', 'featured_products', 'Explore the Collection',
   '{}'::jsonb, '{}'::jsonb, 10, true),
  ('00000000-0000-4000-8000-000000000b03', 'home-journal', 'home', 'blog_teaser', 'From the Journal',
   '{}'::jsonb, '{}'::jsonb, 20, true),
  ('00000000-0000-4000-8000-000000000b04', 'home-brands', 'home', 'brands', 'What we stand for',
   '{"brands":["Cotton","Slow living","Printed to order"]}'::jsonb, '{}'::jsonb, 30, true)
ON CONFLICT (id) DO NOTHING;
