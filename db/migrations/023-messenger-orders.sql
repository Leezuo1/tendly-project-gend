-- Orders per Messenger customer. Keyed by (page_id, psid) with no FK so history can exist before the first message.
-- No personal data here: contact details belong to the later chat-order step, encrypted and kept apart.
CREATE TABLE IF NOT EXISTS messenger_orders (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  psid TEXT NOT NULL,
  items_json JSONB NOT NULL,
  total BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  is_mock BOOLEAN NOT NULL DEFAULT false,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS messenger_orders_customer ON messenger_orders (page_id, psid, created_at DESC);
