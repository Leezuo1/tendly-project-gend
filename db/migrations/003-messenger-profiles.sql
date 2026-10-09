ALTER TABLE messenger_customers ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE messenger_customers ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE messenger_customers ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE messenger_customers ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE messenger_customers ADD COLUMN IF NOT EXISTS profile_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (profile_status IN ('pending', 'ready', 'unavailable'));
ALTER TABLE messenger_customers ADD COLUMN IF NOT EXISTS profile_refreshed_at BIGINT;
ALTER TABLE messenger_customers ADD COLUMN IF NOT EXISTS profile_retry_after BIGINT;
