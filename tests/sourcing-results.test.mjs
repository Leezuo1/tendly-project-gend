import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync('lib/services/sourcingCriteria.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function('require', 'module', 'exports', source)(name => name === '@/lib/services/sourcingSearch' ? { SourcingInputError: Error } : require(name), loaded, loaded.exports);
const { decodeEscapes, sourcingItems, compareSourcingItem, defaultSourcingCriteria } = loaded.exports;

const post = (externalId, text) => ({ source: 'tiktok', externalId, url: `https://www.tiktok.com/@a/video/${externalId}`, text, collectedAt: '2026-11-07T04:36:48.000Z', metrics: { views: 100, likes: 5, comments: null, shares: 1 } });
const run = posts => ({ id: 'r', kind: 'tiktok', status: 'succeeded', result: { posts }, context: {}, error: null, createdAt: 0, updatedAt: 0 });

test('emoji sent as escaped text by the provider are decoded for display', () => {
  const escaped = 'Merci ' + '\\ud83d\\ude09';
  assert.equal(decodeEscapes(escaped), 'Merci 😉');
  const [item] = sourcingItems(run([post('1', 'Áo mới ' + '\\ud83d\\udc95' + '\nDòng hai')]));
  assert.equal(item.title, 'Áo mới 💕');
  assert.ok(item.text.includes('Dòng hai'));
});

test('TikTok posts are not checked against supplier-only criteria (price, MOQ, region)', () => {
  const criteria = { ...defaultSourcingCriteria('Thời trang & phụ kiện'), minPrice: 10000, maxMoq: 50, required: 'cotton', quality: 'Có chứng nhận' };
  const [item] = sourcingItems(run([post('1', 'Áo cotton thoáng mát')]));
  assert.deepEqual(compareSourcingItem(item, criteria), { matched: ['Có nhắc: cotton'], missing: [], mismatched: [] });
  const supplier = { ...item, source: 'google' };
  assert.ok(compareSourcingItem(supplier, criteria).missing.includes('MOQ / đơn vị'));
});

const load = (file, stubs) => {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => stubs[name] ?? require(name), module, module.exports);
  return module.exports;
};

test('TikTok queries stay inside the shop industry: bare keywords get the product or industry term', () => {
  const { scopedTiktokQueries } = load('lib/services/sourcingSearch.ts', { '@/lib/data/workspace': { industries: [] } });
  const fashion = 'Thời trang & phụ kiện';
  assert.deepEqual(scopedTiktokQueries(fashion, ['chất liệu thoáng mát']), ['thời trang chất liệu thoáng mát']);
  assert.deepEqual(scopedTiktokQueries(fashion, ['chất liệu thoáng mát'], 'áo thun'), ['áo thun chất liệu thoáng mát']);
  assert.deepEqual(scopedTiktokQueries(fashion, ['áo polo cotton'], 'Áo polo'), ['áo polo cotton']);
  assert.deepEqual(scopedTiktokQueries(fashion, ['phối đồ công sở']), ['phối đồ công sở']);
  assert.deepEqual(scopedTiktokQueries(fashion, []), ['thời trang', 'phối đồ', 'phụ kiện thời trang']);
});

test('LLM analysis keeps only findings backed by real collected items and maps them to item keys', () => {
  const { parseSourcingAnalysis } = load('lib/services/sourcingAnalysis.ts', { '@/lib/services/messengerPostgres': {}, '@/lib/services/gemini': {}, '@/lib/services/sourcingRuns': {}, '@/lib/services/sourcingCriteria': {} });
  const ids = new Map([['S1', 'k1'], ['S2', 'k2']]);
  const result = parseSourcingAnalysis(JSON.stringify({ summary: 'Tóm tắt', relevantCount: 9,
    findings: [{ title: 'Áo linen', detail: 'Nhiều lượt xem', sourceIds: ['S2', 'S2', 'S9'] }, { title: 'Bịa', detail: 'Không nguồn', sourceIds: ['S9'] }],
    productIdeas: [{ name: 'Sơ mi linen', reason: 'Được hỏi nhiều', sourceIds: ['S1'] }], caveats: ['Tương tác không phải doanh số', ''] }), ids);
  assert.deepEqual(result.findings, [{ title: 'Áo linen', detail: 'Nhiều lượt xem', sources: ['k2'] }]);
  assert.deepEqual(result.productIdeas[0].sources, ['k1']);
  assert.equal(result.relevantCount, 2, 'counted from real cited sources, not the LLM number');
  assert.deepEqual(result.caveats, ['Tương tác không phải doanh số']);
  assert.throws(() => parseSourcingAnalysis(JSON.stringify({ summary: '', findings: [] }), ids));
});
