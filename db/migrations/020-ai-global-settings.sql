CREATE TABLE IF NOT EXISTS ai_global_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  document jsonb,
  revision integer NOT NULL DEFAULT 0,
  updated_at bigint NOT NULL DEFAULT 0,
  updated_by text NOT NULL DEFAULT ''
);
INSERT INTO ai_global_settings(id) VALUES (1) ON CONFLICT (id) DO NOTHING;
