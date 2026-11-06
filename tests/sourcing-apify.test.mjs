import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const db = new PGlite();
const ready = (async () => { for (const file of ['014-sourcing.sql', '019-sourcing-workflow.sql', '020-ai-global-settings.sql']) await db.exec(readFileSync(`db/migrations/${file}`, 'utf8')); })();
const query = async (sql, values) => {
  const result = await db.query(sql, values);
  return { rows: result.rows, rowCount: result.rows.length || result.affectedRows || 0 };
};
const pool = { query, connect: async () => ({ query, release() {} }) };
const originalFetch = globalThis.fetch, originalToken = process.env.APIFY_API_TOKEN;
after(async () => { await ready; await db.close(); });
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.APIFY_API_TOKEN; else process.env.APIFY_API_TOKEN = originalToken;
});

async function fixture() {
  await ready;
  await db.exec('TRUNCATE sourcing_runs,sourcing_start_limits CASCADE');
  process.env.APIFY_API_TOKEN = 'test-token-do-not-expose';
  const cache = new Map();
  const load = file => {
    if (file === 'lib/services/messengerPostgres.ts') return { getMessengerPool: () => pool };
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function('require', 'module', 'exports', compiled)(name => name.startsWith('@/') ? load(`${name.slice(2)}.ts`) : require(name), loaded, loaded.exports);
    return loaded.exports;
  };
  return { ...load('lib/services/sourcingApify.ts'), ...load('lib/services/sourcingRuns.ts'), ...load('lib/services/sourcingWorkflow.ts'), ...load('lib/services/sourcingCriteria.ts') };
}
const json = value => Response.json(value);
const industry = { industry: 'Thời trang & phụ kiện' };
const runResponse = (status = 'RUNNING') => ({ data: { id: 'ProviderRun123', status, defaultDatasetId: 'Dataset123' } });
const rawPost = extra => ({ id: '1234567890123456789', text: 'Áo polo cotton',
  webVideoUrl: 'https://www.tiktok.com/@shop/video/1234567890123456789',
  createTimeISO: new Date(Date.now() - 86400_000).toISOString(), authorMeta: { id: 'author1' }, playCount: 100, ...extra });

test('builds bounded Actor inputs and rejects invalid search products before spending', async () => {
  const f = await fixture();
  const tiktok = f.sourcingRequest('tiktok', industry);
  assert.equal(tiktok.actorInput.searchSection, '/video');
  assert.equal(tiktok.actorInput.videoSearchDateFilter, 'PAST_WEEK');
  assert.equal(tiktok.actorInput.proxyCountryCode, 'VN');
  assert.equal(tiktok.actorInput.resultsPerPage, 20);
  assert.equal(tiktok.actorInput.shouldDownloadVideos, false);
  const supplier = f.sourcingRequest('suppliers', { product: 'Áo polo cotton' });
  assert.equal(supplier.actorInput.countryCode, 'vn');
  assert.equal(supplier.actorInput.languageCode, 'vi');
  assert.equal(supplier.actorInput.maxPagesPerQuery, 1);
  assert.equal(supplier.context.queries.length, 2);
  for (const product of ['', 'a', 'x'.repeat(121), 'https://example.com', 'áo site:example.com', 'áo\nsite:test']) {
    assert.throws(() => f.sourcingRequest('suppliers', { product }));
  }
});

