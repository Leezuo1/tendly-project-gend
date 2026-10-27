-- Phiên live có thể tạo TRƯỚC khi bật stream: live_at = NULL nghĩa là đang chờ người bán bật live.
-- Facebook: Tendly tự nhận video Live của Trang rồi gắn làm nguồn. Demo: bấm "Giả lập bật live". Chạy lại vẫn an toàn.
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS live_at BIGINT;
UPDATE live_sessions SET live_at = started_at WHERE live_at IS NULL AND (source_id IS NOT NULL OR platform = 'demo');
