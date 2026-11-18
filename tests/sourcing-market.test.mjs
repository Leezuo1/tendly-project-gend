import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const db = new PGlite();
const ready = (async () => { for (const file of readdirSync('db/migrations').filter(file => file.endsWith('.sql')).sort()) await db.exec(readFileSync(`db/migrations/${file}`, 'utf8')); })();
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

const cache = new Map();
function load(file) {
  if (file === 'lib/services/messengerPostgres.ts') return { getMessengerPool: () => pool };
  if (cache.has(file)) return cache.get(file).exports;
  const loaded = { exports: {} }; cache.set(file, loaded);
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', compiled)(name => name.startsWith('@/') ? load(`${name.slice(2)}.ts`) : require(name), loaded, loaded.exports);
  return loaded.exports;
}
const NOW = new Date('2026-11-17T05:00:00Z');
const json = value => Response.json(value);

test('lịch dịp bán hàng tính đúng ngày theo giờ Việt Nam và có dịp âm lịch', () => {
  const { upcomingOccasions, resolveOccasions } = load('lib/services/sourcingOccasions.ts');
  const list = upcomingOccasions(NOW, 90);
  assert.deepEqual(list.slice(0, 2).map(item => [item.name, item.date, item.daysLeft]), [['Nhà giáo Việt Nam 20/11', '2026-11-20', 3], ['Black Friday', '2026-11-27', 10]]);
  assert.ok(list.some(item => item.name === 'Tết Nguyên Đán' && item.date === '2027-02-06'));
  assert.ok(list.every((item, i) => i === 0 || list[i - 1].daysLeft <= item.daysLeft));
  // 23:30 ngày 19/11 giờ VN (16:30 UTC) vẫn tính 20/11 là "còn 1 ngày".
  assert.equal(upcomingOccasions(new Date('2026-11-19T16:30:00Z'), 5)[0].daysLeft, 1);
  assert.deepEqual(resolveOccasions(['Giáng sinh', 'Hội chợ riêng'], NOW).map(item => item.date), ['2026-12-24', '']);
});

test('yêu cầu theo dõi thị trường tạo truy vấn Google có lọc thời gian, đối thủ theo link hoặc tên', () => {
  const { sourcingRequest, competitorQuery } = load('lib/services/sourcingApify.ts');
  const { context, actorInput } = sourcingRequest('market', { industry: 'Hoa & quà tặng', product: 'hoa tươi', keywords: ['giá hoa Đà Lạt'],
    competitors: ['https://www.facebook.com/hoa.yeu.thuong/', 'hoatuoi.vn/san-pham', 'Shop Hoa Mai'], occasions: ['Nhà giáo Việt Nam 20/11'], window: 'w1' }, NOW);
  assert.deepEqual(context.competitors, ['facebook.com/hoa.yeu.thuong', 'hoatuoi.vn', 'Shop Hoa Mai']);
  assert.equal(context.occasions[0].date, '2026-11-20');
  assert.deepEqual(actorInput.queries.split('\n'), ['hoa tươi tin tức thị trường', 'xu hướng hoa tươi 2026', 'hoa tươi Nhà giáo Việt Nam 2026', '"hoa yeu thuong"', 'site:hoatuoi.vn', '"Shop Hoa Mai"']);
  assert.equal(actorInput.quickDateRange, 'w1');
  assert.equal(actorInput.maxPagesPerQuery, 1);
  // Không chủ đề thì theo dõi theo ngành của shop.
  assert.equal(sourcingRequest('market', { industry: 'Mỹ phẩm', product: '', keywords: [] }, NOW).context.topic, 'Mỹ phẩm');
  for (const bad of ['', 'x', 'site:abc.com OR 1', 'https://user:pw@evil.com', 'facebook.com/profile.php?id=1'])
    assert.throws(() => competitorQuery(bad), /Đối thủ|Link|Tên/);
  assert.throws(() => sourcingRequest('market', { industry: 'Hoa', competitors: ['a1', 'b2', 'c3', 'd4'] }, NOW), /tối đa 3/);
  assert.throws(() => sourcingRequest('market', { industry: 'Hoa', window: 'y5' }, NOW), /thời gian/);
});

