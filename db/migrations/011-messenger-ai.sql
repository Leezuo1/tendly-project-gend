CREATE TABLE IF NOT EXISTS messenger_ai_settings (
  page_id TEXT PRIMARY KEY,
  auto_reply BOOLEAN NOT NULL DEFAULT false,
  knowledge_json JSONB NOT NULL,
  updated_at BIGINT NOT NULL,
  enabled_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS messenger_ai_jobs (
  page_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES messenger_conversations(id),
  sent_at BIGINT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing','ready','review','sending','sent','unknown')),
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (page_id,message_id)
);
CREATE INDEX IF NOT EXISTS messenger_ai_jobs_conversation ON messenger_ai_jobs(conversation_id,status,sent_at);
