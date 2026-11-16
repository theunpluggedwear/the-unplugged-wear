-- Gift-card management permission (TL-BE-12). Admin role holds every
-- permission via the seed's CROSS JOIN, so re-running the seed heals grants.
INSERT INTO permissions (id, name, slug, description)
VALUES ('00000000-0000-4000-8000-000000000216', 'Manage gift cards', 'giftcard.manage',
        'Issue, disable and adjust gift cards and read their ledger')
ON CONFLICT (slug) DO NOTHING;