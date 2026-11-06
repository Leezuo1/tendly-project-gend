-- Tầng Page của cấu hình AI: shop cá nhân hóa từng AI cho từng Page (mỗi Page thuộc một nền tảng),
-- trên nền thiết lập Global/Platform do Tendly (admin) đặt. Document = AiConfiguration (lib/services/aiConfiguration.ts).
CREATE TABLE IF NOT EXISTS ai_page_profiles (
  page_id text PRIMARY KEY,
  shop_id text NOT NULL,
  platform text NOT NULL,
  document jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  updated_at bigint NOT NULL,
  updated_by text NOT NULL
);
