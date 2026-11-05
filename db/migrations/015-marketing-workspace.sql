CREATE TABLE IF NOT EXISTS marketing_workspaces (
  page_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  document JSONB NOT NULL,
  updated_at BIGINT NOT NULL
);
