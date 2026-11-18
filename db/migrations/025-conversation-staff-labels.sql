-- Nhãn nhân viên dán (added) và nhãn tự động nhân viên đã gỡ (hidden) của từng hội thoại, theo id nhãn trong bộ nhãn ngữ cảnh của shop.
ALTER TABLE messenger_conversations ADD COLUMN IF NOT EXISTS staff_labels JSONB NOT NULL DEFAULT '{"added":[],"hidden":[]}';
