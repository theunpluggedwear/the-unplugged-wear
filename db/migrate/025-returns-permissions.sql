-- 025-returns-permissions.sql — the RMA board needs its own permissions.
-- Until now returns had no staff permission at all (TL-BE-10). Viewing a
-- request is support/warehouse work; approving, restocking and refunding is
-- an admin decision. Keep this file in step with db/seed/001-seed-core.sql
-- so a migrated database and a freshly seeded one hold the same rows.
INSERT INTO permissions (id, name, slug, description) VALUES
  ('00000000-0000-4000-8000-000000000214', 'View returns',    'return.view',
   'Read exchange and replacement requests, their lines and timelines'),
  ('00000000-0000-4000-8000-000000000215', 'Manage returns',  'return.manage',
   'Approve or reject requests, set dispositions and refund differences')
ON CONFLICT DO NOTHING;

-- Admin holds every permission; the seed does this with a cross join, a
-- migration has to name the two rows it just added.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.slug IN ('return.view', 'return.manage')
WHERE r.slug = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.slug = 'return.view'
WHERE r.slug IN ('support', 'warehouse')
ON CONFLICT DO NOTHING;
