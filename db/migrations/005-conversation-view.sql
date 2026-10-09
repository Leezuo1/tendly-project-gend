ALTER TABLE messenger_conversations ADD COLUMN IF NOT EXISTS view_start_at BIGINT;
UPDATE messenger_conversations SET view_start_at=hidden_at WHERE view_start_at IS NULL AND hidden_at IS NOT NULL;
ALTER TABLE messenger_conversations ADD COLUMN IF NOT EXISTS personality_summary TEXT;
ALTER TABLE messenger_conversations ADD COLUMN IF NOT EXISTS personality_source_hash TEXT;
ALTER TABLE messenger_conversations ADD COLUMN IF NOT EXISTS personality_refresh_after BIGINT;
