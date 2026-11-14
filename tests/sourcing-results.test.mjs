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
new Function('require', 'module', 'exports', source)(name => name === '@/lib/services/sourcingSearch' ? { SourcingInputError: Error, hotScore: (post) => post.metrics.views ?? 0 } : require(name), loaded, loaded.exports);
const { decodeEscapes, sourcingItems, compareSourcingItem, defaultSourcingCriteria, matchesTerms, keywordTerms, catalogKeywords } = loaded.exports;

test('default keywords come from the shop catalog: most common product categories, never an industry label', () => {
  const rows = (...names) => names.map((category, i) => ({ id: `p${i}`, category }));
  assert.deepEqual(catalogKeywords(rows('Áo thun', 'Áo khoác', 'Áo thun', 'Váy & Đầm', 'Phụ kiện', 'Áo thun', 'Áo khoác')), ['Áo thun', 'Áo khoác', 'Váy & Đầm']);
  assert.deepEqual(catalogKeywords(rows('Thời trang & phụ kiện', 'Áo thun'), ['Thời trang & phụ kiện']), ['Áo thun'], 'imported products carry the industry as category');
  assert.deepEqual(catalogKeywords(rows('', ' ', 'A', '*Quần* <jeans>')), ['Quần jeans'], 'unsafe characters are stripped, too-short names dropped');
  assert.deepEqual(catalogKeywords([]), []);
  const sample = { id: 's1', category: 'Áo thun', name: 'Áo mẫu' };
  const samples = new Map([['s1', JSON.stringify(sample)]]);
  assert.deepEqual(catalogKeywords([sample], [], samples), [], 'untouched seed sample is ignored (seed is fashion for every industry)');
  assert.deepEqual(catalogKeywords([{ ...sample, name: 'Áo của shop' }], [], samples), ['Áo thun'], 'an edited sample counts');
});

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

test('TikTok queries: keywords are never glued to the industry seed; only the chosen product anchors them', () => {
  const { scopedTiktokQueries } = load('lib/services/sourcingSearch.ts', { '@/lib/data/workspace': { industries: [] } });
  const fashion = 'Thời trang & phụ kiện';
  assert.deepEqual(scopedTiktokQueries(fashion, ['chất liệu thoáng mát']), ['chất liệu thoáng mát']);
  assert.deepEqual(scopedTiktokQueries('Mỹ phẩm & làm đẹp', ['áo polo nam']), ['áo polo nam']);
  assert.deepEqual(scopedTiktokQueries(fashion, ['chất liệu thoáng mát'], 'áo thun'), ['áo thun chất liệu thoáng mát']);
  assert.deepEqual(scopedTiktokQueries(fashion, ['áo polo cotton'], 'Áo polo'), ['áo polo cotton']);
  assert.deepEqual(scopedTiktokQueries(fashion, ['phối đồ công sở']), ['phối đồ công sở']);
  assert.deepEqual(scopedTiktokQueries(fashion, []), ['thời trang hot trend', 'review quần áo đáng mua', 'phụ kiện thời trang hot']);
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
  const intent = { hits: 3, sources: ['k2'] };
  const result = parseTikTokReport(JSON.stringify(output), ids, corpus, 12, intent);
  assert.deepEqual(result.report.specs, [{ text: 'Áo dài gấm đỏ', sources: ['k1'] }]);
  assert.deepEqual(result.report.trend, { status: 'peaking', reason: 'Nhiều video mới', sources: ['k1'] });
  assert.deepEqual([result.report.buyingIntent.score, result.report.buyingIntent.sources], [3, ['k2']], '3 of 12 comments ask to buy: counted by code, not by the model');
  assert.match(result.report.buyingIntent.reason, /3\/12/);
  assert.deepEqual(result.report.hashtags, ['#aodaitreem', '#tettrend']);
  assert.deepEqual(result.report.sourceNotes, { k1: 'Video thử áo dài', k2: 'Bình luận hỏi giá' });
  assert.equal(result.relevantCount, 2);
  assert.equal(result.report.commentCount, 12);

  const noComments = parseTikTokReport(JSON.stringify(output), ids, corpus, 0, { hits: 0, sources: [] });
  assert.equal(noComments.report.buyingIntent.score, null, 'no comments collected: no buying intent score');
  const unsourced = parseTikTokReport(JSON.stringify({ ...output, trendSourceIds: ['S9'], trendStatus: 'viral' }), ids, corpus, 12, { hits: 0, sources: [] });
  assert.equal(unsourced.report.trend.status, 'unclear');
  assert.equal(unsourced.report.buyingIntent.score, 0);
  assert.throws(() => parseTikTokReport(JSON.stringify({ ...output, summary: '' }), ids, corpus, 12, intent));
});

test('TikTok items: posts matching the search keywords come first, then by hot score; filler words do not match', () => {
  const p = (id, text, views) => ({ source: 'tiktok', externalId: id, url: `https://www.tiktok.com/@a/video/${id}`, text, collectedAt: '2026-11-07T04:36:48.000Z', metrics: { views, likes: 0, comments: 0, shares: 0 } });
  const ranked = (keywords, posts) => sourcingItems({ ...run(posts), context: { keywords } }).map(item => item.title);
  assert.deepEqual(ranked(['áo thun cotton'], [p('1', 'THÉP TẤM, TOLE', 900000), p('2', 'Áo thun tăm đẹp', 10), p('3', '#xuhuong #aothun', 50)]),
    ['#xuhuong #aothun', 'Áo thun tăm đẹp', 'THÉP TẤM, TOLE'], 'hashtag-only #aothun matches "áo thun"; off-topic viral post ranks last; ties by hot score');
  assert.deepEqual(ranked(['thời trang hot trend', 'review đồ đáng mua'], [p('1', '#hottrend #review đáng mua', 500), p('2', 'Phối đồ thời trang công sở', 5)]),
    ['Phối đồ thời trang công sở', '#hottrend #review đáng mua'], 'filler-only hashtags are not a match');
  assert.deepEqual(ranked([], [p('1', 'a', 1), p('2', 'b', 9)]), ['b', 'a'], 'no keywords: pure hot order');
  assert.equal(matchesTerms('Bao thùng carton giá rẻ', keywordTerms(['áo thun'])), false, 'no match across word boundaries ("aothun" inside "baothung")');
  assert.equal(matchesTerms('Áo thun nam', keywordTerms(['áo thun'])), true);
});

