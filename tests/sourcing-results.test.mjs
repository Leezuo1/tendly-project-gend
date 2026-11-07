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

test('supplier report: one card per real result, phones must be on that page, landscape points need sources', () => {
  const { parseSupplierReport } = load('lib/services/sourcingAnalysis.ts', { '@/lib/services/messengerPostgres': {}, '@/lib/services/gemini': {}, '@/lib/services/sourcingRuns': {}, '@/lib/services/sourcingCriteria': {} });
  const ids = new Map([['S1', 'k1'], ['S2', 'k2']]);
  const pages = new Map([['k1', 'Xưởng may Tân Bình. Hotline: 0901.234.567'], ['k2', 'Top 10 nguồn hàng']]);
  const card = { sourceId: 'S1', name: 'Xưởng may A', tier: 'factory', matchScore: 8, moq: 'Từ 50 chiếc', price: '', strengths: 'Áo polo', address: 'Tân Bình',
    phones: ['+84 901 234 567', '0999 888 777'], greenFlags: ['Có địa chỉ xưởng'], redFlags: ['Không công khai giá'], questions: ['Giá theo mốc 50 - 100 cái?'] };
  const output = { summary: 'Có 1 xưởng phù hợp', filterNote: 'Loại 1 bài Top 10',
    tierMix: [{ text: 'Nghiêng về xưởng', sourceIds: ['S1'] }, { text: 'Bịa', sourceIds: ['S9'] }], regions: [{ text: 'TP.HCM', sourceIds: ['S1'] }],
    suppliers: [card, { ...card, name: 'Trùng trang' }, { ...card, sourceId: 'S9', name: 'Không có thật' }, { ...card, sourceId: 'S2', name: 'Kho B', tier: 'xưởng', matchScore: 15 }],
    message: 'Chào anh/chị, shop cần nhập áo polo…', caveats: ['Kết quả Google chưa xác minh'] };
  const result = parseSupplierReport(JSON.stringify(output), ids, pages, 1).suppliers;
  assert.deepEqual(result.suppliers.map(item => item.name), ['Xưởng may A', 'Kho B']);
  assert.deepEqual(result.suppliers[0].phones, ['+84 901 234 567'], 'invented phone dropped; +84 matches 0 on the page');
  assert.equal(result.suppliers[0].tier, 'factory');
  assert.deepEqual([result.suppliers[1].tier, result.suppliers[1].matchScore, result.suppliers[1].phones], ['unknown', null, []]);
  assert.deepEqual(result.tierMix, [{ text: 'Nghiêng về xưởng', sources: ['k1'] }]);
  assert.deepEqual([result.collected, result.pagesRead], [2, 1]);
  assert.throws(() => parseSupplierReport(JSON.stringify({ ...output, summary: '' }), ids, pages, 1));
});

test('TikTok report keeps only sourced points; buying intent needs comments; hashtags must exist in the data', () => {
  const { parseTikTokReport } = load('lib/services/sourcingAnalysis.ts', { '@/lib/services/messengerPostgres': {}, '@/lib/services/gemini': {}, '@/lib/services/sourcingRuns': {}, '@/lib/services/sourcingCriteria': {} });
  const ids = new Map([['S1', 'k1'], ['S2', 'k2']]);
  const empty = { whyNow: [], specs: [], audience: [], price: [], drivers: [], hesitations: [], hooks: [], formats: [], keywords: [] };
  const output = { ...empty, summary: 'Áo dài trẻ em được hỏi giá nhiều', trendStatus: 'peaking', trendReason: 'Nhiều video mới', trendSourceIds: ['S1'],
    buyingIntentScore: 8, buyingIntentReason: 'Nhiều bình luận hỏi giá', buyingIntentSourceIds: ['S2'],
    specs: [{ text: 'Áo dài gấm đỏ', sourceIds: ['S1', 'S9'] }, { text: 'Bịa', sourceIds: ['S9'] }],
    drivers: [{ text: '"Mặc lên xinh"', sourceIds: ['S2'] }],
    hashtags: ['#aodaitreem', 'tettrend', '#khongcotrongdulieu', '#có cách'],
    sources: [{ id: 'S1', summary: 'Video thử áo dài' }, { id: 'S2', summary: 'Bình luận hỏi giá' }, { id: 'S9', summary: 'Không tồn tại' }], caveats: ['Tương tác không phải doanh số'] };
  const corpus = 'Áo dài cho bé #AoDaiTreEm #tettrend\ngiá bao nhiêu';
  const result = parseTikTokReport(JSON.stringify(output), ids, corpus, 12);
  assert.deepEqual(result.report.specs, [{ text: 'Áo dài gấm đỏ', sources: ['k1'] }]);
  assert.deepEqual(result.report.trend, { status: 'peaking', reason: 'Nhiều video mới', sources: ['k1'] });
  assert.equal(result.report.buyingIntent.score, 8);
  assert.deepEqual(result.report.hashtags, ['#aodaitreem', '#tettrend']);
  assert.deepEqual(result.report.sourceNotes, { k1: 'Video thử áo dài', k2: 'Bình luận hỏi giá' });
  assert.equal(result.relevantCount, 2);
  assert.equal(result.report.commentCount, 12);

  const noComments = parseTikTokReport(JSON.stringify(output), ids, corpus, 0);
  assert.equal(noComments.report.buyingIntent.score, null, 'no comments collected: no buying intent score');
  const unsourced = parseTikTokReport(JSON.stringify({ ...output, trendSourceIds: ['S9'], buyingIntentSourceIds: [], trendStatus: 'viral' }), ids, corpus, 12);
  assert.equal(unsourced.report.trend.status, 'unclear');
  assert.equal(unsourced.report.buyingIntent.score, null);
  assert.throws(() => parseTikTokReport(JSON.stringify({ ...output, summary: '' }), ids, corpus, 12));
});
