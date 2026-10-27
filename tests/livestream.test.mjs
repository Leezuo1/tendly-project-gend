import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { after, afterEach, beforeEach, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const db = new PGlite();
const ready = (async () => {
  for (const file of readdirSync('db/migrations').filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(`db/migrations/${file}`, 'utf8'));
  }
})();
const query = async (sql, args) => {
  const result = await db.query(sql, args);
  return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
};
const pool = { query, connect: async () => ({ query, release() {} }) };
after(async () => { await ready; await db.close(); });

function loader() {
  const cache = new Map();
  const load = (file) => {
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', compiled)((name) =>
      (name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name)), loaded, loaded.exports);
    return loaded.exports;
  };
  return load;
}

const originalFetch = globalThis.fetch;
const env = Object.fromEntries(['PAGE_ID', 'PAGE_ACCESS_TOKEN', 'META_GRAPH_VERSION', 'DATABASE_URL', 'DASHBOARD_KEY', 'NODE_ENV',
  'GEMINI_API_KEY', 'GEMINI_MODEL'].map((k) => [k, process.env[k]]));
beforeEach(async () => {
  await ready;
  await db.exec('TRUNCATE live_sessions, facebook_comments, facebook_comment_settings CASCADE');
  delete process.env.GEMINI_API_KEY;
  Object.assign(process.env, { PAGE_ID: '111', PAGE_ACCESS_TOKEN: 'page-token', META_GRAPH_VERSION: 'v26.0', DATABASE_URL: 'postgresql://test-only' });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});

const product = (sku, name, qty, extra = {}) => ({
  id: `p-${sku}`, sku, name, material: 'Cotton', category: 'Áo', colors: ['Trắng', 'Đen', 'Xanh navy'], sizes: ['S', 'M', 'L', 'XL'],
  qty, price: 259000, ...extra,
});
const knowledge = {
  shop: { name: 'Tendly', email: '', phone: '' }, productSource: { name: 'Catalog', connected: true, lastSyncedAt: 1 },
  products: [
    product('AT-01', 'Áo thun basic cotton Tendly', 10),
    product('DV-12', 'Đầm voan hoa nhí', 2, { category: 'Đầm', colors: ['Vàng', 'Hồng'], sizes: ['S', 'M', 'L'], price: 459000 }),
    product('SM-03', 'Sơ mi lụa công sở', 8, { category: 'Áo', price: 329000 }),
  ],
  faqs: [{ id: 'f1', question: 'Phí ship bao nhiêu?', answer: 'Shop ship toàn quốc 30k, đơn từ 500k freeship.', tag: 'Giao hàng', keywords: ['ship'], active: true }],
  emailTriggers: [],
};
const START = Date.UTC(2026, 9, 27, 12);

/** Phiên Facebook (nguồn là bài đăng 111_500), mẫu đang lên sóng AT-01. */
async function liveSession(load, now = START) {
  const engine = load('lib/services/live/engine.ts');
  const session = await engine.createSession('111', { platform: 'facebook', sourceKind: 'post', sourceId: '111_500', sourcePostId: '111_500',
    title: 'Live thử' }, knowledge, pool, now);
  await engine.setOnAir('111', session.id, 'AT-01', pool);
  return { engine, session };
}

const NAMES = ['Ngọc Anh', 'Thu Hà', 'Minh Thư', 'Lan Phương', 'Bảo Ngân', 'Khánh Linh', 'Hoài An', 'Thảo Vy', 'Gia Hân', 'Mỹ Duyên',
  'Quỳnh Như', 'Phương Uyên', 'Hải Yến', 'Diệu Linh', 'Tú Anh', 'Kim Chi', 'Thanh Trúc', 'Ánh Dương', 'Hồng Nhung', 'Bích Ngọc',
  'Yến Nhi', 'Cẩm Tú', 'Thu Trang', 'Bảo Anh', 'Như Ý'];
