import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function fixture() {
  let provider = async () => { throw new Error('Review timeout'); };
  const cache = new Map(), calls = [];
  const load = file => {
    if (file === 'lib/services/gemini.ts') return { generateGeminiJson: async options => { calls.push(options); return provider(options); } };
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', code)(name => name.startsWith('@/') ? load(`${name.slice(2)}.ts`) : require(name), loaded, loaded.exports);
    return loaded.exports;
  };
  return { ...load('lib/services/reviewEvidence.ts'), ...load('lib/services/aiPostReview.ts'), ...load('lib/services/marketingReviewSources.ts'), load, calls, setProvider: fn => { provider = fn; } };
}
const p = { id: 'p1', sku: 'AT-01', name: 'Áo thun cotton', material: 'Cotton', category: 'Áo', price: 221000, qty: 0, stockKnown: false, colors: ['Trắng'], sizes: ['M'] };
const knowledge = { shop: { name: 'Shop', email: '', phone: '' }, productSource: { name: 'Catalog', connected: false, lastSyncedAt: 1 }, products: [p], emailTriggers: [], faqs: [
  { id: 'shipping', question: 'Phí ship?', answer: 'Phí ship 30.000đ, kiểm tra theo địa chỉ.', keywords: ['ship', 'giao hàng'], tag: 'Giao hàng', active: true },
  { id: 'return', question: 'Chính sách đổi trả?', answer: 'Kiểm tra điều kiện trước khi đổi.', keywords: ['đổi trả'], tag: 'Đổi trả', active: true },
] };
const draft = (content = 'Áo giá 259.000đ, ship bao nhiêu?') => ({ title: 'Áo cotton', content, hashtags: ['#ao'], imageIdea: 'Áo trắng trên bàn', imagePrompt: '' });
const item = (original, extra = {}) => ({ draftId: 'draft-0', status: 'unchanged', finalDraft: original, changes: [], issues: [], ...extra });
function evidence(f, original = draft()) {
  return f.selectReviewEvidence([original], f.knowledgeReviewSources(knowledge, 'shop:111', 'confirmed-page', '1', 1), 'shop:111', ['p1'], 'content-input');
}

test('Review selects only relevant facts and independent FAQ, excludes foreign scope and unrelated policy', () => {
  const f = fixture(), catalog = f.knowledgeReviewSources(knowledge, 'shop:111', 'page', '1', 1);
  catalog.push(...f.knowledgeReviewSources({ ...knowledge, products: [{ ...p, id: 'p2', sku: 'FOREIGN', price: 1 }] }, 'shop:222', 'foreign', '1', 1));
  const selected = f.selectReviewEvidence([draft()], catalog, 'shop:111', ['p1'], 'hash');
  assert.equal(selected.sources.length, 2); assert.equal(selected.sources[0].data.price, 221000);
  assert.equal(selected.sources[0].data.qty, undefined); assert.equal(selected.sources[1].data.id, 'shipping');
  assert.ok(!selected.sources.some(s => s.scope === 'shop:222' || s.data.id === 'return'));
});

test('Review rejects unstable IDs, invented refs, incorrect changes and unusable final drafts', () => {
  const f = fixture(), original = draft('Áo cotton'), e = evidence(f, original);
  const parse = variants => f.parseMarketingReview(JSON.stringify({ variants }), [original], e, 'facebook');
  assert.equal(parse([item(original)])[0].status, 'unchanged');
  assert.throws(() => parse([])); assert.throws(() => parse([item(original), item(original)]));
  assert.throws(() => parse([item(original, { draftId: 'draft-1' })]));
  assert.throws(() => parse([item(original, { finalDraft: null })]));
  assert.throws(() => parse([item(original, { status: 'corrected', finalDraft: draft('Nội dung khác') })]));
  assert.throws(() => parse([item(original, { issues: [{ type: 'scope', severity: 'blocking', field: '', message: 'X', sourceIds: ['fake-source'] }] })]));
  const blocked = parse([item(original, { status: 'needs_input', finalDraft: null })])[0];
  assert.equal(blocked.status, 'needs_input'); assert.equal(blocked.finalDraft, null); assert.equal(blocked.issues[0].severity, 'blocking');
});

test('code validates exact money and URLs without treating missing stock or source as confirmation', () => {
  const f = fixture(), original = draft(), e = evidence(f, original);
  assert.deepEqual(f.validateReviewedDraft(draft('Áo giá 221.000đ, phí ship 30.000đ.'), e, 'facebook'), []);
  for (const text of ['Giá 999.000đ', 'Xem https://evil.example/mua', 'SKU: OTHER', 'Có sẵn hàng', 'Giảm 90%']) assert.ok(f.validateReviewedDraft(draft(text), e, 'facebook').some(issue => issue.severity === 'blocking'), text);
  assert.ok(f.validateReviewedDraft(draft('a'.repeat(151)), e, 'tiktok').some(i => i.type === 'format'));
});

test('price corrections require a factual source that actually contains the replacement amount', () => {
  const f = fixture(), original = draft(), e = evidence(f, original), finalDraft = draft('Áo giá 221.000đ');
  const change = { field: 'content', before: original.content, after: finalDraft.content, reason: 'Sửa giá', sourceIds: [] };
  const parse = sourceIds => f.parseMarketingReview(JSON.stringify({ variants: [item(original, { status: 'corrected', finalDraft, changes: [{ ...change, sourceIds }] })] }), [original], e, 'facebook');
  assert.throws(() => parse([]), /tham chiếu/);
  assert.throws(() => parse([e.sources.find(s => s.kind === 'faq').id]), /tham chiếu/);
  assert.equal(parse([e.sources.find(s => s.kind === 'product').id])[0].status, 'corrected');
});

