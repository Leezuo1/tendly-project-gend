-- Ảnh sản phẩm do shop tải lên để AI Chat và nhân viên gửi cho khách. Byte ảnh nằm ở bảng riêng, không nằm trong catalog_json.
CREATE TABLE IF NOT EXISTS shop_product_images (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  mime TEXT NOT NULL,
  data BYTEA NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS shop_product_images_product_idx ON shop_product_images (page_id, product_id, created_at);
