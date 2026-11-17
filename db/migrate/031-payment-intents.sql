-- Payment intents: the bridge between our checkout key and a provider order
-- (Razorpay Orders API today; any provider tomorrow). One intent per checkout
-- attempt, keyed by both our key and the provider's order id.
CREATE TABLE payment_intents (
  id                    uuid          PRIMARY KEY,
  checkout_key          uuid          NOT NULL UNIQUE,
  provider              varchar(30)   NOT NULL REFERENCES integration_providers (slug)
                          ON UPDATE CASCADE ON DELETE RESTRICT,
  provider_order_id     varchar(150)  NOT NULL UNIQUE,
  order_id              uuid          REFERENCES orders (id) ON DELETE SET NULL,
  amount_paise          bigint        NOT NULL CHECK (amount_paise > 0),
  currency              char(3)       NOT NULL DEFAULT 'INR',
  status                varchar(20)   NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','paid','failed','expired','cancelled')),
  payment_id            varchar(150),
  signature_verified_at timestamptz,
  attempts              smallint      NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  note                  varchar(500),
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),
  paid_at               timestamptz
);
CREATE INDEX idx_payment_intents_status ON payment_intents (status, created_at);
CREATE INDEX idx_payment_intents_order ON payment_intents (order_id) WHERE order_id IS NOT NULL;
