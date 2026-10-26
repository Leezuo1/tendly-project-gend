CREATE TABLE IF NOT EXISTS facebook_comment_settings (
  page_id text PRIMARY KEY,
  auto_reply boolean NOT NULL DEFAULT false,
  knowledge_json jsonb NOT NULL,
  updated_at bigint NOT NULL,
  enabled_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS facebook_comments (
  page_id text NOT NULL,
  comment_id text NOT NULL,
  post_id text NOT NULL,
  author_id text NOT NULL DEFAULT '',
  author_name text NOT NULL DEFAULT '',
  text text NOT NULL DEFAULT '',
  created_at bigint NOT NULL,
  event_at bigint NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending','processing','review','ignored','sending','sent','unknown','failed','deleted')),
  processing_at bigint,
  post_text text NOT NULL DEFAULT '',
  draft text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  message_id text,
  recipient_id text,
  sent_at bigint,
  PRIMARY KEY (page_id,comment_id)
);
CREATE INDEX IF NOT EXISTS facebook_comments_queue ON facebook_comments(page_id,status,created_at);
