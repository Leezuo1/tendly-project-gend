import type { MockDb } from '../types';
import { createSeed } from './seed';

/**
 * "Database" giả lập, lưu trong localStorage để dữ liệu còn nguyên sau khi reload.
 * Khi có backend thật chỉ cần thay src/services/api.ts, phần UI giữ nguyên.
 */
const STORAGE_KEY = 'tendly.mockdb';
const DB_VERSION = 1;

let cache: MockDb | null = null;

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
  window.dispatchEvent(new CustomEvent('tendly:db-changed'));
  return db;
}

export function resetDb() {
  cache = createSeed();
  persist(cache);
  window.dispatchEvent(new CustomEvent('tendly:db-changed'));
}
