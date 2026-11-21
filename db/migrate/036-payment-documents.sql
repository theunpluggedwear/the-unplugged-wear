-- Generic invoice/payment-document layer (plug-and-play invoice providers).
-- One internal order can have one active payment document. Provider-specific
-- fields are stored in raw_payload; the business logic only uses neutral ones.

ALTER TABLE integration_providers
  DROP CONSTRAINT IF EXISTS integration_providers_category_check;
ALTER TABLE integration_providers
  ADD CONSTRAINT integration_providers_category_check
  CHECK (category IN ('payment','invoice','fulfillment','shipping','email','sms','other'));

CREATE TABLE IF NOT EXISTS payment_documents (
  id                    uuid          PRIMARY KEY,
  payment_intent_id     uuid          NOT NULL REFERENCES payment_intents (id) ON DELETE RESTRICT,
  order_id              uuid          NOT NULL REFERENCES orders (id) ON DELETE RESTRICT,
  provider              varchar(30)   NOT NULL,
  document_type         varchar(30)   NOT NULL DEFAULT 'payment_invoice'
    CHECK (document_type IN ('payment_invoice','gst_invoice','credit_note')),
  provider_document_id  varchar(150),
  provider_order_id     varchar(150),
  provider_payment_id   varchar(150),
  url                   text,
  status                varchar(30)   NOT NULL
    CHECK (status IN ('draft','issued','partially_paid','paid','expired','cancelled','failed')),
  amount_paise          bigint        NOT NULL CHECK (amount_paise > 0),
  currency              varchar(3)    NOT NULL DEFAULT 'INR',
  expires_at            timestamptz,
  issued_at             timestamptz,
  paid_at               timestamptz,
  idempotency_key       varchar(255)  NOT NULL,
  raw_payload           jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),

  UNIQUE (provider, provider_document_id),
  UNIQUE (payment_intent_id, document_type),
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_payment_documents_order_id ON payment_documents (order_id);
CREATE INDEX IF NOT EXISTS idx_payment_documents_status ON payment_documents (status, created_at);

INSERT INTO integration_providers (id, slug, name, category, environment, is_active, capabilities, settings)
VALUES
  ('00000000-0000-4000-8000-000000100201', 'mock_invoice', 'Mock Invoice', 'invoice', 'sandbox', false,
   '{"create":true,"issue":true,"fetch":true,"cancel":true,"webhooks":false,"hostedUrl":true,"pdf":false,"taxLines":false}', '{}'),
  ('00000000-0000-4000-8000-000000100202', 'razorpay_invoice', 'Razorpay Invoice', 'invoice', 'sandbox', true,
   '{"create":true,"issue":true,"fetch":true,"cancel":true,"webhooks":true,"hostedUrl":true,"pdf":false,"taxLines":false}', '{}')
ON CONFLICT (slug) DO NOTHING;
