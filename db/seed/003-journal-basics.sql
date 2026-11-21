-- Baseline journal taxonomy so posts can be created before staff adds more.
INSERT INTO blog_categories (id, name, slug, description, sort_order)
VALUES ('00000000-0000-4000-8000-000000000a01', 'Journal', 'journal', 'Stories from the studio', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO blog_authors (id, name, slug, role_title, is_active)
VALUES ('00000000-0000-4000-8000-000000000a02', 'The Unplugged Wear', 'the-unplugged-wear', 'Studio', true)
ON CONFLICT (id) DO NOTHING;
