ALTER TABLE messenger_ai_settings ADD COLUMN IF NOT EXISTS profile_json JSONB;
ALTER TABLE messenger_ai_settings ADD COLUMN IF NOT EXISTS page_profile_json JSONB;
ALTER TABLE messenger_ai_settings ADD COLUMN IF NOT EXISTS page_assigned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE messenger_ai_settings ADD COLUMN IF NOT EXISTS page_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE messenger_ai_settings ADD COLUMN IF NOT EXISTS approved_by TEXT NOT NULL DEFAULT '';
ALTER TABLE messenger_ai_settings ADD COLUMN IF NOT EXISTS approved_at BIGINT;

ALTER TABLE messenger_conversations ADD COLUMN IF NOT EXISTS ai_auto_reply BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE messenger_conversations ADD COLUMN IF NOT EXISTS ai_updated_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE messenger_conversations ADD COLUMN IF NOT EXISTS ai_enabled_at BIGINT NOT NULL DEFAULT 0;
