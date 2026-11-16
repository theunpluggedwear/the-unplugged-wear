-- Remove indexes that duplicate a UNIQUE constraint or cannot serve any
-- current query shape (TL-BE-17 index audit). Safe re-runnable drops.
DROP INDEX IF EXISTS idx_blog_categories_slug;
DROP INDEX IF EXISTS idx_design_assets_media_id;
DROP INDEX IF EXISTS idx_blogs_public_featured;
DROP INDEX IF EXISTS idx_brands_active;
DROP INDEX IF EXISTS idx_blog_authors_is_active;
DROP INDEX IF EXISTS idx_products_slug_aliases;