/**
 * Bình luận live mẫu (mẫu đang lên sóng AT-01): 8 câu hỏi giá trùng ý, chốt đơn, 1 khách chốt 2 món,
 * 4 người chốt DV-12 (chỉ còn 2), xin xem mẫu, phàn nàn, đổi trả, ship/COD, tư vấn size, spam.
 */
const SCRIPT = [
  [0, 'giá bn shop'], [1, 'xin giá'], [2, 'ib giá'], [3, 'giá sao ạ'], [4, 'giá bn'], [5, 'xin giá ạ'], [6, 'giá bao nhiêu shop'], [7, 'ib giá shop'],
  [8, '1'], [9, 'chốt M trắng'], [10, 'L đen'], [11, 'x2 Trắng'],
  [12, 'chốt DV-12 S Vàng'], [13, 'chốt DV-12 M Hồng'], [14, 'chốt DV-12 L Vàng'], [15, 'chốt DV-12 S Hồng'],
  [16, 'cho xem mẫu DV-12'], [17, 'lên mẫu SM-03 đi shop'], [18, 'xem SM-03 với'], [19, 'ib giá SM-03'],
  [20, 'đơn hôm trước giao chậm quá, hàng bị lỗi đường may'], [21, 'đổi size được không shop'],
  [22, 'ship hn bao lâu shop'], [23, 'có COD không'], [24, '45kg mặc size gì vậy shop'], [9, 'lấy thêm 1 cái Xanh navy size XL'],
  [0, 'đẹp quá 😍'],
];
/** Dạng Graph API trả về cho /{post}/comments, mới nhất trước. */
const graphComments = (base = START) => SCRIPT.map(([author, text], i) => ({
  id: `500_${i + 1}`, message: text, created_time: new Date(base + i * 2000).toISOString(), from: { id: String(900 + author), name: NAMES[author] },
})).reverse();
/** Meta giả lập: đọc bình luận của bài 111_500, cho nhắn riêng mọi bình luận và xác nhận đã gửi. */
function fakeMeta(base = START) {
  const sent = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/111_500/comments')) return Response.json({ data: graphComments(base) });
    if (u.includes('can_reply_privately')) return Response.json({ can_reply_privately: true });
    if (u.endsWith('/111/messages')) {
      const target = JSON.parse(init.body).recipient.comment_id;
      sent.push(target);
      return Response.json({ message_id: `m-${target}`, recipient_id: '7001' });
    }
    throw new Error(`unexpected ${u}`);
  };
  return sent;
}

test('classifier: Vietnamese with/without accents, abbreviations, and short comments bound to the on-air product', () => {
  const { classifyLiveComment } = loader()('lib/services/live/classify.ts');
  const [at, dv] = knowledge.products;
  const c = (text, onAir = at) => classifyLiveComment(text, knowledge.products, onAir, 'Tendly');
  assert.deepEqual(c('1'), { intent: 'order', sku: 'AT-01', color: null, size: null, qty: 1 });
  assert.deepEqual(c('chốt M trắng'), { intent: 'order', sku: 'AT-01', color: 'Trắng', size: 'M', qty: 1 });
  assert.deepEqual(c('lay 2 cai dam vang DV12 size S'), { intent: 'order', sku: 'DV-12', color: 'Vàng', size: 'S', qty: 2 });
  assert.equal(c('giá bn shop').intent, 'price');
  assert.equal(c('ib giá DV-12').sku, 'DV-12');
  assert.equal(c('45kg mặc size gì').intent, 'size_advice');
  assert.equal(c('cao 1m6 nặng 50kg lấy size nào').intent, 'size_advice');
  assert.equal(c('còn size L không').intent, 'stock');
  assert.equal(c('cho xem mẫu đầm voan hoa nhí').sku, 'DV-12');
  assert.equal(c('có COD không').intent, 'shipping');
  assert.equal(c('đổi size được không shop').intent, 'return');
  assert.equal(c('hàng bị lỗi, lừa đảo').intent, 'complaint');
  // Chữ dễ nhầm khi bỏ dấu không được tính là chốt đơn
  assert.equal(c('đắt quá').intent, 'other');
  assert.equal(c('mùa này mặc đẹp').intent, 'other');
  assert.equal(c('đẹp quá 😍').intent, 'other');
  assert.equal(c('cho em hỏi chất vải gì', null).intent, 'question');
  assert.equal(c('1', null).sku, null);
  // "hong" vừa là viết tắt của "không" vừa là màu "Hồng": màu vẫn nhận đúng, không bị hiểu thành câu hỏi
  assert.deepEqual(c('M hồng', dv), { intent: 'order', sku: 'DV-12', color: 'Hồng', size: 'M', qty: 1 });
  assert.deepEqual(c('Hồng', dv), { intent: 'order', sku: 'DV-12', color: 'Hồng', size: null, qty: 1 });
  assert.equal(c('còn hông shop').intent, 'stock');
  void dv;
});

