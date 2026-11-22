-- Hàng đợi gửi tin Zalo cá nhân: app xếp tin, worker zca-js (giữ phiên Zalo) nhận, gửi rồi báo kết quả.
CREATE TABLE IF NOT EXISTS zalo_outbox (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  psid TEXT NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  error TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS zalo_outbox_queue_idx ON zalo_outbox (page_id, status, created_at);

-- Một worker đang sống: app từ chối nhận tin gửi khi worker không báo trong vài giây.
CREATE TABLE IF NOT EXISTS zalo_worker (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  own_id TEXT NOT NULL,
  last_seen_at BIGINT NOT NULL
);
