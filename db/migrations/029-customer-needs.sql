-- Nhu cầu của khách do nhân viên ghi tay (văn bản tự do, tối đa 500 ký tự do tầng service kiểm).
ALTER TABLE messenger_customers ADD COLUMN IF NOT EXISTS needs TEXT NOT NULL DEFAULT '';
ALTER TABLE messenger_customers ADD COLUMN IF NOT EXISTS needs_updated_at BIGINT;
