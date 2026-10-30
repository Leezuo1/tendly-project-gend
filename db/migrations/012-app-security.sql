CREATE TABLE IF NOT EXISTS app_security_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  protection_enabled boolean NOT NULL DEFAULT true,
  revision bigint NOT NULL DEFAULT 1,
  updated_at bigint NOT NULL,
  updated_by text NOT NULL DEFAULT 'system',
  automatic_after bigint NOT NULL
);
INSERT INTO app_security_settings(id, updated_at, automatic_after)
VALUES (1, (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint,
  (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash text PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('admin', 'user')),
  username text NOT NULL,
  credential_hash text NOT NULL,
  expires_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS app_sessions_expiry ON app_sessions(expires_at);

CREATE TABLE IF NOT EXISTS app_login_attempts (
  bucket text PRIMARY KEY,
  attempts integer NOT NULL,
  reset_at bigint NOT NULL
);