test('live session: grouping, merged orders, stock guard and the on-air queue', async () => {
  const load = loader();
  const { engine, session } = await liveSession(load);
  fakeMeta();
  const NOW = START + 120_000;
  const snap = await engine.syncSession('111', session.id, pool, NOW);
  const again = await engine.syncSession('111', session.id, pool, NOW);
  assert.equal(again.stats.comments, snap.stats.comments, 'sync lại không nhân đôi bình luận');
  assert.equal(snap.stats.comments, SCRIPT.length);

  // 8 câu hỏi giá mẫu đang lên sóng gom vào đúng 1 nhóm
  const price = snap.groups.find((g) => g.key === 'price:AT-01');
  assert.equal(price.count, 8);
  assert.match(price.replyText, /\{gia\}/);

  // Khách chốt 2 món khác nhau → 1 đơn 2 dòng
  const merged = snap.orders.find((o) => o.customerName === NAMES[9]);
  assert.equal(merged.items.length, 2);
  assert.equal(merged.commentCount, 2);

  // DV-12 chỉ còn 2: không bán lố, 2 người chốt sau vào nhóm "hết hàng"
  const dv = snap.stock.find((x) => x.sku === 'DV-12');
  assert.equal(dv.held, 2);
  assert.equal(dv.remaining, 0);
  assert.equal(dv.level, 'out');
  assert.equal(snap.groups.find((g) => g.key === 'order_out:DV-12').count, 2);
  const dvItems = snap.orders.flatMap((o) => o.items).filter((i) => i.sku === 'DV-12');
  assert.equal(dvItems.filter((i) => i.stockOk).reduce((sum, i) => sum + i.qty, 0), 2);

  // Phàn nàn / đổi trả cần shop tự xử lý; câu hỏi ship dùng FAQ của shop
  assert.equal(snap.groups.find((g) => g.intent === 'complaint').needsHuman, true);
  assert.match(snap.groups.find((g) => g.intent === 'shipping').replyText, /30k/);

  // Hàng chờ lên sóng: SM-03 (còn hàng) trước, DV-12 (hết) sau, không chứa mẫu đang lên sóng
  assert.deepEqual(snap.queue.map((q) => q.sku), ['SM-03', 'DV-12']);
  assert.match(snap.queue[1].recommendation, /Hết hàng/);
  assert.equal(snap.stats.aiCalls, 0, 'không có GEMINI_API_KEY thì không gọi AI');
});

test('repeating the same order does not double the quantity or message the customer twice', async () => {
  const load = loader();
  const { engine, session } = await liveSession(load);
  const say = (id, text, at) => engine.ingestComments('111', session.id,
    [{ commentId: id, authorId: 'u1', authorName: 'Lan', text, createdAt: START + at }], pool, START + at);
  await say('c1', 'chốt M trắng', 1000);
  await say('c2', 'chốt M trắng', 2000);
  await say('c3', 'x3 M trắng', 3000);
  const snap = await engine.buildSnapshot('111', session.id, pool, START + 4000);
  assert.equal(snap.orders.length, 1);
  assert.deepEqual(snap.orders[0].items.map((i) => [i.color, i.size, i.qty]), [['Trắng', 'M', 3]]);
  assert.equal(snap.recent.filter((c) => c.replyStatus === 'review').length, 1);
});

