CREATE TABLE IF NOT EXISTS shopee_connection (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  partner_id TEXT NOT NULL,
  shop_id TEXT NOT NULL,
  sandbox BOOLEAN NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  shop_name TEXT NOT NULL DEFAULT '',
  products_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_synced_at BIGINT NOT NULL DEFAULT 0,
  sync_count INTEGER NOT NULL DEFAULT 0
);
