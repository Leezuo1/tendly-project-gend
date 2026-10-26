import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { after, afterEach, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const db = new PGlite();
const ready = db.exec(readFileSync('db/migrations/007-shopee.sql', 'utf8'));
const query = async (sql, values) => {
  const result = await db.query(sql, values);
  return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
};
const pool = { query, connect: async () => ({ query, release() {} }) };
const originalFetch = globalThis.fetch;
const env = { SHOPEE_PARTNER_ID: '123', SHOPEE_PARTNER_KEY: 'test-partner-key', SHOPEE_SHOP_ID: '456',
  SHOPEE_REDIRECT_URL: 'http://localhost/api/shopee/callback', SHOPEE_SANDBOX: 'false',
  DATABASE_URL: 'postgresql://test-only', INBOX_ACCESS_KEY: 'test-inbox-key-at-least-24-characters' };
const originalEnv = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
afterEach(() => {
  globalThis.fetch = originalFetch;
  delete globalThis.window; delete globalThis.localStorage; delete globalThis.sessionStorage;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
after(async () => { await ready; await db.close(); });

function loader(overrides = {}) {
  const cache = new Map();
  const load = (file) => {
    if (overrides[file]) return overrides[file];
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', compiled)(
      (name) => name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), loaded, loaded.exports);
    return loaded.exports;
  };
  return load;
}

async function fixture() {
  await ready;
  await db.exec('TRUNCATE shopee_connection');
  Object.assign(process.env, env);
  const load = loader({ 'lib/services/messengerPostgres.ts': { getMessengerPool: () => pool } });
  const api = load('lib/services/shopee.ts');
  const storage = load('lib/services/shopeeStorage.ts');
  const session = load('lib/services/inboxAccess.ts').createInboxSession(env.INBOX_ACCESS_KEY);
  const request = (path, method = 'GET', extra = {}) => new Request(`http://localhost${path}`, {
    method, headers: { cookie: `tendly_inbox_session=${session}`, origin: 'http://localhost', ...extra },
  });
  return { api, storage, config: api.shopeeConfig(), load, request };
}

const stock = (qty) => ({ summary_info: { total_available_stock: qty, total_reserved_stock: 999 } });
const price = (amount, currency = 'VND') => [{ currency, current_price: amount }];
const item = (id = 111, hasModel = false) => ({ item_id: id, item_name: 'Áo thun', item_sku: '',
  item_status: 'NORMAL', has_model: hasModel, price_info: price(100000), stock_info_v2: stock(7) });
function provider(f, options = {}) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    calls.push({ url, init });
    assert.equal(url.origin, f.config.host);
    const token = url.searchParams.get('access_token') || '';
    const base = `${env.SHOPEE_PARTNER_ID}${url.pathname}${url.searchParams.get('timestamp')}${token}${token ? env.SHOPEE_SHOP_ID : ''}`;
    assert.equal(url.searchParams.get('sign'), createHmac('sha256', env.SHOPEE_PARTNER_KEY).update(base).digest('hex'));
    if (url.pathname.startsWith('/api/v2/auth/')) {
      assert.equal(init.method, 'POST');
      const body = JSON.parse(init.body);
      assert.equal(body.partner_id, 123); assert.equal(body.shop_id, 456);
      return Response.json({ error: '', access_token: 'test-access-token', refresh_token: 'test-refresh-rotated', expire_in: 14400 });
    }
    assert.equal(url.searchParams.get('shop_id'), '456');
    if (options.fail === url.pathname) return Response.json({ error: 'error_auth', message: 'SECRET_PROVIDER_ERROR' });
    if (url.pathname.endsWith('/get_item_list')) {
      if (options.empty) return Response.json({ response: { item: [], has_next_page: false } });
      const next = url.searchParams.get('offset') !== '0';
      return Response.json({ response: { item: [{ item_id: next ? 222 : 111 }], has_next_page: !next,
        next_offset: options.badPage ? 0 : 1 } });
    }
    if (url.pathname.endsWith('/get_item_base_info')) {
      const id = Number(url.searchParams.get('item_id_list'));
      const data = item(id, id === 222);
      if (options.currency) data.price_info = price(100, options.currency);
      if (options.missingStock) delete data.stock_info_v2;
      return Response.json({ response: { item_list: options.missingDetail ? [] : [data] } });
    }
    if (url.pathname.endsWith('/get_model_list')) return Response.json({ response: {
      tier_variation: [{ name: 'Màu sắc', option_list: [{ option: 'Đen' }] },
        { name: 'Size', option_list: [{ option: 'S' }, { option: 'M' }] }],
      model: [{ model_id: 10, model_sku: 'SAME', model_status: 'MODEL_NORMAL', tier_index: [0, 0], price_info: price(120000), stock_info_v2: stock(0) },
        { model_id: 11, model_sku: 'SAME', model_status: 'MODEL_NORMAL', tier_index: [0, 1], price_info: price(130000), stock_info_v2: stock(4) },
        { model_id: 12, model_status: 'MODEL_UNAVAILABLE' }],
    } });
    if (url.pathname.endsWith('/get_shop_info')) return Response.json({ shop_name: 'Shop thật demo', region: options.region || 'VN' });
    throw new Error(`Unexpected Shopee API ${url.pathname}`);
  };
  return calls;
}

