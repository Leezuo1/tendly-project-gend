CREATE TABLE IF NOT EXISTS app_users (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE CHECK (username = lower(btrim(username))),
  name text NOT NULL,
  password_hash text NOT NULL,
  page_id text,
  created_at bigint NOT NULL
);

-- Public demo credentials; the Page binding is filled from server config by the migration runner.
INSERT INTO app_users(id,username,name,password_hash,created_at)
VALUES ('demo','admin','Demo Tendly',
  'scrypt-v1$2f00575075a6291da4d3b18a70bf9dcd$f07427cd34a672fdcda99841fbf9fd8da2be9dd2611b3bec580912dec27166792c3947b5d47dd0f9d227a7dc158c6a27692d88ee9a1e42b532acd8af41b0a265',
  (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint)
ON CONFLICT DO NOTHING;

ALTER TABLE app_sessions ADD COLUMN IF NOT EXISTS user_id text REFERENCES app_users(id) ON DELETE CASCADE;
