CREATE TABLE IF NOT EXISTS messenger_outbound_requests (
  page_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  psid TEXT NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sending', 'sent', 'failed', 'unknown')),
  message_id TEXT,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (page_id, request_id)
);
