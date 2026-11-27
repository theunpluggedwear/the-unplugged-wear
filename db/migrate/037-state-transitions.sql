CREATE TABLE IF NOT EXISTS state_transitions (
  machine    varchar(30) NOT NULL,
  from_state varchar(30) NOT NULL,
  to_state   varchar(30) NOT NULL,
  PRIMARY KEY (machine, from_state, to_state)
);

INSERT INTO state_transitions (machine, from_state, to_state) VALUES
  ('orders.status', 'pending', 'confirmed'),
  ('orders.status', 'pending', 'cancelled'),
  ('orders.status', 'confirmed', 'processing'),
  ('orders.status', 'confirmed', 'cancelled'),
  ('orders.status', 'processing', 'shipped'),
  ('orders.status', 'processing', 'cancelled'),
  ('orders.status', 'shipped', 'delivered'),
  ('orders.status', 'failed', 'confirmed'),
  ('orders.status', 'failed', 'cancelled')
ON CONFLICT DO NOTHING;

INSERT INTO state_transitions (machine, from_state, to_state) VALUES
  ('orders.payment_status', 'pending', 'paid'),
  ('orders.payment_status', 'pending', 'failed'),
  ('orders.payment_status', 'pending', 'refunded'),
  ('orders.payment_status', 'paid', 'refunded')
ON CONFLICT DO NOTHING;

INSERT INTO state_transitions (machine, from_state, to_state) VALUES
  ('refunds.status', 'processing', 'completed'),
  ('refunds.status', 'processing', 'rejected')
ON CONFLICT DO NOTHING;

INSERT INTO state_transitions (machine, from_state, to_state) VALUES
  ('returns.status', 'requested', 'approved'),
  ('returns.status', 'requested', 'rejected'),
  ('returns.status', 'requested', 'cancelled'),
  ('returns.status', 'approved', 'pickup_scheduled'),
  ('returns.status', 'approved', 'in_transit'),
  ('returns.status', 'approved', 'completed'),
  ('returns.status', 'approved', 'cancelled'),
  ('returns.status', 'pickup_scheduled', 'in_transit'),
  ('returns.status', 'pickup_scheduled', 'cancelled'),
  ('returns.status', 'in_transit', 'received'),
  ('returns.status', 'in_transit', 'cancelled'),
  ('returns.status', 'received', 'inspected'),
  ('returns.status', 'received', 'completed'),
  ('returns.status', 'inspected', 'completed'),
  ('returns.status', 'inspected', 'disputed'),
  ('returns.status', 'disputed', 'completed')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION assert_state_transition() RETURNS trigger AS $$
DECLARE
  machine_name varchar(30);
  old_state varchar(30);
  new_state varchar(30);
BEGIN
  machine_name := TG_ARGV[0];
  old_state := to_jsonb(OLD) ->> TG_ARGV[1];
  new_state := to_jsonb(NEW) ->> TG_ARGV[1];
  IF old_state IS DISTINCT FROM new_state THEN
    IF NOT EXISTS (
      SELECT 1 FROM state_transitions s
      WHERE s.machine = machine_name AND s.from_state = old_state AND s.to_state = new_state
    ) THEN
      RAISE EXCEPTION 'invalid transition %: % -> %', machine_name, old_state, new_state
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_status_transition ON orders;
CREATE TRIGGER orders_status_transition
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION assert_state_transition('orders.status', 'status');

DROP TRIGGER IF EXISTS orders_payment_status_transition ON orders;
CREATE TRIGGER orders_payment_status_transition
  BEFORE UPDATE OF payment_status ON orders
  FOR EACH ROW EXECUTE FUNCTION assert_state_transition('orders.payment_status', 'payment_status');

DROP TRIGGER IF EXISTS refunds_status_transition ON refunds;
CREATE TRIGGER refunds_status_transition
  BEFORE UPDATE OF status ON refunds
  FOR EACH ROW EXECUTE FUNCTION assert_state_transition('refunds.status', 'status');

DROP TRIGGER IF EXISTS returns_status_transition ON returns;
CREATE TRIGGER returns_status_transition
  BEFORE UPDATE OF status ON returns
  FOR EACH ROW EXECUTE FUNCTION assert_state_transition('returns.status', 'status');

ALTER TABLE order_status_history
  DROP CONSTRAINT IF EXISTS order_status_history_from_status_check,
  ADD CONSTRAINT order_status_history_from_status_check
    CHECK (from_status IN ('pending','confirmed','processing','shipped','delivered','cancelled','failed','refunded')),
  DROP CONSTRAINT IF EXISTS order_status_history_to_status_check,
  ADD CONSTRAINT order_status_history_to_status_check
    CHECK (to_status IN ('pending','confirmed','processing','shipped','delivered','cancelled','failed','refunded'));