test('approving a group sends one private reply per comment, in batches, and moves orders to awaiting info', async () => {
  const load = loader();
  const { engine, session } = await liveSession(load);
  const reply = load('lib/services/live/reply.ts');
  const sentTo = fakeMeta();
  const comments = Array.from({ length: 20 }, (_, i) => ({ commentId: `q${i}`, authorId: `u${i}`, authorName: `Khách ${i}`,
    text: i % 2 ? 'giá bn' : 'xin giá', createdAt: START + i }));
  await engine.ingestComments('111', session.id, comments, pool, START + 100);
  await engine.ingestComments('111', session.id, [{ commentId: 'o1', authorId: 'buyer', authorName: 'Hà', text: 'chốt L đen', createdAt: START + 200 }], pool, START + 300);
  let snap = await engine.buildSnapshot('111', session.id, pool);
  const group = snap.groups.find((g) => g.key === 'price:AT-01');
  assert.equal(group.count, 20);

  await assert.rejects(reply.approveGroup('111', session.id, group.key, group.replyText, group.revision + 5, pool, START + 10_000), /vừa thay đổi/);
  const first = await reply.approveGroup('111', session.id, group.key, group.replyText, group.revision, pool, START + 10_000);
  assert.equal(first.sent, 15);
  assert.equal(first.remaining, 5);
  const second = await reply.approveGroup('111', session.id, group.key, group.replyText, first.revision, pool, START + 10_000);
  assert.equal(second.sent, 5);
  assert.equal(second.remaining, 0);
  const third = await reply.approveGroup('111', session.id, group.key, group.replyText, second.revision, pool, START + 10_000);
  assert.equal(third.sent, 0, 'không gửi lại bình luận đã gửi');
  const sentText = (await query(`SELECT reply_text FROM live_comments WHERE session_id=$1 AND comment_id='q3'`, [session.id])).rows[0].reply_text;
  assert.match(sentText, /Khách 3/);
  assert.match(sentText, /259\.000đ/);
  assert.doesNotMatch(sentText, /\{/);

  snap = await engine.buildSnapshot('111', session.id, pool);
  const order = snap.groups.find((g) => g.key === 'order:AT-01');
  await reply.approveGroup('111', session.id, order.key, order.replyText, order.revision, pool, START + 10_000);
  snap = await engine.buildSnapshot('111', session.id, pool);
  assert.equal(snap.orders[0].status, 'awaiting_info');
  assert.equal(snap.groups.find((g) => g.key === 'price:AT-01').status, 'sent');
  assert.equal(snap.stats.sentReplies, 21);
  assert.equal(new Set(sentTo).size, sentTo.length, 'mỗi bình luận chỉ nhắn riêng 1 lần');

  // Shop sửa câu trả lời → revision tăng, lần sau phải dùng revision mới
  await engine.ingestComments('111', session.id, [{ commentId: 'q99', authorId: 'u99', authorName: 'Mới', text: 'giá sao', createdAt: START + 500 }], pool);
  const edited = await reply.approveGroup('111', session.id, group.key, 'Dạ {ten_khach}, giá {gia} ạ', second.revision, pool, START + 10_000);
  assert.equal(edited.revision, second.revision + 1);
  assert.equal(edited.sent, 1);
});

test('Facebook source: reads comments from Graph, checks can_reply_privately, never resends ambiguous replies', async () => {
  const load = loader();
  const engine = load('lib/services/live/engine.ts');
  const reply = load('lib/services/live/reply.ts');
  const session = await engine.createSession('111', { platform: 'facebook', sourceKind: 'post', sourceId: '111_500', sourcePostId: '111_500',
    title: 'FB' }, knowledge, pool, START);
  await engine.setOnAir('111', session.id, 'AT-01', pool);
  const calls = [];
  const now = Date.now();
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    calls.push({ u, method: init.method ?? 'GET', auth: init.headers?.Authorization, body: init.body });
    if (u.includes('/111_500/comments')) {
      return Response.json({ data: [
        { id: '500_1', message: 'giá bn shop', created_time: new Date(now - 3000).toISOString(), from: { id: '901', name: 'An' } },
        { id: '500_2', message: 'xin giá', created_time: new Date(now - 2000).toISOString(), from: { id: '902', name: 'Bình' } },
        { id: '500_3', message: 'ib giá', created_time: new Date(now - 1000).toISOString() },
      ] });
    }
    if (u.includes('/500_2?')) return Response.json({ can_reply_privately: false });
    if (u.includes('can_reply_privately')) return Response.json({ can_reply_privately: true });
    if (u.endsWith('/111/messages')) {
      const target = JSON.parse(init.body).recipient.comment_id;
      if (target === '500_3') throw new Error('network dropped');
      return Response.json({ message_id: `m-${target}`, recipient_id: '7001' });
    }
    throw new Error(`unexpected ${u}`);
  };
  const snap = await engine.syncSession('111', session.id, pool, now);
  assert.equal(snap.stats.comments, 3);
  assert.ok(calls.every((c) => c.auth === 'Bearer page-token' && !c.u.includes('page-token')));
  const listUrl = calls.find((c) => c.u.includes('/comments')).u;
  assert.match(listUrl, /filter=stream/);
  assert.doesNotMatch(listUrl, /live_filter/, 'bài đăng không gửi live_filter');
  assert.equal(snap.recent.find((c) => c.commentId === '500_3').authorId, 'c:500_3');

  const group = snap.groups.find((g) => g.key === 'price:AT-01');
  const result = await reply.approveGroup('111', session.id, group.key, group.replyText, group.revision, pool, START + 10_000);
  assert.deepEqual({ sent: result.sent, notAllowed: result.notAllowed, unknown: result.unknown }, { sent: 1, notAllowed: 1, unknown: 1 });
  const sends = () => calls.filter((c) => c.method === 'POST').length;
  const before = sends();
  await reply.approveGroup('111', session.id, group.key, group.replyText, result.revision, pool, START + 10_000);
  assert.equal(sends(), before, 'bình luận "unknown"/"not_allowed" không bị gửi lại');
  const saved = await query(`SELECT direction, text FROM messenger_messages WHERE message_id='m-500_1'`);
  assert.equal(saved.rows[0].direction, 'out');
});

