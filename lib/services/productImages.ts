/** Ảnh sản phẩm do shop tải lên (bảng shop_product_images). Byte ảnh không nằm trong catalog_json. */
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { PostImageMime } from '@/lib/types/posts';
import { checkPostImage, InvalidPostImage } from '@/lib/services/postImages';
import { getMessengerPool } from '@/lib/services/messengerPostgres';

export const MAX_PRODUCT_IMAGES = 3;

export class ProductImageError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Mọi lỗi ngoài ProductImageError: thường là chưa chạy db:migrate hoặc chưa có database. */
export function productImageErrorResponse(error: unknown) {
  if (error instanceof ProductImageError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: 'Chưa lưu hoặc đọc được ảnh sản phẩm. Kiểm tra kết nối và chạy npm run db:migrate rồi thử lại.' }, { status: 503 });
}

type Db = Pick<Pool, 'query'>;

export async function addProductImage(pageId: string, productId: string, bytes: Uint8Array, db: Db = getMessengerPool()): Promise<{ id: string }> {
  let mime: PostImageMime;
  try { mime = checkPostImage(bytes); }
  catch (error) { throw new ProductImageError(error instanceof InvalidPostImage ? error.message : 'Ảnh không hợp lệ.', 400); }
  const id = randomUUID();
  // created_at luôn lớn hơn ảnh trước của sản phẩm để thứ tự tải lên không bị trùng mili giây.
  // shortcut: hai yêu cầu tải đồng thời có thể vượt 3 ảnh; nâng cấp bằng khóa tư vấn nếu gặp thực tế.
  const stored = await db.query(`INSERT INTO shop_product_images(id,page_id,product_id,mime,data,created_at)
    SELECT $1,$2,$3,$4,$5,GREATEST($6::bigint,COALESCE((SELECT MAX(created_at) FROM shop_product_images WHERE page_id=$2 AND product_id=$3),0)+1)
    WHERE (SELECT COUNT(*) FROM shop_product_images WHERE page_id=$2 AND product_id=$3) < $7::int
    RETURNING id`, [id, pageId, productId, mime, Buffer.from(bytes), Date.now(), MAX_PRODUCT_IMAGES]);
  if (!stored.rowCount) throw new ProductImageError(`Mỗi sản phẩm tối đa ${MAX_PRODUCT_IMAGES} ảnh. Xóa bớt một ảnh trước khi tải thêm.`, 409);
  return { id };
}

export async function listProductImages(pageId: string, productId: string, db: Db = getMessengerPool()): Promise<{ id: string }[]> {
  const rows = await db.query('SELECT id FROM shop_product_images WHERE page_id=$1 AND product_id=$2 ORDER BY created_at', [pageId, productId]);
  return rows.rows.map((row) => ({ id: row.id as string }));
}

export async function readProductImage(pageId: string, id: string, db: Db = getMessengerPool()): Promise<{ mime: PostImageMime; data: Buffer } | null> {
  const row = (await db.query('SELECT mime,data FROM shop_product_images WHERE page_id=$1 AND id=$2', [pageId, id])).rows[0];
  return row ? { mime: row.mime as PostImageMime, data: Buffer.from(row.data) } : null;
}

export interface PhotoCandidate { productId: string; name: string; sku: string; imageIds: string[] }

/**
 * Sản phẩm (trong danh sách đưa vào) có ảnh để gửi cho khách này, ảnh chưa gửi xếp trước và ảnh đã gửi vẫn được đưa lại (khách xin xem lại thì gửi lại, không giới hạn).
 * Ảnh `unknown`/`sending` (đang gửi hoặc hàm bị cắt giữa chừng) coi như đã gửi vì có thể đã đến khách.
 * Bảng chưa có (chưa chạy migration 027) → [] để AI Chat vẫn trả lời như cũ.
 */
export async function readPhotoCandidates(pageId: string, psid: string, products: { id: string; name: string; sku: string }[],
  db: Db = getMessengerPool()): Promise<PhotoCandidate[]> {
  if (!products.length) return [];
  let rows;
  try {
    rows = (await db.query(`SELECT i.id,i.product_id,EXISTS(SELECT 1 FROM messenger_outbound_requests r WHERE r.page_id=i.page_id AND r.psid=$3
        AND r.status IN ('sent','unknown','sending') AND r.text='[ảnh] '||i.id) AS sent
      FROM shop_product_images i WHERE i.page_id=$1 AND i.product_id=ANY($2::text[]) ORDER BY i.created_at`, [pageId, products.map((product) => product.id), psid])).rows;
  } catch (error) {
    if ((error as { code?: string }).code === '42P01') return [];
    throw error;
  }
  return products.flatMap((product) => {
    const own = rows.filter((row) => row.product_id === product.id);
    const imageIds = [...own.filter((row) => !row.sent), ...own.filter((row) => row.sent)].map((row) => row.id as string);
    return imageIds.length ? [{ productId: product.id, name: product.name, sku: product.sku, imageIds }] : [];
  });
}

export async function deleteProductImage(pageId: string, id: string, db: Db = getMessengerPool()): Promise<boolean> {
  return ((await db.query('DELETE FROM shop_product_images WHERE page_id=$1 AND id=$2', [pageId, id])).rowCount ?? 0) > 0;
}
