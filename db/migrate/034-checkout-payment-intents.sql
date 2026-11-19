ALTER TABLE payment_intents
  ALTER COLUMN provider_order_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS provider_payment_id varchar(150),
  ADD COLUMN IF NOT EXISTS payload jsonb,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
