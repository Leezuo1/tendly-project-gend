import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import type { MarketingPost, NewMarketingPost, PostDraft, PostImageMime, PostImageSource } from '@/lib/types/posts';

type Queryable = Pick<Pool, 'query'>;

let pool: Pool | undefined;

export class PostsDatabaseNotConfigured extends Error {}
export class PostNotFound extends Error {}
export class PostLocked extends Error {}

function getPool(): Pool {
  if (!process.env.DATABASE_URL?.trim()) throw new PostsDatabaseNotConfigured('Chưa cấu hình DATABASE_URL.');
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3, connectionTimeoutMillis: 5000, idleTimeoutMillis: 5000,
      statement_timeout: 8000,
    });
    pool.on('error', () => console.error('Marketing posts database idle connection failed.'));
    if (process.env.VERCEL) attachDatabasePool(pool);
  }
  return pool;
}

/** Kèm thông tin ảnh (không đọc bytes ảnh) để danh sách bài vẫn nhẹ. */
const SELECT_POSTS = `SELECT p.id, p.channel, p.goal, p.title, p.content, p.hashtags, p.image_idea, p.product_skus, p.status,
  p.external_id, p.external_url, p.created_at, p.updated_at, p.published_at,
  i.source AS image_source, i.updated_at AS image_updated_at
  FROM marketing_posts p LEFT JOIN marketing_post_images i ON i.post_id = p.id`;

const json = (value: unknown): string[] => {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
};
const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));

function toPost(row: Record<string, unknown>): MarketingPost {
  return {
    id: String(row.id),
    channel: row.channel as MarketingPost['channel'],
    goal: row.goal as MarketingPost['goal'],
    title: String(row.title),
    content: String(row.content),
    hashtags: json(row.hashtags),
    imageIdea: String(row.image_idea),
    productSkus: json(row.product_skus),
    image: row.image_source ? { source: row.image_source as PostImageSource, updatedAt: Number(row.image_updated_at) } : null,
    status: row.status as MarketingPost['status'],
    externalId: (row.external_id as string | null) ?? null,
    externalUrl: (row.external_url as string | null) ?? null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    publishedAt: num(row.published_at),
  };
}

export async function listPosts(database: Queryable = getPool()): Promise<MarketingPost[]> {
  const { rows } = await database.query(`${SELECT_POSTS} ORDER BY p.created_at DESC LIMIT 100`);
  return rows.map(toPost);
}

export async function getPost(id: string, database: Queryable = getPool()): Promise<MarketingPost> {
  const { rows } = await database.query(`${SELECT_POSTS} WHERE p.id=$1`, [id]);
  if (!rows.length) throw new PostNotFound('Không tìm thấy bài viết.');
  return toPost(rows[0]);
}

export async function createPost(post: NewMarketingPost, database: Queryable = getPool()): Promise<MarketingPost> {
  const id = randomUUID();
  await database.query(
    `INSERT INTO marketing_posts (id, channel, goal, title, content, hashtags, image_idea, product_skus, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,'draft',$9,$9)`,
    [id, post.channel, post.goal, post.title, post.content, JSON.stringify(post.hashtags),
      post.imageIdea, JSON.stringify(post.productSkus), Date.now()],
  );
  return getPost(id, database);
}

/** Chỉ sửa được bài nháp — bài đã đăng lên Page thì nội dung trên Page không đổi theo. */
export async function updateDraft(id: string, patch: Partial<PostDraft>, database: Queryable = getPool()): Promise<MarketingPost> {
  const current = await getPost(id, database);
  if (current.status !== 'draft') throw new PostLocked('Bài đã đăng nên không sửa được nữa.');
  const next = { ...current, ...patch };
  const { rowCount } = await database.query(
    `UPDATE marketing_posts SET title=$2, content=$3, hashtags=$4::jsonb, image_idea=$5, updated_at=$6
     WHERE id=$1 AND status='draft'`,
    [id, next.title, next.content, JSON.stringify(next.hashtags), next.imageIdea, Date.now()],
  );
  if (!rowCount) throw new PostLocked('Bài đã đăng nên không sửa được nữa.');
  return getPost(id, database);
}

export async function markPublished(
  id: string, external: { id: string | null; url: string | null }, database: Queryable = getPool(),
): Promise<MarketingPost> {
  const now = Date.now();
  const { rowCount } = await database.query(
    `UPDATE marketing_posts SET status='published', external_id=$2, external_url=$3, published_at=$4, updated_at=$4
     WHERE id=$1 AND status='draft'`,
    [id, external.id, external.url, now],
  );
  if (!rowCount) throw new PostLocked('Bài viết đã được đăng trước đó.');
  return getPost(id, database);
}

export async function deletePost(id: string, database: Queryable = getPool()): Promise<void> {
  // Ảnh tự xoá theo (ON DELETE CASCADE).
  const result = await database.query('DELETE FROM marketing_posts WHERE id=$1', [id]);
  if (!result.rowCount) throw new PostNotFound('Không tìm thấy bài viết.');
}

export interface StoredPostImage {
  mime: PostImageMime;
  data: Buffer;
  source: PostImageSource;
}

export async function getPostImage(id: string, database: Queryable = getPool()): Promise<StoredPostImage | null> {
  const { rows } = await database.query('SELECT mime, data, source FROM marketing_post_images WHERE post_id=$1', [id]);
  if (!rows.length) return null;
  return { mime: rows[0].mime as PostImageMime, data: Buffer.from(rows[0].data as Uint8Array), source: rows[0].source as PostImageSource };
}

/** Gắn/thay ảnh cho bài nháp; bài đã đăng thì ảnh trên Page không đổi theo nên khoá lại. */
export async function setPostImage(id: string, image: StoredPostImage, database: Queryable = getPool()): Promise<MarketingPost> {
  const current = await getPost(id, database);
  if (current.status !== 'draft') throw new PostLocked('Bài đã đăng nên không đổi ảnh được nữa.');
  await database.query(
    `INSERT INTO marketing_post_images (post_id, mime, data, source, updated_at) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (post_id) DO UPDATE SET mime=EXCLUDED.mime, data=EXCLUDED.data, source=EXCLUDED.source, updated_at=EXCLUDED.updated_at`,
    [id, image.mime, image.data, image.source, Date.now()],
  );
  return getPost(id, database);
}

export async function deletePostImage(id: string, database: Queryable = getPool()): Promise<MarketingPost> {
  const current = await getPost(id, database);
  if (current.status !== 'draft') throw new PostLocked('Bài đã đăng nên không đổi ảnh được nữa.');
  await database.query('DELETE FROM marketing_post_images WHERE post_id=$1', [id]);
  return getPost(id, database);
}
