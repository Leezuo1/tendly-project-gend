CREATE TABLE IF NOT EXISTS sourcing_requests (
  id UUID PRIMARY KEY,
  owner TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  criteria_json JSONB NOT NULL,
  plan_json JSONB NOT NULL,
  approved_at BIGINT,
  run_id UUID UNIQUE REFERENCES sourcing_runs(id),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sourcing_requests_owner ON sourcing_requests(owner,updated_at DESC);
CREATE TABLE IF NOT EXISTS sourcing_decisions (
  owner TEXT NOT NULL,
  run_id UUID NOT NULL REFERENCES sourcing_runs(id),
  item_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('shortlist','checked','rejected')),
  note TEXT NOT NULL DEFAULT '',
  updated_at BIGINT NOT NULL,
  PRIMARY KEY(owner,run_id,item_key)
);