test('request preview persists criteria without spending; approval binds one run and retries preserve unknown', async () => {
  const f = await fixture(); let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('lost response'); };
  const criteria = { ...f.defaultSourcingCriteria(industry.industry), product: 'Áo polo', keywords: ['áo polo cotton'], maxMoq: 50 };
  const id = await f.prepareSourcingRequest('owner', criteria);
  let workspace = await f.sourcingWorkspace('owner');
  assert.equal(calls, 0); assert.deepEqual(workspace.requests[0].plan.queries, criteria.keywords);
  assert.equal(workspace.requests[0].plan.maxChargeUsd, 0.5);
  assert.deepEqual((await f.sourcingWorkspace('other')).requests, []);
  await assert.rejects(f.runSourcingRequest('other', id, 1, true), error => error.status === 404);
  await assert.rejects(f.runSourcingRequest('owner', id, 1, false), /Xác nhận/);
  await assert.rejects(f.runSourcingRequest('owner', id, 0, true), error => error.status === 409);
  assert.equal(calls, 0);
  const run = await f.runSourcingRequest('owner', id, 1, true);
  assert.equal(run.status, 'unknown'); assert.equal(calls, 1);
  workspace = await f.sourcingWorkspace('owner');
  assert.equal(workspace.requests[0].run.id, run.id); assert.ok(workspace.requests[0].approvedAt);
  delete process.env.APIFY_API_TOKEN;
  assert.equal((await f.runSourcingRequest('owner', id, 1, true)).id, run.id);
  assert.equal(calls, 1);
  await assert.rejects(f.prepareSourcingRequest('owner', criteria, id, 2), error => error.status === 409);
});

test('criteria validation and comparison preserve unknown money, units and MOQ', async () => {
  const f = await fixture(), criteria = { ...f.defaultSourcingCriteria(industry.industry), minPrice: 100, maxPrice: 200, maxMoq: 10 };
  for (const input of [{ keywords: ['  '] }, { keywords: ['áo\nsite:test'] }, { minPrice: 300 }, { maxMoq: -1 }, { resultLimit: 21 }]) assert.throws(() => f.parseSourcingCriteria({ ...criteria, ...input }));
  const item = { title: 'Áo cotton', text: '', price: 0, currency: null, unit: null, moq: null, region: null };
  const comparison = f.compareSourcingItem(item, criteria);
  assert.deepEqual(comparison.mismatched, []); assert.equal(comparison.missing.length, 3);
  assert.ok(!comparison.matched.includes('Khoảng giá'));
  assert.ok(f.compareSourcingItem({ ...item, price: 500, currency: 'VND', unit: 'sản phẩm', moq: 5 }, criteria).mismatched.includes('Giá ngoài khoảng yêu cầu'));
});

test('shortlist decisions require an owned completed result and survive workspace reload', async () => {
  const f = await fixture();
  const id = await f.prepareSourcingRequest('owner', { ...f.defaultSourcingCriteria(industry.industry), kind: 'suppliers', product: 'Áo polo' });
  globalThis.fetch = async () => json(runResponse());
  const run = await f.runSourcingRequest('owner', id, 1, true);
  globalThis.fetch = async url => url.includes('/items?') ? json([{ organicResults: [{ title: 'Xưởng áo', url: 'https://example.com/polo', description: 'Cotton' }] }]) : json(runResponse('SUCCEEDED'));
  const done = await f.readSourcingRun('owner', run.id), item = f.sourcingItems(done)[0];
  await assert.rejects(f.saveSourcingDecision('other', { runId: run.id, itemKey: item.key, status: 'checked', note: '' }), error => error.status === 404);
  await assert.rejects(f.readSourcingSelection('owner', run.id, 'invented-result'), error => error.status === 404);
  await f.saveSourcingDecision('owner', { runId: run.id, itemKey: item.key, status: 'shortlist', note: 'Cần hỏi lại MOQ' });
  assert.equal((await f.sourcingWorkspace('owner')).decisions[0].note, 'Cần hỏi lại MOQ');
  assert.equal((await f.readSourcingSelection('owner', run.id, item.key)).price, null);
  await f.saveSourcingDecision('owner', { runId: run.id, itemKey: item.key, status: 'checked', note: 'Shop đã liên hệ' });
  assert.equal((await f.sourcingWorkspace('owner')).decisions.length, 1);
  assert.equal((await f.sourcingWorkspace('owner')).decisions[0].status, 'checked');
});

