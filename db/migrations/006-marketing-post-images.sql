-- Ảnh kèm bài đăng (AI tạo hoặc chủ shop tải lên). Tách bảng để danh sách bài không phải đọc cả ảnh.
CREATE TABLE IF NOT EXISTS marketing_post_images (
  post_id TEXT PRIMARY KEY REFERENCES marketing_posts (id) ON DELETE CASCADE,
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  data BYTEA NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('ai', 'upload')),
  updated_at BIGINT NOT NULL
);