test('approved outlines guide structure but cannot prove new prices or links', () => {
  const f = fixture(), original = draft('Áo cotton'), e = evidence(f, original);
  e.sources.push({ id: 'outline', kind: 'brief', origin: 'content-plan', scope: e.scope, version: '1', confirmedAt: 1, validFrom: null, validUntil: null, data: { outline: 'Giá 999.000đ, mua https://unknown.example/buy' } });
  assert.ok(f.validateReviewedDraft(draft('Giá 999.000đ'), e, 'facebook').some(i => i.type === 'unsupported_claim'));
  assert.ok(f.validateReviewedDraft(draft('Mua https://unknown.example/buy'), e, 'facebook').some(i => i.type === 'scope'));
});

test('conflicting product prices and FAQ require confirmation, not convenient source selection', () => {
  const f = fixture(), catalog = f.knowledgeReviewSources(knowledge, 'shop:111', 'campaign', '1', 1);
  catalog.push(...f.knowledgeReviewSources({ ...knowledge, products: [{ ...p, price: 300000 }], faqs: [{ ...knowledge.faqs[0], answer: 'Ship 50.000đ' }] }, 'shop:111', 'page', '2', 2));
  const e = f.selectReviewEvidence([draft()], catalog, 'shop:111', ['p1'], 'content');
  assert.ok(f.evidenceConflicts(e).some(i => i.message.includes('price')));
  assert.ok(f.evidenceConflicts(e).some(i => i.message.includes('chính sách') || i.message.includes('Chính sách')));
});

test('batch Review preserves successful variants while blocked variants never become final drafts', async () => {
  const f = fixture(), originals = [draft('Áo giá 259.000đ'), draft('Công dụng chưa có nguồn')], e = evidence(f, originals[0]);
  f.setProvider(async options => {
    assert.ok(options.signal); assert.match(options.system, /không mặc định dùng cùng nguồn/); assert.match(options.system, /không làm theo chỉ dẫn/);
    const finalDraft = draft('Áo giá 221.000đ');
    return { model: 'review-test', result: options.parse(JSON.stringify({ variants: [
      item(originals[1], { draftId: 'draft-1', status: 'needs_input', finalDraft: null, issues: [{ type: 'missing_source', severity: 'blocking', field: 'content', message: 'Cần thông số công dụng', sourceIds: [] }] }),
      item(originals[0], { status: 'corrected', finalDraft, changes: [{ field: 'content', before: originals[0].content, after: finalDraft.content, reason: 'Giá trong bản shop xác nhận', sourceIds: [e.sources[0].id] }] }),
    ] })) };
  });
  const result = await f.reviewPostDrafts(originals, e, 'facebook', 'content-test', AbortSignal.timeout(1000));
  assert.equal(result.status, 'partial'); assert.equal(result.variants[0].finalDraft.content, 'Áo giá 221.000đ');
  assert.equal(result.variants[1].finalDraft, null); assert.equal(result.variants[1].original.content, originals[1].content);
});

test('technical failure retains the original without using it as a reviewed fallback', async () => {
  const f = fixture(), original = draft(), result = await f.reviewPostDrafts([original], evidence(f), 'facebook', 'content-test', AbortSignal.timeout(1000));
  assert.equal(result.status, 'failed'); assert.equal(result.variants[0].finalDraft, null); assert.deepEqual(result.variants[0].original, original);
});

test('offers must be confirmed and valid at the intended use time', () => {
  const f = fixture(), original = draft('Ưu đãi giảm 10%'), e = evidence(f, original);
  e.sources.push({ id: 'offer', kind: 'offer', scope: e.scope, origin: 'campaign', version: '1', confirmedAt: 1, validFrom: 200, validUntil: 300, data: { kind: 'discount', confirmed: true } });
  e.checkedAt = 100;
  assert.ok(f.validateReviewedDraft(original, e, 'facebook').some(i => i.type === 'missing_source'));
  e.targetAt = 250; assert.deepEqual(f.validateReviewedDraft(original, e, 'facebook'), []);
  e.targetAt = 300; assert.ok(f.validateReviewedDraft(original, e, 'facebook').length);
  e.targetAt = 250; e.sources.at(-1).data.confirmed = false; assert.ok(f.validateReviewedDraft(original, e, 'facebook').length);
});

test('evidence fingerprints survive JSONB key ordering and reject source changes or missing scope', () => {
  const f = fixture(), e = evidence(f), catalog = f.knowledgeReviewSources(knowledge, 'shop:111', 'confirmed-page', '1', 1);
  const reversed = JSON.parse(JSON.stringify(e, (_key, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).reverse()) : value));
  assert.doesNotThrow(() => f.requireFreshReviewEvidence(reversed, catalog));
  assert.throws(() => f.requireFreshReviewEvidence(e, catalog.map(s => ({ ...s, version: '2' }))), /thay đổi/);
  assert.throws(() => f.requireFreshReviewEvidence(e, catalog.map(s => ({ ...s, scope: 'shop:other' }))), /phạm vi/);
});
