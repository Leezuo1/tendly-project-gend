ALTER TABLE messenger_conversations ADD COLUMN IF NOT EXISTS hidden_at BIGINT;
CREATE TABLE IF NOT EXISTS messenger_analysis_history (
  page_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES messenger_conversations(id),
  analysis JSONB NOT NULL,
  reply TEXT NOT NULL,
  model TEXT NOT NULL,
  source_summary TEXT NOT NULL,
  analyzed_at BIGINT NOT NULL,
  PRIMARY KEY (page_id, message_id),
  FOREIGN KEY (page_id, message_id) REFERENCES messenger_messages(page_id, message_id)
);
CREATE INDEX IF NOT EXISTS messenger_analysis_conversation ON messenger_analysis_history(conversation_id, analyzed_at);
