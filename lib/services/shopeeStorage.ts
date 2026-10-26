import type { Pool, PoolClient } from 'pg';
import { isDeepStrictEqual } from 'node:util';
import { getMessengerPool } from '@/lib/services/messengerPostgres';
import { ShopeeError, shopeeCatalog, shopeeConfig, shopeeTokens } from '@/lib/services/shopee';
import type { Product, ProductSource } from '@/lib/types/admin';

type Config = ReturnType<typeof shopeeConfig>;
type Database = Pick<Pool, 'query' | 'connect'>;

function snapshot(row?: Record<string, unknown>) {
  const source: ProductSource = { name: String(row?.shop_name || 'Shopee'), connected: Boolean(row),
    lastSyncedAt: Number(row?.last_synced_at || 0), syncCount: Number(row?.sync_count || 0) };
  return { source, products: (row?.products_json || []) as Product[] };
}

async function connection(config: Config, database: Pick<Pool, 'query'>) {
  const result = await database.query(`SELECT * FROM shopee_connection
    WHERE id=1 AND partner_id=$1 AND shop_id=$2 AND sandbox=$3`, [config.partnerId, config.shopId, config.sandbox]);
  return result.rows[0] as Record<string, unknown> | undefined;
}

export async function readShopee(config: Config, database: Pick<Pool, 'query'> = getMessengerPool()) {
  return snapshot(await connection(config, database));
}

async function locked<T>(database: Database, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database.connect();
  let held = false;
  let broken: Error | undefined;
  try {
    held = (await client.query('SELECT pg_try_advisory_lock(727364102) AS acquired')).rows[0].acquired;
    if (!held) throw new ShopeeError('Shop đang kết nối hoặc đồng bộ ở phiên khác. Hãy thử lại sau.', 409);
    return await work(client);
  } finally {
    if (held) {
      try { await client.query('SELECT pg_advisory_unlock(727364102)'); }
      catch { broken = new Error('Shopee lock release failed.'); }
    }
    client.release(broken);
  }
}

export async function authorizeShopee(config: Config, code: string, database: Database = getMessengerPool()) {
  return locked(database, async (client) => {
    const tokens = await shopeeTokens(config, { code });
    await client.query(`INSERT INTO shopee_connection(id,partner_id,shop_id,sandbox,access_token,refresh_token,expires_at)
      VALUES(1,$1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET
      partner_id=EXCLUDED.partner_id,shop_id=EXCLUDED.shop_id,sandbox=EXCLUDED.sandbox,
      access_token=EXCLUDED.access_token,refresh_token=EXCLUDED.refresh_token,expires_at=EXCLUDED.expires_at,
      products_json=CASE WHEN shopee_connection.partner_id=EXCLUDED.partner_id AND shopee_connection.shop_id=EXCLUDED.shop_id
        AND shopee_connection.sandbox=EXCLUDED.sandbox THEN shopee_connection.products_json ELSE '[]'::jsonb END,
      shop_name=CASE WHEN shopee_connection.shop_id=EXCLUDED.shop_id AND shopee_connection.sandbox=EXCLUDED.sandbox
        THEN shopee_connection.shop_name ELSE '' END,
      last_synced_at=0,sync_count=0`, [config.partnerId, config.shopId, config.sandbox,
      tokens.accessToken, tokens.refreshToken, tokens.expiresAt]);
  });
}

export async function syncShopee(config: Config, database: Database = getMessengerPool()) {
  return locked(database, async (client) => {
    const row = await connection(config, client);
    if (!row) throw new ShopeeError('Hãy kết nối shop Shopee trước khi đồng bộ.', 409);
    let token = String(row.access_token);
    if (Number(row.expires_at) <= Date.now() + 180000) {
      const tokens = await shopeeTokens(config, { refresh_token: String(row.refresh_token) });
      // Lưu token xoay vòng ngay; lỗi tải danh mục sau đó không được khôi phục refresh token đã dùng.
      await client.query('UPDATE shopee_connection SET access_token=$1,refresh_token=$2,expires_at=$3 WHERE id=1',
        [tokens.accessToken, tokens.refreshToken, tokens.expiresAt]);
      token = tokens.accessToken;
    }
    const catalog = await shopeeCatalog(config, token);
    const before = new Map(snapshot(row).products.map((p) => [p.id, p]));
    const added = catalog.products.filter((p) => !before.has(p.id)).length;
    const changed = catalog.products.filter((p) => before.has(p.id) && !isDeepStrictEqual(before.get(p.id), p)).length;
    const after = new Set(catalog.products.map((p) => p.id));
    const removed = before.size - [...before.keys()].filter((id) => after.has(id)).length;
    const lastSyncedAt = Date.now();
    const count = Number(row.sync_count) + 1;
    await client.query(`UPDATE shopee_connection SET products_json=$1::jsonb,shop_name=$2,last_synced_at=$3,sync_count=$4 WHERE id=1`,
      [JSON.stringify(catalog.products), catalog.name, lastSyncedAt, count]);
    return { products: catalog.products, source: { name: catalog.name, connected: true, lastSyncedAt, syncCount: count }, added, changed, removed };
  });
}
