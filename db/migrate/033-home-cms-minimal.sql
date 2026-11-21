DELETE FROM cms_sections WHERE page_key = 'home' AND key NOT IN ('home-featured', 'home-journal');

INSERT INTO cms_sections (id, key, page_key, type, title, content, settings, sort_order, is_active)
VALUES
  ('00000000-0000-4000-8000-000000000b02', 'home-featured', 'home', 'featured_products', 'Explore the Collection',
   '{"mode":"latest","count":3,"productIds":[]}'::jsonb, '{}'::jsonb, 10, true),
  ('00000000-0000-4000-8000-000000000b03', 'home-journal', 'home', 'blog_teaser', 'From the Journal',
   '{"mode":"latest","count":3,"postIds":[],"categorySlug":null}'::jsonb, '{}'::jsonb, 20, true)
ON CONFLICT (key) DO UPDATE SET
  page_key = EXCLUDED.page_key,
  type = EXCLUDED.type,
  content = EXCLUDED.content,
  settings = EXCLUDED.settings,
  is_active = true,
  updated_at = now();
