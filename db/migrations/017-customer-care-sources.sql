ALTER TABLE messenger_messages ADD COLUMN IF NOT EXISTS reply_to_mid TEXT;
ALTER TABLE messenger_analysis_history ADD COLUMN IF NOT EXISTS source_context_json JSONB;
ALTER TABLE facebook_comments ADD COLUMN IF NOT EXISTS care_context_json JSONB;
ALTER TABLE live_comments ADD COLUMN IF NOT EXISTS care_context_json JSONB;
CREATE INDEX IF NOT EXISTS facebook_comments_message ON facebook_comments(page_id,message_id) WHERE status='sent';
CREATE INDEX IF NOT EXISTS live_comments_message ON live_comments(message_id) WHERE reply_status='sent';
