ALTER TABLE gift_card_transactions ADD COLUMN IF NOT EXISTS order_item_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS one_gift_card_reversal_per_order_item
  ON gift_card_transactions (gift_card_id, order_item_id)
  WHERE order_item_id IS NOT NULL AND type = 'reversal';
