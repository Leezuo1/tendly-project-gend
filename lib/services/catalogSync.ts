'use client';

import { createSeed, LEGACY_PRODUCTS } from '@/lib/data/admin';
import { readDb, subscribeDb, writeDb } from '@/lib/services/mockDb';
import type { CatalogDb } from '@/lib/services/aiKnowledge';
import { DEFAULT_CONTEXT_TAG_RULES } from '@/lib/services/contextTagRules';

/**
 * Đồng bộ danh mục (sản phẩm, FAQ, thông tin shop, email) giữa trình duyệt và PostgreSQL.
 * Máy chủ là nơi AI Chat và trả lời bình luận đọc; trình duyệt vẫn là nơi chỉnh sửa.
 * Mỗi lần ghi gửi kèm revision đang giữ; máy chủ báo lệch (409) thì bản máy chủ thắng, bản trình duyệt được cất ở BACKUP_KEY.
 */
const REVISION_KEY = 'tendly.catalogRevision';
const BACKUP_KEY = 'tendly.catalogBackup';
// Logo shop là ảnh base64 rất nặng và AI không cần; không đồng bộ, mỗi trình duyệt giữ logo của mình.
const slice = (db: CatalogDb): CatalogDb => ({ shop: { ...db.shop, logo: null }, productSource: db.productSource, products: db.products, faqs: db.faqs, triggers: db.triggers, contextTagRules: db.contextTagRules });
// jsonb không giữ thứ tự khóa, nên so sánh phải bỏ qua thứ tự.
const stable = (value: unknown): string => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a < b ? -1 : 1)) : item);
const storedRevision = () => { try { return Number(localStorage.getItem(REVISION_KEY)) || 0; } catch { return 0; } };
const storeRevision = (revision: number) => { try { localStorage.setItem(REVISION_KEY, String(revision)); } catch { /* Bộ nhớ trình duyệt có thể bị chặn. */ } };

/** Dòng máy chủ từ trước khi đồng bộ nhãn chưa có contextTagRules: giữ bộ nhãn của trình duyệt (được đẩy lên sau đó) thay vì xóa về mặc định. */
export const remoteTagRules = (remote: CatalogDb, local: CatalogDb['contextTagRules']) => remote.contextTagRules ?? local;

/** Danh mục chỉ gồm dữ liệu mẫu của bản demo, chưa có chỉnh sửa nào của shop. */
export function isPristine(db: CatalogDb): boolean {
  const seed = createSeed(), known = new Set([...seed.products, ...LEGACY_PRODUCTS].map(product => JSON.stringify(product)));
  return db.products.every(product => known.has(JSON.stringify(product))) && stable(db.faqs) === stable(seed.faqs)
    && stable({ ...db.shop, logo: null }) === stable({ ...seed.shop, logo: null }) && stable(db.triggers) === stable(seed.triggers)
    && (!db.contextTagRules || stable(db.contextTagRules) === stable(DEFAULT_CONTEXT_TAG_RULES));
}

export function startCatalogSync(): () => void {
  let stopped = false, timer: ReturnType<typeof setTimeout> | undefined, queue: Promise<void> = Promise.resolve();
  let revision = storedRevision(); // giữ trong bộ nhớ của tab này: bộ nhớ trình duyệt dùng chung giữa các tab nhưng dữ liệu của từng tab thì không
  const setRevision = (next: number) => { revision = next; storeRevision(next); };
  let sent = ''; // bản (đã chuẩn hóa) mà máy chủ đang giữ theo hiểu biết của trình duyệt
  const request = (init?: RequestInit) => fetch('/api/shop-catalog', { cache: 'no-store', credentials: 'same-origin', ...init });
  const adopt = (remote: CatalogDb, next: number) => {
    const local = readDb();
    if (stable(slice(local)) !== stable(remote)) { try { localStorage.setItem(BACKUP_KEY, JSON.stringify(slice(local))); } catch { /* Không cất được thì vẫn dùng bản máy chủ. */ } }
    sent = stable(remote); setRevision(next); // trước khi ghi, để thông báo thay đổi của chính lần ghi này không kích hoạt đẩy lại
    writeDb(db => { db.shop = { ...remote.shop, logo: db.shop.logo }; db.productSource = remote.productSource; db.products = remote.products; db.faqs = remote.faqs; db.triggers = remote.triggers; db.contextTagRules = remoteTagRules(remote, db.contextTagRules); });
  };
  const push = async (expected: number) => {
    const body = slice(readDb()), snapshot = stable(body);
    const response = await request({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catalog: body, revision: expected }) });
    if (response.status === 409) return false;
    if (!response.ok) throw new Error('catalog push failed');
    sent = snapshot; setRevision((await response.json()).revision);
    return true;
  };
  // Kéo bản máy chủ, rồi quyết định: nhận về, đẩy lên hoặc giữ nguyên.
  const sync = async () => {
    const response = await request();
    if (!response.ok) return;
    const remote = await response.json() as { catalog: CatalogDb | null; revision: number };
    const local = slice(readDb());
    if (!remote.catalog) { if (!isPristine(local)) await push(0); return; }
    if (remote.revision === revision) { if (stable(local) !== stable(remote.catalog) && stable(local) !== sent) { if (!await push(revision)) await sync(); } else sent = stable(local);
      return; }
    // Lần đầu trình duyệt này kết nối: giữ bản có dữ liệu thật của shop, không để bản mẫu ghi đè.
    if (revision === 0 && isPristine(remote.catalog) && !isPristine(local)) { if (!await push(remote.revision)) await sync(); return; }
    adopt(remote.catalog, remote.revision);
  };
  const run = () => { queue = queue.then(sync).catch(() => undefined); return queue; };
  const unsubscribe = subscribeDb(() => {
    if (stopped || stable(slice(readDb())) === sent) return;
    clearTimeout(timer); timer = setTimeout(() => void run(), 1000);
  });
  const refresh = () => { if (!document.hidden) void run(); };
  window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
  void run();
  return () => { stopped = true; clearTimeout(timer); unsubscribe(); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
}
