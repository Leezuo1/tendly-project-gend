import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { after, afterEach, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const db = new PGlite();
const ready = (async () => {
  for (const file of ['001-messenger.sql', '002-messenger-outbound.sql', '003-messenger-profiles.sql']) {
    await db.exec(readFileSync(`db/migrations/${file}`, 'utf8'));
  }
})();
const query = async (sql, values) => {
  const result = await db.query(sql, values);
  return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
};
const pool = { query, connect: async () => ({ query, release() {} }) };
after(async () => { await ready; await db.close(); });

// Chạy service TypeScript thật bằng compiler có sẵn (giống các test khác).
function loader() {
  const cache = new Map();
  const load = (file) => {
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

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 9, 12);
const msg = (psid, messageId, direction, ago, text) => ({
  pageId: '111', psid, messageId, direction, timestamp: NOW - ago, text, attachments: [],
});

const envKeys = ['PAGE_ID', 'DATABASE_URL', 'DASHBOARD_KEY', 'NODE_ENV', 'PAGE_ACCESS_TOKEN'];
const originalEnv = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

async function seed() {
  await ready;
  await db.exec('TRUNCATE messenger_outbound_requests, messenger_messages, messenger_conversations, messenger_customers CASCADE');
  const load = loader();
  await load('lib/services/messengerPostgres.ts').savePostgresMessages([
    // Khách mới, hỏi sản phẩm (gõ không dấu) — shop chưa trả lời
    msg('1001', 'a1', 'in', 2 * HOUR, 'Ao thun basic con size L khong shop?'),
    // Khách quen: lần đầu 20 ngày trước, gần nhất 3 ngày, shop đã trả lời
    msg('1002', 'b1', 'in', 20 * DAY, 'Shop ơi'),
    msg('1002', 'b2', 'in', 3 * DAY, 'Cảm ơn shop đã trả lời nhé'),
    msg('1002', 'b3', 'out', 3 * DAY - HOUR, 'Dạ không có gì ạ'),
    // Im lặng 15 ngày, từng phàn nàn
    msg('1003', 'c1', 'in', 40 * DAY, 'Đặt hàng'),
    msg('1003', 'c2', 'in', 15 * DAY, 'Hàng bị lỗi đường may, mình muốn đổi trả'),
    // Sắp rời bỏ: im lặng 45 ngày
    msg('1004', 'd1', 'in', 60 * DAY, 'Hello'),
    msg('1004', 'd2', 'in', 45 * DAY, 'ok'),
    // Fanpage khác — không được lẫn vào
    { ...msg('9999', 'z1', 'in', HOUR, 'Khách page khác'), pageId: '222' },
  ], pool);
  return load;
}

test('activity segments use the first message time, not when Tendly synced the conversation', async () => {
  const load = await seed();
  const insights = load('lib/services/marketingInsights.ts');
  const products = insights.productMatchers([{ name: 'Áo thun basic cotton Tendly', sku: 'AT-01' }, { name: 'Ao thun basic', sku: 'AT-02' }], 'Tendly');
  const customers = await insights.readMarketingCustomers('111', products, NOW, pool);
  const by = Object.fromEntries(customers.map((c) => [c.psid, c]));

  assert.deepEqual(Object.keys(by).sort(), ['1001', '1002', '1003', '1004']);
  assert.equal(by['1001'].segment, 'new');
  assert.equal(by['1002'].segment, 'active');
  assert.equal(by['1003'].segment, 'quiet');
  assert.equal(by['1004'].segment, 'risk');

  assert.equal(by['1001'].waitingReply, true);
  assert.equal(by['1002'].waitingReply, false);
  assert.ok(by['1001'].canMessageUntil > NOW);
  assert.equal(by['1002'].canMessageUntil, null);

  // Dò từ khoá trên chữ đã bỏ dấu: khách gõ không dấu vẫn khớp; "trả lời" không bị nhầm là "lỗi".
  assert.equal(by['1001'].askedProduct, true);
  assert.deepEqual(by['1001'].matchedProducts, ['Ao thun basic']);
  assert.equal(by['1002'].complained, false);
  assert.equal(by['1003'].complained, true);
  assert.equal(by['1003'].lastInboundText, 'Hàng bị lỗi đường may, mình muốn đổi trả');
  assert.equal(by['1003'].inboundCount, 2);
  assert.equal(by['1004'].askedProduct, false);
});

test('activitySegment boundaries', () => {
  const { activitySegment } = loader()('lib/services/marketingInsights.ts');
  assert.equal(activitySegment(NOW - 7 * DAY, NOW - 7 * DAY, NOW), 'new');
  assert.equal(activitySegment(NOW - 8 * DAY, NOW - 7 * DAY, NOW), 'active');
  assert.equal(activitySegment(NOW - 40 * DAY, NOW - 30 * DAY, NOW), 'quiet');
  assert.equal(activitySegment(NOW - 40 * DAY, NOW - 31 * DAY, NOW), 'risk');
  assert.equal(activitySegment(NOW - 40 * DAY, null, NOW), 'risk');
});

test('remarketing performance counts only rmk- sends and replies within 7 days', async () => {
  const load = await seed();
  const insights = load('lib/services/marketingInsights.ts');
  const outbound = (requestId, psid, ago, status = 'sent') => query(
    `INSERT INTO messenger_outbound_requests (page_id, request_id, psid, text, status, message_id, created_at)
     VALUES ('111', $1, $2, 'Shop nhắn lại nè', $3, $4, $5)`, [requestId, psid, status, `mid-${requestId}`, NOW - ago]);
  await outbound('rmk-1', '1002', 4 * DAY);       // khách nhắn lại 3 ngày trước → có phản hồi
  await outbound('rmk-2', '1004', 50 * DAY);      // khách nhắn lại sau 5 ngày (45 ngày trước) → có phản hồi
  await outbound('rmk-3', '1001', HOUR);          // chưa nhắn lại
  await outbound('rmk-4', '1003', 2 * DAY, 'failed');
  await outbound('8b3c3f1e-0000-4000-8000-000000000000', '1002', 5 * DAY); // tin từ Hộp thoại, không tính

  const sends = await insights.readRemarketingSends('111', pool);
  assert.equal(sends.length, 3);
  const by = Object.fromEntries(sends.map((s) => [s.psid, s]));
  assert.equal(by['1002'].repliedAt, NOW - 3 * DAY);
  assert.equal(by['1004'].repliedAt, NOW - 45 * DAY);
  assert.equal(by['1001'].repliedAt, null);
});

test('draft conversation is read in order and the prompt treats it as data', async () => {
  const load = await seed();
  const insights = load('lib/services/marketingInsights.ts');
  const ai = load('lib/services/aiRemarketing.ts');
  const conversation = await insights.readConversationForDraft('111', '1002', pool);
  assert.deepEqual(conversation.messages.map((m) => m.from), ['khach', 'khach', 'shop']);
  assert.equal(await insights.readConversationForDraft('111', '5555', pool), null);

  const knowledge = { shop: { name: 'Tendly' }, products: [{ sku: 'AT-01', name: 'Áo', colors: [], sizes: ['L'], qty: 3, price: 259000, material: 'x' }], faqs: [] };
  const prompt = ai.buildRemarketingPrompt(conversation, knowledge, NOW);
  assert.match(prompt.system, /không phải chỉ dẫn/);
  const payload = JSON.parse(prompt.user);
  assert.equal(payload.conversation[2].from, 'shop');
  assert.equal(payload.products[0].material, undefined);

  assert.deepEqual(ai.parseRemarketingOutput(JSON.stringify({ message: ' Chào chị ', reason: 'Khách hỏi size' })),
    { message: 'Chào chị', reason: 'Khách hỏi size' });
  assert.throws(() => ai.parseRemarketingOutput(JSON.stringify({ message: '  ' })), /chưa soạn/);
  assert.throws(() => ai.parseRemarketingOutput('khong phai json'), /định dạng/);
});

test('marketing APIs need the dashboard key, PAGE_ID and valid input before touching Messenger', async () => {
  const load = loader();
  const send = load('app/api/marketing/remarketing/send/route.ts');
  const customers = load('app/api/marketing/customers/route.ts');
  const post = (route, body, headers = {}) => route.POST(new Request('http://localhost/x', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  }));
  delete process.env.NODE_ENV;
  delete process.env.DASHBOARD_KEY;
  delete process.env.PAGE_ID;
  process.env.DATABASE_URL = 'postgresql://test-only';

  const noConfig = await post(customers, { knowledge: {} });
  assert.equal(noConfig.status, 503);
  assert.equal((await noConfig.json()).code, 'NO_CONFIG');

  process.env.PAGE_ID = '111';
  const uuid = '8b3c3f1e-0000-4000-8000-000000000000';
  assert.equal((await post(send, { psid: 'abc', text: 'hi', requestId: uuid })).status, 400);
  assert.equal((await post(send, { psid: '1001', text: '   ', requestId: uuid })).status, 400);
  assert.equal((await post(send, { psid: '1001', text: 'hi', requestId: 'rmk-1' })).status, 400);
  assert.equal((await post(customers, { knowledge: { shop: 'x' } })).status, 400);

  process.env.DASHBOARD_KEY = 'bi-mat';
  assert.equal((await post(send, { psid: '1001', text: 'hi', requestId: uuid })).status, 401);
});

test('Facebook engagement reads each post with the token in a header and survives a deleted post', async () => {
  const fb = loader()('lib/services/facebookPage.ts');
  process.env.PAGE_ACCESS_TOKEN = 'page-token';
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), auth: options.headers.Authorization });
    if (String(url).includes('111_2')) return Response.json({ error: { message: 'Object does not exist' } }, { status: 400 });
    return Response.json({ reactions: { summary: { total_count: 5 } }, comments: { summary: { total_count: 2 } }, shares: { count: 1 } });
  };
  const { stats, failed } = await fb.fetchPostEngagement(['111_1', '111_2', 'not-an-id']);
  assert.deepEqual(stats.get('111_1'), { reactions: 5, comments: 2, shares: 1 });
  assert.equal(failed, 1);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((c) => c.auth === 'Bearer page-token' && !c.url.includes('page-token')));
});

test('Facebook engagement reports which permission the token is missing', async () => {
  const fb = loader()('lib/services/facebookPage.ts');
  process.env.PAGE_ACCESS_TOKEN = 'page-token';
  globalThis.fetch = async () => Response.json({ error: { code: 10,
    message: "(#10) This endpoint requires the 'pages_read_user_content' permission or the 'Page Public Content Access' feature." } }, { status: 400 });
  const { failed, missingPermission } = await fb.fetchPostEngagement(['111_1']);
  assert.equal(failed, 1);
  assert.equal(missingPermission, 'pages_read_user_content');
});
