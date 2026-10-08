CREATE TABLE IF NOT EXISTS messenger_customers (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  psid TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  UNIQUE (page_id, psid)
);

CREATE TABLE IF NOT EXISTS messenger_conversations (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE REFERENCES messenger_customers(id),
  page_id TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  last_message_at BIGINT,
  last_in_at BIGINT,
  last_out_at BIGINT
);

CREATE TABLE IF NOT EXISTS messenger_messages (
  page_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES messenger_conversations(id),
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  sent_at BIGINT NOT NULL,
  received_at BIGINT NOT NULL,
  text TEXT NOT NULL,
  attachments_json JSONB NOT NULL,
  PRIMARY KEY (page_id, message_id)
);

CREATE INDEX IF NOT EXISTS messenger_messages_conversation_time
  ON messenger_messages (conversation_id, sent_at);