test('missing token and invalid industry do not call Apify or reserve runs', async () => {
  const f = await fixture(); let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('not allowed'); };
  delete process.env.APIFY_API_TOKEN;
  await assert.rejects(f.createSourcingRun('owner', 'tiktok', industry), error => error.code === 'APIFY_NOT_CONFIGURED');
  await assert.rejects(f.createSourcingRun('owner', 'tiktok', { industry: 'constructor' }));
  assert.equal(calls, 0);
  assert.equal((await query('SELECT * FROM sourcing_runs')).rowCount, 0);
});

test('start uses fixed Actor, server header, budget and timeout; duplicate starts are blocked', async () => {
  const f = await fixture(); let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.match(url, /actors\/clockworks~tiktok-scraper\/runs/);
    assert.equal(new URL(url).searchParams.get('timeout'), '300');
    assert.equal(new URL(url).searchParams.get('maxTotalChargeUsd'), '0.5');
    assert.ok(!url.includes(process.env.APIFY_API_TOKEN));
    assert.equal(options.headers.Authorization, `Bearer ${process.env.APIFY_API_TOKEN}`);
    assert.equal(JSON.parse(options.body).resultsPerPage, 20);
    return json(runResponse());
  };
  const run = await f.createSourcingRun('owner', 'tiktok', industry);
  assert.equal(run.status, 'running');
  assert.ok(!JSON.stringify(run).includes('ProviderRun123'));
  assert.ok(!JSON.stringify(run).includes(process.env.APIFY_API_TOKEN));
  await assert.rejects(f.createSourcingRun('owner', 'tiktok', industry), error => error.status === 429);
  await query('UPDATE sourcing_start_limits SET next_start_at=0');
  await assert.rejects(f.createSourcingRun('owner', 'tiktok', industry), error => error.status === 429);
  assert.equal(calls, 1);
});

test('run ownership is checked before contacting provider; pending run does not read dataset', async () => {
  const f = await fixture();
  globalThis.fetch = async () => json(runResponse());
  const run = await f.createSourcingRun('owner', 'tiktok', industry);
  let calls = 0;
  globalThis.fetch = async () => { calls++; return json(runResponse('RUNNING')); };
  await assert.rejects(f.readSourcingRun('other-owner', run.id), error => error.status === 404);
  await assert.rejects(f.readSourcingRun('owner', '../ProviderRun123'), error => error.status === 404);
  assert.equal(calls, 0);
  assert.equal((await f.readSourcingRun('owner', run.id)).status, 'running');
  assert.equal(calls, 1);
});

test('TikTok maps metrics, deduplicates and excludes undated/old posts; completed reads are cached in DB', async () => {
  const f = await fixture();
  globalThis.fetch = async () => json(runResponse());
  const run = await f.createSourcingRun('owner', 'tiktok', industry);
  let reads = 0;
  globalThis.fetch = async url => {
    reads++;
    if (url.includes('actor-runs/')) return json(runResponse('SUCCEEDED'));
    assert.match(url, /datasets\/Dataset123\/items/);
    return json([rawPost(), rawPost(), rawPost({ id: '2', createTimeISO: null }),
      rawPost({ id: '3', createTimeISO: '2020-01-01T00:00:00Z' }), { error: 'bad record' }]);
  };
  const done = await f.readSourcingRun('owner', run.id);
  assert.equal(done.status, 'succeeded');
  assert.equal(done.result.posts.length, 1);
  assert.equal(done.result.posts[0].metrics.views, 100);
  assert.equal(done.result.posts[0].metrics.likes, null);
  assert.equal(done.result.posts[0].authorId, 'author1');
  assert.equal(done.result.duplicateCount, 1);
  assert.equal(done.result.rejectedCount, 1);
  assert.equal(done.result.excludedByDateCount, 2);
  assert.deepEqual(await f.readSourcingRun('owner', run.id), done);
  assert.equal(reads, 2);
});

