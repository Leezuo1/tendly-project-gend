import type { MockDb } from '@/lib/types/admin';
import { createSeed, LEGACY_PRODUCTS } from '@/lib/data/admin';

/**
 * "Database" giả lập, lưu trong localStorage để dữ liệu còn nguyên sau khi reload.
 * Khi có backend thật chỉ cần thay lib/services/api.ts, phần UI giữ nguyên.
 */
const STORAGE_KEY = 'tendly.mockdb';
const DB_VERSION = 1;

let cache: MockDb | null = null;
let version = 0;
const CHANGE_EVENT = 'tendly:db-changed';

/** Cho useSyncExternalStore: số phiên bản tăng mỗi lần dữ liệu đổi */
export const dbVersion = () => version;
export function subscribeDb(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

function notify() {
  version++;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function load(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockDb;
      if (parsed.version === DB_VERSION) {
        const migrated = migrateProductCatalog(parsed);
        if (migrated !== parsed) {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated)); }
          catch { return parsed; }
        }
        return migrated;
      }
    }
  } catch {
    // localStorage bị chặn hoặc dữ liệu hỏng -> dùng seed
  }
  return createSeed();
}

export function migrateProductCatalog(db: MockDb): MockDb {
  if (db.productCatalogVersion === 1) return db;
  const original = new Map(LEGACY_PRODUCTS.map(product => [product.id, JSON.stringify(product)]));
  const unchanged = db.products.filter(product => original.get(product.id) === JSON.stringify(product));
  if (!unchanged.length) return db;
  const preserved = db.products.filter(product => !unchanged.includes(product));
  const seed = createSeed();
  const preservedIds = new Set(preserved.map(product => product.id));
  const preservedSkus = new Set(preserved.map(product => product.sku.toLowerCase()));
  return { ...db, productCatalogVersion: 1,
    products: [...seed.products.filter(product => !preservedIds.has(product.id) && !preservedSkus.has(product.sku.toLowerCase())), ...preserved],
    productSource: db.productSource.lastSyncedAt ? db.productSource : seed.productSource };
}

export function readDb(): MockDb {
  if (!cache) cache = load();
  return cache;
}

export function writeDb(mutate: (db: MockDb) => void): MockDb {
  const db = structuredClone(readDb());
  mutate(db);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  cache = db;
  notify();
  return db;
}

export function resetDb() {
  const next = createSeed();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  cache = next;
  notify();
}
