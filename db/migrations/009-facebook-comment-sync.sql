CREATE TABLE IF NOT EXISTS facebook_comment_sync (
  page_id text PRIMARY KEY,
  retry_after bigint NOT NULL,
  synced_at bigint,
  error text
);
