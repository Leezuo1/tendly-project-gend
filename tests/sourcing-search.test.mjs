import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function load(file) {
  const loaded = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(name => {
    if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`);
    throw new Error(`Unexpected import: ${name}`);
  }, loaded, loaded.exports);
  return loaded.exports;
}

const { prepareSourcingSearch, normalizeSourcingPosts, hotScore } = load('lib/services/sourcingSearch.ts');
const now = new Date('2026-11-03T10:00:00Z');
const post = (extra = {}) => ({ source: ' TikTok ', externalId: '123', url: 'https://example.com/video/123', text: ' Áo polo cotton ', ...extra });

test('search plan validates industry and returns seed queries, not collected trends', () => {
  const plan = prepareSourcingSearch({ industry: ' Thời trang & phụ kiện ' }, now);
  assert.equal(plan.status, 'prepared');
  assert.equal(plan.collectionStarted, false);
  assert.deepEqual(plan.keywords, ['thời trang hot trend', 'review quần áo đáng mua', 'phụ kiện thời trang hot']);
  assert.deepEqual(plan.period, { from: '2026-10-27T10:00:00.000Z', to: now.toISOString() });
  for (const industry of [undefined, {}, 'không tồn tại', 'constructor', 'Dịch vụ', 'Khác']) {
    assert.throws(() => prepareSourcingSearch({ industry }));
  }
});

test('hot score favours views per hour and engagement; missing data scores zero', () => {
  const at = Date.parse('2026-11-03T10:00:00Z');
  const p = (publishedAt, views, likes = 0) => ({ publishedAt, metrics: { views, likes, comments: 0, shares: 0 } });
  assert.ok(hotScore(p('2026-11-02T10:00:00Z', 24000), at) > hotScore(p('2026-10-28T10:00:00Z', 24000), at), 'same views, newer is hotter');
  assert.ok(hotScore(p('2026-11-02T10:00:00Z', 10000, 2000), at) > hotScore(p('2026-11-02T10:00:00Z', 10000, 0), at), 'engagement raises the score');
  assert.equal(hotScore(p('2026-11-03T09:59:00Z', 600), at), hotScore(p('2026-11-03T04:00:00Z', 600), at), 'age floors at 6 hours');
  assert.equal(hotScore(p(null, 5000), at), 0);
  assert.equal(hotScore(p('2026-11-02T10:00:00Z', null), at), 0);
});

test('normalization keeps missing metrics and dates unknown instead of zero or collection date', () => {
  const { posts } = normalizeSourcingPosts([post({ likes: 0, views: -1, comments: '100', shares: 1.5 })], now);
  assert.equal(posts[0].source, 'tiktok');
  assert.equal(posts[0].text, 'Áo polo cotton');
  assert.equal(posts[0].publishedAt, null);
  assert.equal(posts[0].authorId, null);
  assert.equal(posts[0].collectedAt, now.toISOString());
  assert.deepEqual(posts[0].metrics, { views: null, likes: 0, comments: null, shares: null });
});

test('deduplication uses source and ID, retaining different posts and platforms', () => {
  const result = normalizeSourcingPosts([post(), post({ text: 'duplicate' }), post({ externalId: '456' }), post({ source: 'facebook' })], now);
  assert.equal(result.posts.length, 3);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.posts[0].text, 'Áo polo cotton');
});

test('invalid records and unsafe links are rejected and reported', () => {
  const result = normalizeSourcingPosts([
    post({ externalId: '' }), post({ text: ' ' }), post({ url: 'javascript:alert(1)' }),
    post({ url: 'https://user:secret@example.com' }), post({ url: 'invalid' }), post(),
  ], now);
  assert.equal(result.rejectedCount, 5);
  assert.equal(result.posts.length, 1);
});

test('publication dates are normalized; invalid and future dates stay unknown', () => {
  const result = normalizeSourcingPosts([
    post({ publishedAt: '2026-11-01T10:00:00+07:00' }),
    post({ externalId: '2', publishedAt: 'yesterday' }),
    post({ externalId: '3', publishedAt: '2027-01-01T00:00:00Z' }),
  ], now);
  assert.deepEqual(result.posts.map(item => item.publishedAt), ['2026-11-01T03:00:00.000Z', null, null]);
});
