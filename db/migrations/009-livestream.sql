-- Livestream: phiên live, bình luận đã phân loại, nhóm trả lời và đơn nháp. Chạy lại nhiều lần vẫn an toàn.
CREATE TABLE IF NOT EXISTS live_sessions (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('demo', 'facebook')),
  source_kind TEXT CHECK (source_kind IN ('live_video', 'post')),
  source_id TEXT,
  -- ID bài đăng của nguồn (pageId_xxx) để luồng bình luận Fanpage bỏ qua bình luận của phiên live
  source_post_id TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('live', 'ended')),
  on_air_sku TEXT,
  knowledge_json JSONB NOT NULL,
  started_at BIGINT NOT NULL,
  ended_at BIGINT,
  synced_at BIGINT NOT NULL DEFAULT 0,
  ai_calls INTEGER NOT NULL DEFAULT 0,
  summary_json JSONB
);
CREATE INDEX IF NOT EXISTS live_sessions_page ON live_sessions (page_id, started_at);

CREATE TABLE IF NOT EXISTS live_comments (
  session_id TEXT NOT NULL REFERENCES live_sessions (id) ON DELETE CASCADE,
  comment_id TEXT NOT NULL,
  author_id TEXT NOT NULL DEFAULT '',
  author_name TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  received_at BIGINT NOT NULL,
  intent TEXT NOT NULL,
  sku TEXT,
  color TEXT,
  size TEXT,
  qty INTEGER,
  group_key TEXT,
  ai_checked BOOLEAN NOT NULL DEFAULT false,
  reply_status TEXT NOT NULL DEFAULT 'none'
    CHECK (reply_status IN ('none', 'review', 'sending', 'sent', 'unknown', 'failed', 'not_allowed')),
  reply_text TEXT,
  message_id TEXT,
  sent_at BIGINT,
  PRIMARY KEY (session_id, comment_id)
);
CREATE INDEX IF NOT EXISTS live_comments_group ON live_comments (session_id, group_key);

CREATE TABLE IF NOT EXISTS live_groups (
  session_id TEXT NOT NULL REFERENCES live_sessions (id) ON DELETE CASCADE,
  group_key TEXT NOT NULL,
  intent TEXT NOT NULL,
  sku TEXT,
  reply_text TEXT NOT NULL DEFAULT '',
  reply_source TEXT NOT NULL DEFAULT 'template' CHECK (reply_source IN ('template', 'ai', 'ai_pending', 'shop')),
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (session_id, group_key)
);

CREATE TABLE IF NOT EXISTS live_orders (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES live_sessions (id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  items_json JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'awaiting_info', 'confirmed', 'cancelled')),
  comment_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE (session_id, customer_id)
);