test('lượt market đi qua prepare → run → đọc dataset, migration cho phép kind market', async () => {
  await ready;
  await db.exec('TRUNCATE sourcing_runs,sourcing_start_limits CASCADE');
  process.env.APIFY_API_TOKEN = 'test-token-do-not-expose';
  const { prepareSourcingRequest, runSourcingRequest, sourcingWorkspace } = load('lib/services/sourcingWorkflow.ts');
  const { readSourcingRun } = load('lib/services/sourcingRuns.ts');
  const { defaultSourcingCriteria, parseSourcingCriteria, sourcingItems } = load('lib/services/sourcingCriteria.ts');
  // Tiêu chí lưu từ bản cũ (không có competitors/occasions/window) vẫn đọc được.
  const old = { ...defaultSourcingCriteria('Thời trang') }; delete old.competitors; delete old.occasions; delete old.window;
  assert.deepEqual([parseSourcingCriteria(old).competitors, parseSourcingCriteria(old).window], [[], 'm1']);
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push([String(url), init?.body ? JSON.parse(init.body) : null]);
    if (String(url).includes('/runs?')) return json({ data: { id: 'run123', status: 'RUNNING', defaultDatasetId: 'ds1' } });
    if (String(url).includes('actor-runs/run123')) return json({ data: { id: 'run123', status: 'SUCCEEDED', defaultDatasetId: 'ds1' } });
    if (String(url).includes('datasets/ds1/items')) return json([{ searchQuery: { term: 'hoa tươi tin tức thị trường' }, organicResults: [
      { url: 'https://news.example.vn/gia-hoa?utm_source=x', title: 'Giá hoa tăng mạnh trước 20/11', description: 'Giá hồng Đà Lạt tăng 30%', websiteContent: { text: 'Giá hoa hồng Đà Lạt tăng 30% do mưa.' } },
      { url: 'https://hoatuoi.vn/khuyen-mai', title: 'Hoa Tươi VN giảm 20%', description: 'Khuyến mãi 20/11' },
    ] }]);
    throw new Error(`unexpected ${url}`);
  };
  const id = await prepareSourcingRequest('owner', { ...defaultSourcingCriteria('Hoa & quà tặng'), kind: 'market', product: 'hoa tươi', competitors: ['hoatuoi.vn'], occasions: ['Nhà giáo Việt Nam 20/11'], window: 'm1', resultLimit: 30 });
  const workspace = await sourcingWorkspace('owner');
  const request = workspace.requests.find(item => item.id === id);
  assert.ok(request.plan.queries.includes('site:hoatuoi.vn'));
  const started = await runSourcingRequest('owner', id, request.revision, true);
  assert.equal(started.kind, 'market');
  assert.equal(calls[0][1].quickDateRange, 'm1');
  assert.match(calls[0][0], /apify~google-search-scraper\/runs/);
  const done = await readSourcingRun('owner', started.id);
  assert.equal(done.status, 'succeeded');
  assert.match(calls.at(-1)[0], /limit=6/);
  const items = sourcingItems(done);
  assert.deepEqual(items.map(item => item.url), ['https://news.example.vn/gia-hoa', 'https://hoatuoi.vn/khuyen-mai']);
});

test('báo cáo thị trường chỉ giữ mục có nguồn thật, ngày dịp lấy từ lịch, ý tưởng cần nguồn hoặc dịp', () => {
  const { parseMarketReport, marketCalendar } = load('lib/services/sourcingAnalysis.ts');
  const { resolveOccasions } = load('lib/services/sourcingOccasions.ts');
  const calendar = marketCalendar(resolveOccasions(['Giáng sinh'], NOW), NOW);
  assert.equal(calendar[0].name, 'Giáng sinh');
  assert.ok(calendar.length <= 5 && calendar.some(item => item.name === 'Nhà giáo Việt Nam 20/11'));
  const ids = new Map([['S1', 'k1'], ['S2', 'k2']]);
  const output = JSON.stringify({
    summary: 'Giá hoa đang tăng trước 20/11.',
    news: [{ title: 'Giá hoa tăng', impact: 'risk', detail: 'Hồng Đà Lạt tăng 30%.', action: 'Chốt giá nhập sớm.', sourceIds: ['S1'] },
      { title: 'Tin bịa', impact: 'opportunity', detail: 'Không có nguồn', action: '', sourceIds: ['S9'] }],
    occasions: [{ name: 'nhà giáo việt nam 20/11', angle: 'Combo hoa + thiệp tri ân', sourceIds: [] }, { name: 'Ngày tự đặt', angle: 'x', sourceIds: ['S1'] }],
    competitors: [{ name: 'Hoa Tươi VN', activity: 'Giảm 20% dịp 20/11', takeaway: 'Đừng đua giá, nhấn mạnh giao nhanh', sourceIds: ['S2'] }],
    trends: [{ text: 'Khách chuộng bó nhỏ', sourceIds: ['S1', 'S2'] }, { text: 'không nguồn', sourceIds: [] }],
    keywords: ['#hoa 20/11', 'hoa tặng thầy cô', 'hoa tặng thầy cô'],
    contentIdeas: [
      { title: 'Bó hoa tri ân dưới 300k', format: 'video', angle: 'Giá hoa tăng nhưng shop giữ giá', hook: 'Giá hoa tăng 30%?', audience: 'Phụ huynh', keywords: ['hoa 20/11'], occasion: 'Nhà giáo Việt Nam 20/11', sourceIds: ['S1'] },
      { title: 'Ý tưởng theo lịch', format: 'infographic', angle: 'Mẹo chọn hoa', hook: '', audience: '', keywords: [], occasion: 'Nhà giáo Việt Nam 20/11', sourceIds: [] },
      { title: 'Ý tưởng bịa', format: 'reel', angle: 'Không căn cứ', hook: '', audience: '', keywords: [], occasion: 'Tết Âm 2099', sourceIds: [] },
    ],
    caveats: ['Kết quả Google không đại diện toàn thị trường.'],
  });
  const result = parseMarketReport(output, ids, { topics: ['hoa tươi'], competitors: ['hoatuoi.vn'], calendar }, NOW);
  const { market } = result;
  assert.deepEqual(market.news.map(news => [news.title, news.impact, news.sources]), [['Giá hoa tăng', 'risk', ['k1']]]);
  assert.deepEqual(market.occasions.map(item => [item.name, item.date, item.daysLeft]), [['Nhà giáo Việt Nam 20/11', '2026-11-20', 3]]);
  assert.equal(market.competitors.length, 1);
  assert.equal(market.trends.length, 1);
  assert.deepEqual(market.keywords, ['hoa 20/11', 'hoa tặng thầy cô']);
  assert.deepEqual(market.contentIdeas.map(idea => [idea.title, idea.format, idea.occasion]), [['Bó hoa tri ân dưới 300k', 'video', 'Nhà giáo Việt Nam 20/11'], ['Ý tưởng theo lịch', 'infographic', 'Nhà giáo Việt Nam 20/11']]);
  assert.equal(result.relevantCount, 2);
  assert.throws(() => parseMarketReport(JSON.stringify({ summary: '' }), ids, { topics: [], competitors: [], calendar }, NOW), /tóm tắt/);
});

