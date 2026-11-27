INSERT INTO state_transitions (machine, from_state, to_state) VALUES
  ('orders.status', 'confirmed', 'shipped')
ON CONFLICT DO NOTHING;
