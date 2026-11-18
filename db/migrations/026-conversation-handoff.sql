-- Ca ảnh cần nhân viên (hàng lỗi, biên lai…): tin khách bị chuyển và mã yêu cầu gửi của tin mẫu đã báo khách.
-- Hội thoại coi là "đang chờ nhân viên" đến khi có tin gửi đi nào khác tin mẫu đó (xem lib/services/handoff.ts).
ALTER TABLE messenger_conversations ADD COLUMN IF NOT EXISTS handoff_message_id TEXT;
ALTER TABLE messenger_conversations ADD COLUMN IF NOT EXISTS handoff_request_id TEXT;