test('brief Marketing dựng từ báo cáo trên server: ý tưởng nội dung có lịch theo dịp, sản phẩm hot có insight khách', () => {
  const { briefFromAnalysis, parseSourcingIdeaRef } = load('lib/services/sourcingBrief.ts');
  const market = { topics: ['hoa'], competitorsTracked: [], trends: [], keywords: [],
    news: [{ title: 'Giá hoa tăng', impact: 'risk', detail: 'd', action: 'Chốt giá nhập sớm', sources: ['k1'] }],
    occasions: [{ name: 'Nhà giáo Việt Nam 20/11', date: '2026-11-20', daysLeft: 3, angle: 'Combo hoa + thiệp', sources: [] }],
    competitors: [], contentIdeas: [{ title: 'Bó hoa tri ân', format: 'video', angle: 'Giữ giá dù hoa tăng', hook: 'Giá hoa tăng 30%?', audience: 'Phụ huynh', keywords: ['hoa 20/11'], occasion: 'Nhà giáo Việt Nam 20/11', sources: ['k1'] }] };
  const brief = briefFromAnalysis({ summary: '', relevantCount: 1, findings: [], productIdeas: [], caveats: [], model: 'm', createdAt: 0, market }, { section: 'content', index: 0 }, key => `https://src/${key}`, NOW.getTime());
  assert.equal(brief.name, 'Video ngắn (Reels/TikTok): Bó hoa tri ân');
  assert.equal(brief.goal, 'conversion');
  assert.equal(brief.audience, 'Phụ huynh');
  assert.equal(brief.endsAt, '2026-11-20T16:59:00.000Z');
  // Nguồn khảo sát (có thể là trang đối thủ) không được vào ô link mà AI chèn vào bài đăng.
  assert.equal(brief.link, undefined);
  assert.match(brief.notes, /Nguồn khảo sát \(chỉ để tham khảo, không đưa link vào bài\): https:\/\/src\/k1/);
  assert.match(brief.notes, /Từ khóa nên dùng: hoa 20\/11/);
  assert.match(brief.notes, /Giá hoa tăng: Chốt giá nhập sớm/);
  assert.equal(brief.itemKey, 'idea:content:0');
  assert.throws(() => briefFromAnalysis({ productIdeas: [], market }, { section: 'content', index: 3 }, () => ''), /không còn/);
  const product = briefFromAnalysis({ summary: '', relevantCount: 1, findings: [], caveats: [], model: 'm', createdAt: 0,
    productIdeas: [{ name: 'Áo polo cotton lạnh', reason: 'Nhiều bình luận hỏi size', sources: ['k2'] }],
    report: { audience: [{ text: 'Nam văn phòng', sources: ['k2'] }], drivers: [{ text: 'Mát', sources: ['k2'] }], hesitations: [{ text: 'Sợ xù lông', sources: ['k2'] }], hooks: [], formats: [{ text: 'Thử đồ trước gương', sources: ['k2'] }], keywords: [], hashtags: ['#polo'] } },
  { section: 'product', index: 0 }, () => '');
  assert.deepEqual([product.name, product.audience, product.benefits, product.barriers, product.format], ['Ý tưởng: Áo polo cotton lạnh', 'Nam văn phòng', 'Mát', 'Sợ xù lông', 'Video ngắn (Reels/TikTok)']);
  for (const bad of [null, { section: 'x', index: 0 }, { section: 'content', index: -1 }, { section: 'content', index: 1.5 }]) assert.throws(() => parseSourcingIdeaRef(bad), /Đề xuất/);
});

