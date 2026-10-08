CREATE TABLE IF NOT EXISTS marketing_posts (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('facebook', 'tiktok', 'email')),
  goal TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  hashtags JSONB NOT NULL,
  image_idea TEXT NOT NULL,
  product_skus JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  external_id TEXT,
  external_url TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  published_at BIGINT
);

CREATE INDEX IF NOT EXISTS marketing_posts_created
  ON marketing_posts (created_at);
