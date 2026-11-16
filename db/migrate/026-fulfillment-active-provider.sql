-- 026-fulfillment-active-provider.sql — switch fulfilment on (TL-BE-11).
-- Until now every fulfilment provider row was inactive, so no order could be
-- submitted anywhere. Qikink runs in SANDBOX: with no QIKINK_CLIENT_ID /
-- QIKINK_CLIENT_SECRET in env the adapter is the simulator (nothing leaves the
-- app); the moment those two vars exist the same adapter talks to
-- sandbox.qikink.com or api.qikink.com (QIKINK_MODE=live). No other edit is
-- needed to go live.
--
-- Custom Atelier is in-house fulfilment: staff print and add tracking by hand,
-- so it is real work, not a sandbox and not a simulator.
--
-- Settings hold only non-secret configuration; the keys stay in env
-- (DOC/backend/16 §1). Keep this file in step with db/seed/001-seed-core.sql.
UPDATE integration_providers
SET is_active = true,
    settings = settings || '{
      "sandboxBaseUrl": "https://sandbox.qikink.com",
      "liveBaseUrl": "https://api.qikink.com",
      "defaultPrintTypeId": 1
    }'::jsonb,
    updated_at = now()
WHERE slug = 'qikink';

UPDATE integration_providers
SET is_active = true,
    updated_at = now()
WHERE slug = 'custom_atelier';
