import type { MockDb } from '@/lib/types/admin';
import { createSeed } from '@/lib/data/admin';

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
      if (parsed.version === DB_VERSION) return parsed;
    }
  } catch {
    // localStorage bị chặn hoặc dữ liệu hỏng -> dùng seed
  }
  return createSeed();
}

function persist(db: MockDb) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // bỏ qua, dữ liệu vẫn sống trong bộ nhớ
  }
}

export function readDb(): MockDb {
  if (!cache) cache = load();
  return cache;
}

export function writeDb(mutate: (db: MockDb) => void): MockDb {
  const db = readDb();
  mutate(db);
  persist(db);
  notify();
  return db;
}

export function resetDb() {
  cache = createSeed();
  persist(cache);
  notify();
}
