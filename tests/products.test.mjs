import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test, afterEach } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function fixture(stored) {
  const storage = new Map(stored ? [['tendly.mockdb', JSON.stringify(stored)]] : []);
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  globalThis.window = new EventTarget();
  const cache = new Map();
  const load = file => {
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const compiled = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', compiled)(name => name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), loaded, loaded.exports);
    return loaded.exports;
  };
  return { load, storage, db: load('lib/services/mockDb.ts'), api: load('lib/services/api.ts').productApi };
}
afterEach(() => { delete globalThis.window; delete globalThis.localStorage; });

test('catalog contains ten distinct sourced products, local photos and no fabricated shop stock', () => {
  const { db } = fixture();
  const products = db.readDb().products;
  assert.equal(products.length, 10);
  assert.equal(new Set(products.map(p => p.sku)).size, 10);
  for (const p of products) {
    assert.equal(new URL(p.sourceUrl).hostname, 'www.coolmate.me');
    assert.ok(existsSync('public' + p.imageUrl));
    assert.equal(p.stockKnown, false);
    assert.equal(p.qty, 0);
    assert.ok(p.price > 0 && p.description && p.features.length && p.benefits.length && p.keywords.length);
    assert.ok(!p.description.includes('?') && !p.category.includes('?'));
    assert.ok(p.colors.length && p.sizes.length && !p.sizes.includes(p.colors[0]));
    assert.ok(p.relatedProductIds.every(id => id !== p.id && products.some(other => other.id === id)));
  }
});

test('legacy migration replaces untouched samples once and keeps edited, CSV and Shopee products', () => {
  const { load, db } = fixture();
  const { createSeed, LEGACY_PRODUCTS } = load('lib/data/admin.ts');
  const old = createSeed(); delete old.productCatalogVersion;
  old.products = structuredClone(LEGACY_PRODUCTS);
  const edited = { ...old.products[0], name: 'Sản phẩm chủ shop đã sửa', price: 123456 };
  old.products[0] = edited;
  old.products.push({ ...edited, id: 'csv-private', sku: 'CSV-KEEP' }, { ...edited, id: 'shopee:keep', sku: 'SHOPEE-KEEP' });
  old.productSource.lastSyncedAt = 123;
  const migrated = db.migrateProductCatalog(old);
  assert.equal(migrated.products.length, 13);
  assert.deepEqual(migrated.products.find(p => p.id === edited.id), edited);
  assert.ok(migrated.products.some(p => p.id === 'csv-private'));
  assert.ok(migrated.products.some(p => p.id === 'shopee:keep'));
  assert.deepEqual(migrated.faqs, old.faqs);
  assert.equal(migrated.productSource.lastSyncedAt, 123);
  assert.equal(old.products.length, 22);
  assert.equal(db.migrateProductCatalog(migrated), migrated);
  const customOnly = { ...old, products: [edited] };
  assert.equal(db.migrateProductCatalog(customOnly), customOnly);
});

test('product editing reaches saved knowledge and AI parsing with source and related IDs preserved', async () => {
  const { db, api, load } = fixture();
  const p = db.readDb().products[0], related = db.readDb().products[1];
  const saved = await api.update(p.id, { ...p, sku: 'MY-SKU', description: 'Mô tả của shop', features: ['Tính năng A'], benefits: ['Lợi ích A'], usp: 'Điểm khác biệt', keywords: ['từ khóa riêng'], relatedProductIds: [related.id], qty: 8, stockKnown: true });
  assert.equal(saved.id, p.id);
  assert.equal(db.readDb().products.length, 10);
  const source = load('lib/services/aiChat.ts').currentAiKnowledge();
  const parsed = load('lib/services/aiKnowledge.ts').parseAiKnowledge(source);
  assert.equal(parsed.products[0].description, 'Mô tả của shop');
  assert.deepEqual(parsed.products[0].features, ['Tính năng A']);
  assert.deepEqual(parsed.products[0].keywords, ['từ khóa riêng']);
  assert.deepEqual(parsed.products[0].relatedProductIds, [related.id]);
  assert.equal(parsed.products[0].sourceUrl, p.sourceUrl);
  assert.equal(parsed.products[0].stockKnown, true);
  assert.equal(parsed.products[0].qty, 8);
});

test('loading legacy storage migrates once, persists the catalog and retains shop settings', () => {
  const { db, load, storage } = fixture();
  const { createSeed, LEGACY_PRODUCTS } = load('lib/data/admin.ts');
  const old = createSeed(); delete old.productCatalogVersion;
  old.shop.name = 'Shop riêng'; old.products = structuredClone(LEGACY_PRODUCTS);
  storage.set('tendly.mockdb', JSON.stringify(old));
  assert.equal(db.readDb().products.length, 10);
  assert.equal(db.readDb().shop.name, 'Shop riêng');
  assert.equal(JSON.parse(storage.get('tendly.mockdb')).productCatalogVersion, 1);
  assert.deepEqual(db.readDb().faqs, old.faqs);
});

test('chat preview does not call unknown stock sold out or confirm an order', () => {
  const { db, load } = fixture();
  const p = db.readDb().products[0];
  const bot = load('lib/services/chatBot.ts');
  const reply = bot.botReply('Chốt đơn ' + p.sku, db.readDb().faqs, db.readDb().products, { productId: p.id, size: 'M', color: 'Đen' });
  assert.match(reply.text, /chưa xác nhận/);
  assert.doesNotMatch(reply.text, /hết hàng|đã lên đơn/);
});

test('invalid edits and failed storage writes leave the previous product and cache intact', async () => {
  const { db, api, storage } = fixture();
  const original = structuredClone(db.readDb().products);
  const p = original[0];
  for (const patch of [{ sku: original[1].sku }, { qty: -1 }, { qty: 1.5 }, { price: NaN }, { relatedProductIds: [p.id] }, { relatedProductIds: ['missing'] }, { keywords: 'bad' }, { sourceUrl: 'javascript:alert(1)' }, { description: 'x'.repeat(2001) }]) {
    await assert.rejects(api.update(p.id, { ...p, ...patch }));
    assert.deepEqual(db.readDb().products, original);
  }
  const previousStorage = storage.get('tendly.mockdb');
  globalThis.localStorage.setItem = () => { throw new Error('quota'); };
  await assert.rejects(api.update(p.id, { ...p, name: 'Không được lưu' }), /quota/);
  assert.deepEqual(db.readDb().products, original);
  assert.equal(storage.get('tendly.mockdb'), previousStorage);
});

test('old product payloads still parse and malformed optional metadata is rejected', () => {
  const { db, load } = fixture();
  const parser = load('lib/services/aiKnowledge.ts').parseAiKnowledge;
  const source = load('lib/services/aiChat.ts').currentAiKnowledge();
  source.products = load('lib/data/admin.ts').LEGACY_PRODUCTS;
  assert.equal(parser(source).products[0].sku, 'AT-01');
  source.products = structuredClone(db.readDb().products);
  source.products[0].features = [123];
  assert.throws(() => parser(source));
  source.products[0] = { ...db.readDb().products[0], stockKnown: 'yes' };
  assert.throws(() => parser(source));
});