test('TikTok keeps Vietnamese videos (and VN hashtag-only ones), drops foreign-language or foreign-origin videos', () => {
  const search = load('lib/services/sourcingSearch.ts', { '@/lib/data/workspace': { industries: [] } });
  const { normalizeTikTok, isVietnamese } = load('lib/services/sourcingApify.ts', { '@/lib/services/sourcingSearch': search });
  const now = new Date('2026-11-14T00:00:00Z');
  const raw = (id, extra) => ({ id, text: `video ${id}`, webVideoUrl: `https://www.tiktok.com/@a/video/${id}`, createTimeISO: '2026-11-13T00:00:00Z', playCount: 100, ...extra });
  const items = [raw('1', { textLanguage: 'vi', locationCreated: 'VN' }), raw('2', { textLanguage: 'un', locationCreated: 'VN' }), raw('3', { textLanguage: 'es', locationCreated: 'BO' }),
    raw('4', { textLanguage: 'vi', locationCreated: 'KZ' }), raw('5', { textLanguage: 'en', locationCreated: 'VN' }), raw('6', { textLanguage: 'un', locationCreated: 'ID' }), raw('7', {})];
  assert.ok(isVietnamese({ textLanguage: 'vi', locationCreated: 'US' }), 'Vietnamese caption stays wherever it was posted');
  const result = normalizeTikTok(items, { from: '2026-11-07T00:00:00Z', to: now.toISOString() }, now);
  assert.deepEqual(result.posts.map(p => p.externalId).sort(), ['1', '2', '4', '7']);
  assert.equal(result.excludedByLanguageCount, 3);
});

test('hot products need sources from at least two different authors', () => {
  const { parseTikTokReport } = load('lib/services/sourcingAnalysis.ts', { '@/lib/services/messengerPostgres': {}, '@/lib/services/gemini': {}, '@/lib/services/sourcingRuns': {}, '@/lib/services/sourcingCriteria': {} });
  const ids = new Map([['S1', 'k1'], ['S2', 'k2'], ['S3', 'k3']]);
  const authors = new Map([['k1', 'a'], ['k2', 'a'], ['k3', 'b']]);
  const empty = { whyNow: [], specs: [], audience: [], price: [], drivers: [], hesitations: [], hooks: [], formats: [], keywords: [], hashtags: [], sources: [], caveats: [] };
  const products = [{ name: 'Cùng một kênh', reason: 'x', sourceIds: ['S1', 'S2'] }, { name: 'Một bài', reason: 'x', sourceIds: ['S1'] },
    { name: 'Áo polo lạnh', reason: 'Nhiều view', sourceIds: ['S1', 'S3'] }, { name: 'Bịa', reason: 'x', sourceIds: ['S8', 'S9'] }];
  const output = { ...empty, summary: 's', products, trendStatus: 'early', trendReason: '', trendSourceIds: [] };
  const result = parseTikTokReport(JSON.stringify(output), ids, '', 0, { hits: 0, sources: [] }, authors);
  assert.deepEqual(result.productIdeas.map(p => p.name), ['Áo polo lạnh', 'Cùng một kênh', 'Một bài'], 'fake sources dropped; more distinct authors first, ties keep model order');
  assert.equal(result.relevantCount, 3);
  const unknown = parseTikTokReport(JSON.stringify(output), ids, '', 0, { hits: 0, sources: [] });
  assert.deepEqual(unknown.productIdeas.map(p => p.name), ['Cùng một kênh', 'Áo polo lạnh', 'Một bài'], 'unknown authors count as distinct');
});

test('buying intent counts comments that ask price, link, size or how to buy', () => {
  const { buyingIntentCount } = load('lib/services/sourcingAnalysis.ts', { '@/lib/services/messengerPostgres': {}, '@/lib/services/gemini': {}, '@/lib/services/sourcingRuns': {}, '@/lib/services/sourcingCriteria': {} });
  const c = text => ({ text, likes: null });
  const items = [{ key: 'a', comments: [c('Áo này giá bao nhiêu vậy shop'), c('xinh quá'), c('cho mình xin link'), c('Ib size M nhé')] }, { key: 'b', comments: [c('đẹp, quá đẹp')] }, { key: 'c' }];
  assert.deepEqual(buyingIntentCount(items), { hits: 3, sources: ['a'] });
  assert.equal(buyingIntentCount([{ key: 'x', comments: [c('Tiktok trend'), c('mình thích bộ này'), c('cả gia đình mình thích'), c('tham gia minigame'), c('bn ơi xinh quá')] }]).hits, 0, 'common words are not buying signals');
  assert.equal(buyingIntentCount([{ key: 'x', comments: [c('gia bao nhieu vay shop'), c('gia bn a')] }]).hits, 2, 'unaccented typing still counts');
  assert.equal(buyingIntentCount([{ key: 'x', comments: [c('giá bao nhiêu'.normalize('NFD'))] }]).hits, 1, 'decomposed Vietnamese still counts');
});