test('authorization link uses current Shopee flow, validates config and sets a short HttpOnly state cookie', async () => {
  const f = await fixture();
  const route = f.load('app/api/shopee/connect/route.ts');
  const response = await route.POST(f.request('/api/shopee/connect', 'POST'));
  assert.equal(response.status, 200);
  const url = new URL((await response.json()).url);
  assert.equal(url.origin, 'https://open.shopee.com');
  assert.equal(url.pathname, '/auth');
  assert.equal(url.searchParams.get('auth_type'), 'seller');
  assert.equal(url.searchParams.get('redirect_uri'), env.SHOPEE_REDIRECT_URL);
  assert.match(url.searchParams.get('state'), /^[a-f0-9]{64}$/);
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax; Max-Age=600/);
  assert.equal(url.href.includes(env.SHOPEE_PARTNER_KEY), false);
  assert.equal((await route.POST(new Request('http://localhost/api/shopee/connect', { method: 'POST' }))).status, 401);
  assert.equal((await route.POST(f.request('/api/shopee/connect', 'POST', { origin: 'https://evil.example' }))).status, 403);
  process.env.SHOPEE_REDIRECT_URL = 'https://other.example/api/shopee/callback';
  assert.equal((await route.POST(f.request('/api/shopee/connect', 'POST'))).status, 400);
  process.env.SHOPEE_REDIRECT_URL = 'http://evil.example/api/shopee/callback';
  assert.throws(() => f.api.shopeeRedirect(), /HTTPS/);
  process.env.SHOPEE_SHOP_ID = '9007199254740993';
  assert.throws(() => f.api.shopeeConfig(), /hợp lệ/);
});

test('callback rejects forged state, wrong shop and main account, then persists valid tokens without exposing them', async () => {
  const f = await fixture(); const calls = provider(f);
  const route = f.load('app/api/shopee/callback/route.ts');
  const state = 'a'.repeat(64);
  const callback = (suffix, cookieState = state) => route.GET(new Request(`http://localhost/api/shopee/callback?state=${state}&code=test-code&${suffix}`,
    { headers: { cookie: `tendly_shopee_state=${cookieState}` } }));
  assert.equal((await callback('shop_id=456', 'b'.repeat(64))).status, 400);
  assert.equal((await callback('shop_id=999')).status, 400);
  assert.equal((await callback('main_account_id=123')).status, 400);
  assert.equal(calls.length, 0);
  const response = await callback('shop_id=456');
  assert.equal(response.status, 303);
  assert.match(response.headers.get('location'), /cau-hinh-ai\?tab=products/);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  const status = await f.load('app/api/shopee/route.ts').GET(f.request('/api/shopee'));
  const data = await status.json();
  assert.equal(data.source.connected, true);
  assert.deepEqual(data.products, []);
  assert.equal(JSON.stringify(data).includes('token'), false);
  await db.exec(readFileSync('db/migrations/007-shopee.sql', 'utf8'));
  assert.equal((await db.query('SELECT access_token FROM shopee_connection')).rows[0].access_token, 'test-access-token');
});

test('sync paginates, keeps variant stock/price and stable IDs despite duplicate or missing SKU; re-sync is idempotent', async () => {
  const f = await fixture(); provider(f);
  await f.storage.authorizeShopee(f.config, 'code', pool);
  const route = f.load('app/api/shopee/sync/route.ts');
  const response = await route.POST(f.request('/api/shopee/sync', 'POST'));
  assert.equal(response.status, 200);
  const first = await response.json();
  assert.equal(first.products.length, 3); assert.equal(first.added, 3);
  assert.deepEqual(first.products.map((p) => p.qty), [7, 0, 4]);
  assert.deepEqual(first.products.map((p) => p.price), [100000, 120000, 130000]);
  assert.equal(new Set(first.products.map((p) => p.id)).size, 3);
  assert.match(first.products[2].name, /Màu sắc: Đen, Size: M/);
  assert.equal(first.source.name, 'Shop thật demo');
  const second = await f.storage.syncShopee(f.config, pool);
  assert.equal(second.added, 0); assert.equal(second.changed, 0); assert.equal(second.removed, 0);
  assert.equal(second.source.syncCount, 2);
  provider(f, { empty: true });
  const empty = await f.storage.syncShopee(f.config, pool);
  assert.deepEqual(empty.products, []); assert.equal(empty.removed, 3);
});

