INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.slug IN ('giftcard.manage', 'content.manage')
WHERE r.slug = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO store_settings (key, value)
VALUES ('fulfillment.auto_submit', to_jsonb(true))
ON CONFLICT (key) DO NOTHING;
