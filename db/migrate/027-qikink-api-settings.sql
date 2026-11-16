-- 027-qikink-api-settings.sql — one base URL, verified auth contract
-- Source: live probe against sandbox.qikink.com, 2026-11-16
-- (recorded in DOC/backend/16 §8):
--   * POST /api/token reads form-urlencoded ClientId + client_secret;
--   * every authenticated call needs BOTH `Accesstoken` and `ClientId` headers;
--   * GET /api/order lists this store's orders, ?order_id= takes Qikink's
--     numeric id;
--   * the keys issued to this store are SANDBOX keys — api.qikink.com answers
--     401 "Invalid client_id or client_secret" for them.
--
-- The adapter therefore has one base URL (env QIKINK_BASE_URL) and no mode
-- switch. This migration only tidies the non-secret settings the registry
-- stores: drop the old two-URL shape, record the URL the keys belong to, and
-- keep the row in 'sandbox' until Qikink issues live credentials.

UPDATE integration_providers
SET settings = (settings - 'sandboxBaseUrl' - 'liveBaseUrl')
      || jsonb_build_object(
           'baseUrl', 'https://sandbox.qikink.com',
           'defaultPrintTypeId', COALESCE((settings->>'defaultPrintTypeId')::int, 1),
           'liveKeysPending', true
         ),
    updated_at = now()
WHERE slug = 'qikink';