test('Google extracts organic candidates only, canonicalizes URLs and preserves query evidence', async () => {
  const f = await fixture();
  globalThis.fetch = async (url, options) => {
    assert.match(url, /apify~google-search-scraper/);
    assert.match(JSON.parse(options.body).queries, /áo polo bán sỉ Việt Nam/);
    return json(runResponse());
  };
  const run = await f.createSourcingRun('owner', 'suppliers', { product: 'áo polo' });
  globalThis.fetch = async url => url.includes('actor-runs/') ? json(runResponse('SUCCEEDED')) : json([
    { searchQuery: { term: 'query1' }, paidResults: [{ title: 'Ad', url: 'https://ad.example' }], organicResults: [
      { title: 'Xưởng A', url: 'https://example.com/p?id=1&utm_source=google#top', description: 'Nhận may áo', position: 1 },
      { title: 'bad', url: 'javascript:alert(1)' },
    ] },
    { searchQuery: { term: 'query2' }, organicResults: [{ title: 'Xưởng A', url: 'https://example.com/p?id=1' }] },
  ]);
  const done = await f.readSourcingRun('owner', run.id);
  assert.equal(done.status, 'succeeded');
  assert.equal(done.result.candidates.length, 1);
  assert.equal(done.result.candidates[0].url, 'https://example.com/p?id=1');
  assert.deepEqual(done.result.candidates[0].queries, ['query1', 'query2']);
  assert.equal(done.result.candidates[0].verified, false);
  assert.equal(done.result.duplicateCount, 1);
  assert.equal(done.result.rejectedCount, 1);
  assert.equal(done.result.candidates[0].price, null);
});

test('empty datasets differ from failed runs and malformed output', async () => {
  const f = await fixture();
  globalThis.fetch = async () => json(runResponse());
  const empty = await f.createSourcingRun('owner1', 'tiktok', industry);
  const failed = await f.createSourcingRun('owner2', 'tiktok', industry);
  const malformed = await f.createSourcingRun('owner3', 'suppliers', { product: 'áo polo' });
  globalThis.fetch = async url => url.includes('actor-runs/') ? json(runResponse('SUCCEEDED')) : json([]);
  assert.equal((await f.readSourcingRun('owner1', empty.id)).status, 'empty');
  globalThis.fetch = async () => json(runResponse('TIMED-OUT'));
  assert.equal((await f.readSourcingRun('owner2', failed.id)).status, 'failed');
  globalThis.fetch = async url => url.includes('actor-runs/') ? json(runResponse('SUCCEEDED')) : json([{ error: 'blocked' }]);
  await assert.rejects(f.readSourcingRun('owner3', malformed.id), error => error.code === 'APIFY_BAD_DATASET');
  assert.equal((await query('SELECT status FROM sourcing_runs WHERE id=$1', [malformed.id])).rows[0].status, 'running');
});

test('lost start response stays unknown and is not automatically retried; secrets are not returned', async () => {
  const f = await fixture(); let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error(`network ${process.env.APIFY_API_TOKEN}`); };
  const run = await f.createSourcingRun('owner', 'tiktok', industry);
  assert.equal(run.status, 'unknown');
  assert.ok(run.error);
  assert.ok(!JSON.stringify(run).includes(process.env.APIFY_API_TOKEN));
  assert.equal((await f.readSourcingRun('owner', run.id)).status, 'unknown');
  assert.equal(calls, 1);
});

test('provider rejection is recorded as failure while server errors remain uncertain', async () => {
  const f = await fixture();
  globalThis.fetch = async () => new Response('secret provider error', { status: 401 });
  assert.equal((await f.createSourcingRun('owner1', 'tiktok', industry)).status, 'failed');
  globalThis.fetch = async () => new Response('secret provider error', { status: 500 });
  assert.equal((await f.createSourcingRun('owner2', 'tiktok', industry)).status, 'unknown');
});
