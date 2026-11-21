-- Operational fields on the durable webhook inbox (TL-INT-RAZORPAY).
ALTER TABLE webhook_events
  ADD COLUMN IF NOT EXISTS business_ref varchar(150),
  ADD COLUMN IF NOT EXISTS amount_paise bigint,
  ADD COLUMN IF NOT EXISTS currency char(3),
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_webhook_events_retry
  ON webhook_events (status, next_attempt_at) WHERE status = 'failed';
