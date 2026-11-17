import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { after, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
const load = (file) => {
  if (cache.has(file)) return cache.get(file).exports;
  const loaded = { exports: {} }; cache.set(file, loaded);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)((name) => name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), loaded, loaded.exports);
  return loaded.exports;
};
const { saveShopCatalog, readShopCatalog, liveKnowledge, ShopCatalogError } = load('lib/services/shopCatalog.ts');
const { createSeed } = load('lib/data/admin.ts');
const wrap = (db) => ({ query: async (sql, values) => { const result = await db.query(sql, values); return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length }; } });
const bare = new PGlite(), full = new PGlite();
const ready = full.exec(readFileSync('db/migrations/024-shop-catalog.sql', 'utf8'));
after(async () => { await ready; await bare.close(); await full.close(); });

const seed = createSeed();
const custom = { id: 'p-x', sku: 'X-1', name: 'Áo thử', material: '', emoji: '', category: 'Áo', colors: [], sizes: [], qty: 3, price: 100000 };
const catalog = (products) => ({ shop: seed.shop, productSource: seed.productSource, products, faqs: seed.faqs, triggers: seed.triggers });
const snapshot = { shop: { name: 'Cũ', email: '', phone: '' }, productSource: { name: 'x', connected: false, lastSyncedAt: 0 }, products: [], faqs: [], emailTriggers: [] };

test('before migration 024 the server falls back to the old snapshot instead of failing', async () => {
  const db = wrap(bare);
  assert.equal((await liveKnowledge('111', snapshot, db)).shop.name, 'Cũ');
  assert.equal(await liveKnowledge('111', null, db), null);
});

test('live catalog replaces the snapshot, keeps real products and leaves out untouched demo products', async () => {
  await ready;
  const db = wrap(full);
  assert.equal(await readShopCatalog('111', db), null);
  assert.equal((await liveKnowledge('111', snapshot, db)).shop.name, 'Cũ', 'no catalog row yet: snapshot');
  assert.deepEqual(await saveShopCatalog('111', catalog([seed.products[0], custom]), 0, db), { revision: 1 });
  const knowledge = await liveKnowledge('111', snapshot, db);
  assert.deepEqual(knowledge.products.map(product => product.sku), ['X-1']);
  assert.equal(knowledge.shop.name, seed.shop.name);
  assert.equal((await readShopCatalog('111', db)).catalog.products.length, 2, 'the full catalog is kept for restoring a browser');
});

test('a stale writer gets 409 instead of overwriting the catalog', async () => {
  await ready;
  const db = wrap(full);
  await assert.rejects(saveShopCatalog('111', catalog([custom]), 0, db), error => error instanceof ShopCatalogError && error.status === 409);
  await assert.rejects(saveShopCatalog('111', catalog([custom]), 7, db), error => error.status === 409);
  assert.deepEqual(await saveShopCatalog('111', catalog([custom, { ...custom, id: 'p-y', sku: 'Y-1' }]), 1, db), { revision: 2 });
  assert.deepEqual((await liveKnowledge('111', null, db)).products.map(product => product.sku), ['X-1', 'Y-1']);
});

test('invalid catalog or revision is rejected', async () => {
  await ready;
  const db = wrap(full);
  await assert.rejects(saveShopCatalog('111', { ...catalog([]), products: 'x' }, 2, db), error => error.status === 400);
  await assert.rejects(saveShopCatalog('111', catalog([{ ...custom, price: -1 }]), 2, db), error => error.status === 400);
  await assert.rejects(saveShopCatalog('111', catalog([]), 'x', db), error => error.status === 400);
});

test('a catalog read back from the database still recognizes demo products (key order is preserved)', async () => {
  await ready;
  const db = wrap(full);
  const { revision, catalog: stored } = await readShopCatalog('111', db);
  await saveShopCatalog('111', { ...stored, products: [...seed.products.slice(0, 2), custom] }, revision, db);
  const again = await readShopCatalog('111', db);
  await saveShopCatalog('111', again.catalog, again.revision, db);
  assert.deepEqual((await liveKnowledge('111', null, db)).products.map(product => product.sku), ['X-1']);
});

test('tag rules ride the catalog: validated on save, read per Page, defaults when missing', async () => {
  const { readShopTagRules } = load('lib/services/shopCatalog.ts');
  const { DEFAULT_CONTEXT_TAG_RULES } = load('lib/services/contextTagRules.ts');
  assert.deepEqual(await readShopTagRules('111', wrap(bare)), DEFAULT_CONTEXT_TAG_RULES, 'no table yet: defaults');
  await ready;
  const db = wrap(full);
  assert.deepEqual(await readShopTagRules('222', db), DEFAULT_CONTEXT_TAG_RULES, 'no row: defaults');
  const wholesale = { id: 'si', label: 'Khách sỉ', keywords: [], type: 'vip', enabled: true };
  await saveShopCatalog('222', { ...catalog([]), contextTagRules: [wholesale] }, 0, db);
  assert.deepEqual(await readShopTagRules('222', db), [wholesale]);
  assert.deepEqual(await readShopTagRules('333', db), DEFAULT_CONTEXT_TAG_RULES, 'another Page never sees it');
  await saveShopCatalog('333', catalog([]), 0, db);
  assert.deepEqual(await readShopTagRules('333', db), DEFAULT_CONTEXT_TAG_RULES, 'row without rules: defaults');
  const many = Array.from({ length: 51 }, (_, i) => ({ ...wholesale, id: `r${i}`, label: `Nhãn ${i}` }));
  for (const contextTagRules of [[{ ...wholesale, type: 'bad' }], many, [wholesale, { ...wholesale, id: 'si2' }]]) {
    await assert.rejects(saveShopCatalog('444', { ...catalog([]), contextTagRules }, 0, db), error => error instanceof ShopCatalogError && error.status === 400);
  }
});

test('custom tag rules alone make the browser catalog worth pushing', () => {
  const { isPristine } = load('lib/services/catalogSync.ts');
  const { DEFAULT_CONTEXT_TAG_RULES } = load('lib/services/contextTagRules.ts');
  assert.equal(isPristine(catalog(seed.products)), true);
  assert.equal(isPristine({ ...catalog(seed.products), contextTagRules: DEFAULT_CONTEXT_TAG_RULES }), true);
  assert.equal(isPristine({ ...catalog(seed.products), contextTagRules: [{ id: 'si', label: 'Khách sỉ', keywords: [], type: 'vip', enabled: true }] }), false);
});

test('a server row from before label sync never wipes the browser\'s custom label set', () => {
  const { remoteTagRules } = load('lib/services/catalogSync.ts');
  const custom = [{ id: 'si', label: 'Khách sỉ', keywords: [], type: 'vip', enabled: true }];
  assert.equal(remoteTagRules({ ...catalog([]) }, custom), custom, 'server row without rules: keep the local set so it gets pushed');
  assert.deepEqual(remoteTagRules({ ...catalog([]), contextTagRules: [] }, custom), [], 'an explicit empty set from the server wins');
  const other = [{ ...custom[0], id: 'b2b' }];
  assert.equal(remoteTagRules({ ...catalog([]), contextTagRules: other }, custom), other, 'a stored set wins over the local one');
  assert.equal(remoteTagRules(catalog([]), undefined), undefined);
});
