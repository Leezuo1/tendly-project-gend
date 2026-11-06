CREATE TABLE IF NOT EXISTS sourcing_runs (
  id uuid PRIMARY KEY,
  owner text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('tiktok', 'suppliers')),
  status text NOT NULL CHECK (status IN ('starting', 'running', 'succeeded', 'empty', 'failed', 'unknown')),
  context_json jsonb NOT NULL,
  provider_run_id text,
  result_json jsonb,
  error text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS sourcing_runs_owner ON sourcing_runs(owner, kind, created_at DESC);

CREATE TABLE IF NOT EXISTS sourcing_start_limits (
  owner text NOT NULL,
  kind text NOT NULL,
  next_start_at bigint NOT NULL,
  PRIMARY KEY (owner, kind)
);
