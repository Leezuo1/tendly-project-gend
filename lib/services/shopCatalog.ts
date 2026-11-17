import type { Pool } from 'pg';
import { createSeed, LEGACY_PRODUCTS } from '@/lib/data/admin';
import { buildKnowledge, InvalidAiKnowledge, parseAiKnowledge, type CatalogDb } from '@/lib/services/aiKnowledge';
import { DEFAULT_CONTEXT_TAG_RULES, validateContextTagRules } from '@/lib/services/contextTagRules';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import type { AiKnowledge } from '@/lib/types/ai';
import type { ContextTagRule } from '@/lib/types/contextTags';

export class ShopCatalogError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
type Db = Pick<Pool, 'query'>;
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const noTable = (error: unknown) => (error as { code?: string })?.code === '42P01';

/** Sản phẩm mẫu chưa chỉnh sửa (dữ liệu giả của bản demo) không được tới khách thật. */
const samples = () => new Set([...createSeed().products, ...LEGACY_PRODUCTS].map(product => JSON.stringify(product)));

function parseCatalog(value: unknown): CatalogDb {
  if (!isRecord(value) || !isRecord(value.shop) || !isRecord(value.productSource) || !Array.isArray(value.products) || !Array.isArray(value.faqs) || !Array.isArray(value.triggers)) throw new ShopCatalogError('Dữ liệu danh mục không hợp lệ.');
  if (value.contextTagRules !== undefined) {
    try { return { ...value, contextTagRules: validateContextTagRules(value.contextTagRules) } as unknown as CatalogDb; }
    catch (error) { throw new ShopCatalogError(error instanceof Error ? error.message : 'Quy tắc gắn thẻ không hợp lệ.'); }
  }
  return value as unknown as CatalogDb;
}

/** Bộ nhãn ngữ cảnh của shop (đồng bộ cùng danh mục); chưa có danh mục, chưa có bộ nhãn hoặc chưa chạy migration 024 thì dùng bộ mặc định. */
export async function readShopTagRules(pageId: string, db: Db = getMessengerPool()): Promise<ContextTagRule[]> {
  try {
    const rules = (await db.query('SELECT catalog_json FROM shop_catalog WHERE page_id=$1', [pageId])).rows[0]?.catalog_json?.contextTagRules;
    if (Array.isArray(rules)) return rules as ContextTagRule[];
  } catch (error) { if (!noTable(error)) throw error; }
  return structuredClone(DEFAULT_CONTEXT_TAG_RULES);
}

/** Phần tri thức AI được dùng: đã kiểm tra, bỏ sản phẩm mẫu chưa sửa. */
export function catalogKnowledge(catalog: CatalogDb): AiKnowledge {
  const demo = samples();
  try { return parseAiKnowledge(buildKnowledge({ ...catalog, products: catalog.products.filter(product => !demo.has(JSON.stringify(product))) })); }
  catch (error) { throw error instanceof InvalidAiKnowledge ? new ShopCatalogError(error.message) : error; }
}

export async function readShopCatalog(pageId: string, db: Db = getMessengerPool()) {
  const row = (await db.query('SELECT catalog_json,revision,updated_at FROM shop_catalog WHERE page_id=$1', [pageId])).rows[0];
  return row ? { catalog: row.catalog_json as CatalogDb, revision: Number(row.revision), updatedAt: Number(row.updated_at) } : null;
}

/** expected = revision mà trình duyệt đang giữ (0 = chưa có bản nào); lệch thì 409 để trình duyệt tải bản máy chủ về thay vì ghi đè. */
export async function saveShopCatalog(pageId: string, input: unknown, expected: unknown, db: Db = getMessengerPool()) {
  if (!Number.isSafeInteger(expected) || (expected as number) < 0) throw new ShopCatalogError('Phiên bản danh mục không hợp lệ.');
  const catalog = parseCatalog(input), knowledge = catalogKnowledge(catalog), now = Date.now();
  const args = [pageId, JSON.stringify(catalog), JSON.stringify(knowledge), now];
  const saved = expected === 0
    ? await db.query(`INSERT INTO shop_catalog(page_id,catalog_json,knowledge_json,revision,updated_at) VALUES($1,$2::json,$3::jsonb,1,$4)
        ON CONFLICT(page_id) DO NOTHING RETURNING revision`, args)
    : await db.query(`UPDATE shop_catalog SET catalog_json=$2::json,knowledge_json=$3::jsonb,revision=revision+1,updated_at=$4
        WHERE page_id=$1 AND revision=$5 RETURNING revision`, [...args, expected]);
  if (!saved.rowCount) throw new ShopCatalogError('Danh mục đã được cập nhật ở nơi khác. Đang tải bản mới nhất.', 409);
  return { revision: Number(saved.rows[0].revision) };
}

/** Tri thức hiện hành của shop; chưa có danh mục (hoặc chưa chạy migration 024) thì dùng bản chụp cũ `fallback`. */
export async function liveKnowledge(pageId: string, fallback: unknown, db: Db = getMessengerPool()): Promise<AiKnowledge | null> {
  try {
    const row = (await db.query('SELECT knowledge_json FROM shop_catalog WHERE page_id=$1', [pageId])).rows[0];
    if (row) return parseAiKnowledge(row.knowledge_json);
  } catch (error) { if (!noTable(error)) throw error; }
  return fallback == null ? null : parseAiKnowledge(fallback);
}
