-- Cửa sổ Trợ lý Live 3 tab. Chạy lại nhiều lần vẫn an toàn.
-- Nhóm bình luận shop đã xử lý (trả lời trên live / bằng comment) và comment trả lời công khai của Trang.
ALTER TABLE live_groups ADD COLUMN IF NOT EXISTS handled_at BIGINT;
ALTER TABLE live_groups ADD COLUMN IF NOT EXISTS public_reply_id TEXT;
-- Giá flash sale trong phiên: { "SKU": giá } — áp dụng cho câu trả lời mẫu và đơn chốt sau khi bật.
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS flash_json JSONB NOT NULL DEFAULT '{}'::jsonb;
