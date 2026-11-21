-- Retry jobs need the normalized event, not the provider's raw envelope.
-- Keep the raw body for audit; store the dispatchable event in payload.
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS raw_payload jsonb;