test('failed catalog preserves snapshot and newly rotated refresh token, releases lock, and sanitizes provider errors', async () => {
  const f = await fixture(); provider(f);
  await f.storage.authorizeShopee(f.config, 'code', pool);
  const before = await f.storage.syncShopee(f.config, pool);
  await query('UPDATE shopee_connection SET expires_at=0,refresh_token=$1', ['old-refresh']);
  const calls = provider(f, { fail: '/api/v2/product/get_model_list' });
  const response = await f.load('app/api/shopee/sync/route.ts').POST(f.request('/api/shopee/sync', 'POST'));
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes('SECRET_PROVIDER_ERROR'), false);
  assert.equal(JSON.parse(calls[0].init.body).refresh_token, 'old-refresh');
  const row = (await query('SELECT * FROM shopee_connection')).rows[0];
  assert.equal(row.refresh_token, 'test-refresh-rotated');
  assert.deepEqual(row.products_json, before.products);
  assert.equal(Number(row.last_synced_at), before.source.lastSyncedAt);
  provider(f);
  assert.equal((await f.storage.syncShopee(f.config, pool)).changed, 0);
});

test('invalid pagination, incomplete details/stock and foreign currency/region never replace valid data', async () => {
  const f = await fixture(); provider(f);
  await f.storage.authorizeShopee(f.config, 'code', pool);
  const before = await f.storage.syncShopee(f.config, pool);
  for (const options of [{ badPage: true }, { missingDetail: true }, { missingStock: true }, { currency: 'USD' }, { region: 'SG' }]) {
    provider(f, options);
    await assert.rejects(f.storage.syncShopee(f.config, pool));
    assert.deepEqual((await f.storage.readShopee(f.config, pool)).products, before.products);
  }
  process.env.SHOPEE_SHOP_ID = '999';
  assert.equal((await f.storage.readShopee(f.api.shopeeConfig(), pool)).source.connected, false);
  await assert.rejects(f.storage.syncShopee(f.api.shopeeConfig(), pool), /kết nối shop/);
});

test('busy sync returns conflict and client is destroyed if its database lock cannot be released', async () => {
  const f = await fixture(); let released;
  const busy = { connect: async () => ({ query: async () => ({ rows: [{ acquired: false }] }), release: (e) => { released = e; } }) };
  await assert.rejects(f.storage.syncShopee(f.config, busy), (error) => error.status === 409);
  assert.equal(released, undefined);
  const broken = { connect: async () => ({ query: async (sql) => {
    if (sql.includes('pg_try_advisory')) return { rows: [{ acquired: true }] };
    if (sql.includes('pg_advisory_unlock')) throw new Error('connection lost');
    return { rows: [] };
  }, release: (e) => { released = e; } }) };
  await assert.rejects(f.storage.syncShopee(f.config, broken), /kết nối shop/);
  assert.ok(released instanceof Error);
});

test('real sync reaches AI knowledge, preserves manual CSV edits and never mutates products on failed sync', async () => {
  const f = await fixture();
  const saved = new Map(); globalThis.window = new EventTarget();
  globalThis.localStorage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: (key) => saved.delete(key) };
  const api = f.load('lib/services/api.ts').productApi;
  const browserDb = f.load('lib/services/mockDb.ts');
  const sample = browserDb.readDb().products[0];
  await api.importMany([{ ...sample, price: 123456 }]);
  let failure = false;
  const real = { ...sample, id: 'shopee:456:111:0', sku: sample.sku, price: 99999, qty: 0 };
  const source = { name: 'Shop thật demo', connected: true, lastSyncedAt: Date.now(), syncCount: 1 };
  globalThis.fetch = async (url) => {
    if (url === '/api/inbox/session') return Response.json({ ready: true });
    return failure ? Response.json({ error: 'Shopee unavailable' }, { status: 502 })
      : Response.json({ products: [real], source, added: 1, changed: 0, removed: 0 });
  };
  const result = await api.syncShopee();
  assert.equal(result.products.length, 2);
  assert.equal(result.products.find((p) => p.id === sample.id).price, 123456);
  const knowledge = f.load('lib/services/aiChat.ts').currentAiKnowledge();
  assert.equal(knowledge.products.find((p) => p.id === real.id).qty, 0);
  assert.match(f.load('lib/services/aiKnowledge.ts').buildAiSystemPrompt(knowledge), /shopee:/);
  await api.importMany([{ ...real, price: 55555 }]);
  assert.equal(browserDb.readDb().products.find((p) => p.id === real.id).price, 99999);
  const before = structuredClone(browserDb.readDb().products);
  failure = true;
  await assert.rejects(api.syncShopee(), /Shopee unavailable/);
  assert.deepEqual(browserDb.readDb().products, before);
});
