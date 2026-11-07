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
const { decodeEscapes, sourcingItems, sourcingRelevance, compareSourcingItem, defaultSourcingCriteria, RELEVANT_AT } = loaded.exports;

const post = (externalId, text) => ({ source: 'tiktok', externalId, url: `https://www.tiktok.com/@a/video/${externalId}`, text, collectedAt: '2026-11-07T04:36:48.000Z', metrics: { views: 100, likes: 5, comments: null, shares: 1 } });
const run = posts => ({ id: 'r', kind: 'tiktok', status: 'succeeded', result: { posts }, context: {}, error: null, createdAt: 0, updatedAt: 0 });

test('emoji sent as escaped text by the provider are decoded for display', () => {
  const escaped = 'Merci ' + '\\ud83d\\ude09';
  assert.equal(decodeEscapes(escaped), 'Merci 😉');
  const [item] = sourcingItems(run([post('1', 'Áo mới ' + '\\ud83d\\udc95' + '\nDòng hai')]));
  assert.equal(item.title, 'Áo mới 💕');
  assert.ok(item.text.includes('Dòng hai'));
});

test('relevance keeps posts that mention the query and drops off-topic TikTok results', () => {
  const items = sourcingItems(run([post('1', 'Áo thun chất liệu thoáng mát cho mùa hè'), post('2', 'PERIODIC TABLE 1. H - Hydrogen'), post('3', 'Te amo 💕 Je t\'aime')]));
  const scores = items.map(item => sourcingRelevance(item, ['chất liệu thoáng mát']));
  assert.equal(scores[0], 1);
  assert.ok(scores[1] < RELEVANT_AT && scores[2] < RELEVANT_AT);
  assert.equal(sourcingRelevance(items[0], ['quần jean', 'chất liệu thoáng mát']), 1);
  assert.equal(sourcingRelevance(items[0], []), 0);
});

test('TikTok posts are not checked against supplier-only criteria (price, MOQ, region)', () => {
  const criteria = { ...defaultSourcingCriteria('Thời trang & phụ kiện'), minPrice: 10000, maxMoq: 50, required: 'cotton', quality: 'Có chứng nhận' };
  const [item] = sourcingItems(run([post('1', 'Áo cotton thoáng mát')]));
  assert.deepEqual(compareSourcingItem(item, criteria), { matched: ['Có nhắc: cotton'], missing: [], mismatched: [] });
  const supplier = { ...item, source: 'google' };
  assert.ok(compareSourcingItem(supplier, criteria).missing.includes('MOQ / đơn vị'));
});