test('AI is used sparingly: one batched call for unclear questions, one reply per advice group, counted per session', async () => {
  const load = loader();
  const { engine, session } = await liveSession(load);
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MODEL = 'test-model';
  const prompts = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    const user = JSON.parse(body.contents[0].parts[0].text);
    prompts.push(user);
    const text = user.comments && user.catalog
      ? JSON.stringify({ items: user.comments.map((c) => ({ id: c.id, intent: c.text.includes('vải') ? 'question' : 'shipping', sku: 'AT-01' })) })
      : JSON.stringify({ message: 'Dạ {ten_khach} cao 1m6 nặng 50kg mặc size M vừa đẹp ạ' });
    return Response.json({ candidates: [{ content: { parts: [{ text }] } }] });
  };
  const unclear = Array.from({ length: 25 }, (_, i) => ({ commentId: `x${i}`, authorId: `a${i}`, authorName: `K${i}`,
    text: i === 0 ? 'chất vải có nóng không shop' : `shop ơi gửi qua bưu điện được không ${i}`, createdAt: START + i }));
  await engine.ingestComments('111', session.id, [...unclear,
    { commentId: 'adv', authorId: 'z', authorName: 'Z', text: '45kg mặc size gì', createdAt: START + 99 }], pool, START + 100);
  const calls = await engine.enrichWithAi('111', session.id, pool);
  assert.equal(calls, 2);
  assert.equal(prompts[0].comments.length, 20, 'tối đa 20 bình luận mỗi lần gọi');
  const snap = await engine.buildSnapshot('111', session.id, pool);
  assert.equal(snap.stats.aiCalls, 2);
  const advice = snap.groups.find((g) => g.key === 'size_advice:AT-01');
  assert.equal(advice.replySource, 'ai');
  assert.ok(snap.groups.find((g) => g.key === 'shipping:-').count >= 19);
  assert.equal(snap.recent.filter((c) => c.intent === 'order').length, 0, 'AI không tự tạo đơn');
});

