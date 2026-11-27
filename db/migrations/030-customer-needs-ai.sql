-- Phân biệt nhu cầu do AI suy luận hay nhân viên sửa tay, và lưu hash tin khách cuối đã đọc để tránh gọi AI lặp lại hoặc ghi đè ghi chú nhân viên.
ALTER TABLE messenger_customers ADD COLUMN IF NOT EXISTS needs_source TEXT NOT NULL DEFAULT '';
ALTER TABLE messenger_customers ADD COLUMN IF NOT EXISTS needs_source_hash TEXT;
ALTER TABLE messenger_customers ADD COLUMN IF NOT EXISTS needs_refresh_after BIGINT;
UPDATE messenger_customers SET needs_source = 'staff' WHERE needs <> '' AND needs_source = '';
