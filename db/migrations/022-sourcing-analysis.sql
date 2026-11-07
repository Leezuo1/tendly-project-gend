-- Bài phân tích của AI Smart Sourcing cho từng lượt thu thập; lưu lại để mở popup không gọi LLM lần nữa.
ALTER TABLE sourcing_runs ADD COLUMN IF NOT EXISTS analysis_json jsonb;
