INSERT INTO state_transitions (machine, from_state, to_state) VALUES
  ('refunds.status', 'rejected', 'completed')
ON CONFLICT DO NOTHING;