test('tổng quan đơn hàng & khách hàng gộp đơn chat và livestream, tính KPI theo kỳ', async () => {
  await ready;
  const { readCrmOverview } = load('lib/services/crmOverview.ts');
  const page = 'page-crm', day = 86_400_000, now = NOW.getTime();
  await query(`INSERT INTO messenger_customers(id,page_id,psid,created_at,display_name) VALUES
    ('c1',$1,'p1',$2,'Lan'),('c2',$1,'p2',$3,'Minh'),('c3',$1,'p3',$4,'Hà'),('cx','other','p1',$2,'Khác page')`, [page, now - 60 * day, now - 5 * day, now - 2 * day]);
  await query(`INSERT INTO messenger_conversations(id,customer_id,page_id,created_at,last_message_at) VALUES
    ('v1','c1',$1,$2,$3),('v2','c2',$1,$2,$4),('v3','c3',$1,$2,$5)`, [page, now - 60 * day, now - 1 * day, now - 3 * day, now - 2 * day]);
  await query(`INSERT INTO messenger_orders(id,page_id,psid,items_json,total,status,is_mock,created_at,updated_at) VALUES
    ('DH1',$1,'p1','[{"name":"Áo thun","qty":2}]',400000,'confirmed',false,$2,$2),
    ('DH2',$1,'p1','[{"name":"Quần jeans","qty":1}]',500000,'confirmed',false,$3,$3),
    ('DH3',$1,'p2','[{"name":"Áo thun","qty":1}]',200000,'draft',false,$4,$4),
    ('DH4',$1,'p2','[{"name":"Váy","qty":1}]',300000,'confirmed',true,$5,$5),
    ('DHX','other','p1','[{"name":"Khác","qty":1}]',999000,'confirmed',false,$4,$4)`, [page, now - 40 * day, now - 2 * day, now - 1 * day, now - 45 * day]);
  await query(`INSERT INTO live_sessions(id,page_id,platform,title,status,knowledge_json,started_at) VALUES('L1',$1,'demo','Live tối thứ 6','ended','{}',$2)`, [page, now - 3 * day]);
  await query(`INSERT INTO live_orders(id,session_id,customer_id,customer_name,items_json,status,created_at,updated_at) VALUES
    ('LO1','L1','fb9','Tú','[{"sku":"A1","name":"Áo thun","color":"Trắng","size":"M","qty":3,"price":150000}]','confirmed',$1,$1)`, [now - 3 * day]);

  const view = await readCrmOverview(page, 30, pool, now);
  assert.equal(view.range, 30);
  assert.deepEqual(view.orders.kpi, { total: 3, confirmed: 2, pending: 1, cancelled: 0, revenue: 950000, previousRevenue: 700000, previousTotal: 2, avgOrder: 475000, mock: 0 });
  assert.deepEqual(view.orders.bySource, { messenger: 2, livestream: 1 });
  assert.deepEqual(view.orders.topProducts[0], { name: 'Áo thun', qty: 3, orders: 1 });
  assert.equal(view.orders.daily.length, 30);
  assert.equal(view.orders.daily.reduce((sum, day) => sum + day.revenue, 0), 950000);
  assert.deepEqual(view.orders.list.map(order => order.id), ['DH3', 'DH2', 'LO1', 'DH1', 'DH4']);
  assert.equal(view.orders.list.find(order => order.id === 'LO1').items[0].variant, 'Trắng / M');
  const lan = view.customers.list.find(customer => customer.name === 'Lan');
  assert.deepEqual([lan.segment, lan.orders, lan.spent], ['repeat', 2, 900000]);
  assert.deepEqual(view.customers.list.find(customer => customer.name === 'Minh').segment, 'buyer');
  assert.deepEqual(view.customers.list.find(customer => customer.name === 'Hà').segment, 'lead');
  assert.deepEqual(view.customers.list.find(customer => customer.name === 'Tú').channel, 'livestream');
  assert.ok(!view.customers.list.some(customer => customer.name === 'Khác page'));
  assert.deepEqual(view.customers.kpi, { total: 4, active: 4, newInRange: 3, buyers: 2, repeat: 1, conversion: 50 });
  // Kỳ không hợp lệ quay về 30 ngày.
  assert.equal((await readCrmOverview(page, 365, pool, now)).range, 30);
});
