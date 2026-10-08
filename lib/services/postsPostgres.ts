import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import type { MarketingPost, NewMarketingPost, PostDraft } from '@/lib/types/posts';

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

const COLUMNS = `id, channel, goal, title, content, hashtags, image_idea, product_skus, status,
  external_id, external_url, created_at, updated_at, published_at`;

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
    status: row.status as MarketingPost['status'],
    externalId: (row.external_id as string | null) ?? null,
    externalUrl: (row.external_url as string | null) ?? null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    publishedAt: num(row.published_at),
  };
}

export async function listPosts(database: Queryable = getPool()): Promise<MarketingPost[]> {
  const { rows } = await database.query(`SELECT ${COLUMNS} FROM marketing_posts ORDER BY created_at DESC LIMIT 100`);
  return rows.map(toPost);
}

export async function getPost(id: string, database: Queryable = getPool()): Promise<MarketingPost> {
  const { rows } = await database.query(`SELECT ${COLUMNS} FROM marketing_posts WHERE id=$1`, [id]);
  if (!rows.length) throw new PostNotFound('Không tìm thấy bài viết.');
  return toPost(rows[0]);
}

export async function createPost(post: NewMarketingPost, database: Queryable = getPool()): Promise<MarketingPost> {
  const now = Date.now();
  const { rows } = await database.query(
    `INSERT INTO marketing_posts (id, channel, goal, title, content, hashtags, image_idea, product_skus, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,'draft',$9,$9) RETURNING ${COLUMNS}`,
    [randomUUID(), post.channel, post.goal, post.title, post.content, JSON.stringify(post.hashtags),
      post.imageIdea, JSON.stringify(post.productSkus), now],
  );
  return toPost(rows[0]);
}

/** Chỉ sửa được bài nháp — bài đã đăng lên Page thì nội dung trên Page không đổi theo. */
export async function updateDraft(id: string, patch: Partial<PostDraft>, database: Queryable = getPool()): Promise<MarketingPost> {
  const current = await getPost(id, database);
  if (current.status !== 'draft') throw new PostLocked('Bài đã đăng nên không sửa được nữa.');
  const next = { ...current, ...patch };
  const { rows } = await database.query(
    `UPDATE marketing_posts SET title=$2, content=$3, hashtags=$4::jsonb, image_idea=$5, updated_at=$6
     WHERE id=$1 AND status='draft' RETURNING ${COLUMNS}`,
    [id, next.title, next.content, JSON.stringify(next.hashtags), next.imageIdea, Date.now()],
  );
  if (!rows.length) throw new PostLocked('Bài đã đăng nên không sửa được nữa.');
  return toPost(rows[0]);
}

export async function markPublished(
  id: string, external: { id: string | null; url: string | null }, database: Queryable = getPool(),
): Promise<MarketingPost> {
  const now = Date.now();
  const { rows } = await database.query(
    `UPDATE marketing_posts SET status='published', external_id=$2, external_url=$3, published_at=$4, updated_at=$4
     WHERE id=$1 AND status='draft' RETURNING ${COLUMNS}`,
    [id, external.id, external.url, now],
  );
  if (!rows.length) throw new PostLocked('Bài viết đã được đăng trước đó.');
  return toPost(rows[0]);
}

export async function deletePost(id: string, database: Queryable = getPool()): Promise<void> {
  const result = await database.query('DELETE FROM marketing_posts WHERE id=$1', [id]);
  if (!result.rowCount) throw new PostNotFound('Không tìm thấy bài viết.');
}
