-- Content/CMS management permission (TL-BE-13). Admin role receives all
-- permissions automatically through the seed's CROSS JOIN.
INSERT INTO permissions (id, name, slug, description)
VALUES ('00000000-0000-4000-8000-000000000217', 'Manage content', 'content.manage',
        'Edit CMS pages, navigation, theme, journal and FAQs')
ON CONFLICT (slug) DO NOTHING;