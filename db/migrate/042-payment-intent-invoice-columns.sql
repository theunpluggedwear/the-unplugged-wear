ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS provider_invoice_id varchar(150);
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS provider_invoice_url text;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS provider_invoice_status varchar(30);
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS provider_invoice_expires_at bigint;