test('ending a session builds the summary and restocking advice; later syncs do nothing', async () => {
  const load = loader();
  const { engine, session } = await liveSession(load);
  fakeMeta();
  await engine.syncSession('111', session.id, pool, START + 120_000);
  const ended = await engine.endSession('111', session.id, pool, START + 210_000);
  assert.equal(ended.session.status, 'ended');
  const s = ended.summary;
  assert.equal(s.totalComments, SCRIPT.length);
  assert.ok(s.orders >= 5);
  assert.equal(s.adviceSource, 'rule');
  assert.equal(s.advice.find((a) => a.sku === 'DV-12').action, 'restock');
  assert.ok(s.topOrdered.length >= 1);
  assert.ok(s.timeline.length >= 1);
  globalThis.fetch = async (url) => { throw new Error(`phiên đã kết thúc không được gọi Meta: ${url}`); };
  const after = await engine.syncSession('111', session.id, pool, START + 999_000);
  assert.equal(after.stats.comments, s.totalComments);
  const insights = await engine.readInsights('111', pool);
  assert.equal(insights.sessions.length, 1);
  assert.equal(insights.monthly[0].month, '2026-10');
  assert.equal(insights.monthly[0].orders, s.orders);
});

test('Fanpage comment flow skips only an actual live video, not an ordinary post used as a Live source', async () => {
  const load = loader();
  const engine = load('lib/services/live/engine.ts');
  const fc = load('lib/services/facebookComments.ts');
  await engine.createSession('111', { platform: 'facebook', sourceKind: 'live_video', sourceId: '500', sourcePostId: '111_500', title: 'FB' },
    knowledge, pool, Date.now());
  await fc.saveCommentSettings('111', true, knowledge, pool);
  await fc.saveFacebookComments([{ pageId: '111', commentId: '500_9', postId: '111_500', authorId: '222', authorName: 'K',
    text: 'giá bn', createdAt: Date.now(), eventAt: Date.now(), removed: false }], pool);
  globalThis.fetch = async (url) => { throw new Error(`không được gọi mạng: ${url}`); };
  await fc.processPendingComments('111', pool);
  const row = (await query(`SELECT status, reason FROM facebook_comments WHERE comment_id='500_9'`)).rows[0];
  assert.equal(row.status, 'ignored');
  assert.match(row.reason, /Livestream/);
});

