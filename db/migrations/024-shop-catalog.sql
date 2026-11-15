-- Danh mục sản phẩm, FAQ và thông tin shop theo Page: nguồn tri thức hiện hành cho AI Chat, trả lời bình luận và các luồng phía máy chủ.
-- catalog_json (kiểu JSON, giữ nguyên thứ tự khóa để so khớp sản phẩm mẫu): bản đầy đủ để khôi phục trình duyệt; knowledge_json: phần AI được dùng, đã kiểm tra khi ghi.
CREATE TABLE IF NOT EXISTS shop_catalog (
  page_id TEXT PRIMARY KEY,
  catalog_json JSON NOT NULL,
  knowledge_json JSONB NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1,
  updated_at BIGINT NOT NULL
);