test('live APIs require the dashboard key and validate input before touching data', async () => {
  const load = loader();
  const sessions = load('app/api/live/sessions/route.ts');
  const post = (body, headers = {}) => sessions.POST(new Request('http://localhost/api/live/sessions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }));
  process.env.DASHBOARD_KEY = 'bi-mat';
  assert.equal((await post({ platform: 'facebook', sourceKind: 'auto', knowledge })).status, 401);
  assert.equal((await post({ platform: 'tiktok', knowledge }, { Authorization: 'Bearer bi-mat' })).status, 400);
  assert.equal((await post({ platform: 'demo', knowledge }, { Authorization: 'Bearer bi-mat' })).status, 400, 'đã bỏ Live demo');
  assert.equal((await post({ platform: 'facebook', sourceKind: 'post', sourceId: '999_1', knowledge }, { Authorization: 'Bearer bi-mat' })).status, 400);
  const approve = load('app/api/live/sessions/[id]/groups/[key]/approve/route.ts');
  const res = await approve.POST(new Request('http://localhost/x', { method: 'POST', headers: { Authorization: 'Bearer bi-mat' },
    body: JSON.stringify({ text: 'x', revision: 1 }) }), { params: Promise.resolve({ id: 'not-a-uuid', key: 'price:AT-01' }) });
  assert.equal(res.status, 400);
});

test('a single unclear question waits for a batch (5 questions or 20 seconds) before calling AI', async () => {
  const load = loader();
  const { engine, session } = await liveSession(load);
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MODEL = 'test-model';
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    const user = JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items: user.comments.map((c) => ({ id: c.id, intent: 'question', sku: '' })) }) }] } }] });
  };
  const T = Date.now();
  await engine.ingestComments('111', session.id, [{ commentId: 'q1', authorId: 'a', authorName: 'A', text: 'shop ơi mở cửa mấy giờ', createdAt: T }], pool, T);
  assert.equal(await engine.enrichWithAi('111', session.id, pool, AbortSignal.timeout(5000), T + 1000), 0);
  assert.equal(calls, 0);
  // Sau 20 giây: 1 lần phân loại lô câu hỏi, rồi 1 lần soạn câu trả lời chung cho nhóm vừa phân loại xong
  assert.equal(await engine.enrichWithAi('111', session.id, pool, AbortSignal.timeout(5000), T + 21_000), 2);
  assert.equal(calls, 2);
  assert.equal(await engine.enrichWithAi('111', session.id, pool, AbortSignal.timeout(5000), T + 60_000), 0, 'không gọi lại');
});

test('Facebook auto mode binds the Page live video as soon as the seller goes live, polling Graph at most every 10s', async () => {
  const load = loader();
  const engine = load('lib/services/live/engine.ts');
  const T = Date.now();
  const session = await engine.createSession('111', { platform: 'facebook', sourceKind: null, sourceId: null, sourcePostId: null,
    title: 'FB auto', waitForLive: true }, knowledge, pool, T);
  let isLive = false;
  const calls = [];
  globalThis.fetch = async (url) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('/111/live_videos')) {
      assert.match(decodeURIComponent(u), /broadcast_status=\["LIVE"\]/);
      return Response.json({ data: isLive ? [{ id: '777', status: 'LIVE', creation_time: new Date(T + 5000).toISOString(), video: { id: '888' } }] : [] });
    }
    if (u.includes('/777/comments')) {
      assert.match(u, /live_filter=no_filter/);
      return Response.json({ data: [{ id: '888_1', message: 'chốt AT01 M trắng', created_time: new Date(T + 20_000).toISOString(), from: { id: '901', name: 'An' } }] });
    }
    throw new Error(`unexpected ${u}`);
  };
  let snap = await engine.syncSession('111', session.id, pool, T + 1000);
  assert.equal(snap.session.waiting, true);
  await engine.syncSession('111', session.id, pool, T + 4000);
  assert.equal(calls.filter((u) => u.includes('live_videos')).length, 1, 'không dò lại trong vòng 10 giây');

  isLive = true;
  snap = await engine.syncSession('111', session.id, pool, T + 12_000);
  assert.equal(snap.session.waiting, false);
  assert.equal(snap.session.sourceId, '777');
  assert.equal(snap.session.sourceKind, 'live_video');
  assert.equal(snap.stats.comments, 1);
  assert.equal(snap.orders[0].items[0].sku, 'AT-01');
  const row = (await query('SELECT source_post_id FROM live_sessions WHERE id=$1', [session.id])).rows[0];
  assert.equal(row.source_post_id, '111_888', 'luồng bình luận Fanpage bỏ qua bình luận của video live này');
});
