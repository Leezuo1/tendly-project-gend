import { businessSecurity } from './business-security-fixture.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { after, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const db = new PGlite();
const ready = (async () => {
  for (const file of ['001-messenger.sql', '002-messenger-outbound.sql', '003-messenger-profiles.sql', '004-conversation-memory.sql', '005-conversation-view.sql',
    '011-messenger-ai.sql', '015-marketing-workspace.sql', '016-customer-care.sql', '008-facebook-comments.sql', '009-livestream.sql', '010-live-waiting.sql',
    '011-live-cockpit.sql', '017-customer-care-sources.sql', '023-messenger-orders.sql', '024-shop-catalog.sql', '025-conversation-staff-labels.sql',
    '026-conversation-handoff.sql', '027-shop-product-images.sql', '028-zalo-outbox.sql']) await db.exec(readFileSync(`db/migrations/${file}`, 'utf8'));
})();
const query = async (sql, values) => {
  const result = await db.query(sql, values);
  return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
};
const pool = { query, connect: async () => ({ query, release() {} }) };
after(async () => { await ready; await db.close(); });

function load() {
  const cache = new Map();
  const get = (file) => {
    if (file.replaceAll('\\', '/').endsWith('lib/services/appSecurity.ts')) return businessSecurity;
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', compiled)(
      (name) => name.startsWith('@/') ? get(name.slice(2) + '.ts') : require(name), loaded, loaded.exports);
    return loaded.exports;
  };
  return get;
}
const get = load();
const { parseZaloIngest, saveZaloMessages, readZaloInboxPageId, InvalidZaloPayload } = get('lib/services/zaloMessages.ts');
const { pollZaloOutbox, queueZaloText, waitZaloResult, ZaloSendError } = get('lib/services/zaloOutbox.ts');
const msg = (extra = {}) => ({ threadId: '1001', isSelf: false, msgId: '9001', ts: '1700000000000', text: 'Shop còn áo không?', attachments: [], ...extra });

test('parser puts Zalo in its own page namespace, keeps direction and takes the customer profile only from customer messages', () => {
  const parsed = parseZaloIngest({ ownId: '555', messages: [
    msg({ profile: { name: ' Lan ', avatar: 'https://zalo.example/a.jpg' } }),
    msg({ msgId: '9002', isSelf: true, text: 'Còn nhé', profile: { name: 'Tên shop' } }),
    msg({ msgId: '9003', text: '', attachments: [{ type: 'image', url: 'https://zalo.example/p.jpg' }, { type: 'file', url: 'http://insecure' }, { type: 'BAD!' }] }),
  ] });
  assert.equal(parsed.pageId, 'zalo:555');
  assert.deepEqual(parsed.messages.map(m => [m.pageId, m.psid, m.direction, m.timestamp]), [
    ['zalo:555', '1001', 'in', 1700000000000], ['zalo:555', '1001', 'out', 1700000000000], ['zalo:555', '1001', 'in', 1700000000000]]);
  assert.deepEqual([...parsed.profiles], [['1001', { name: 'Lan', avatarUrl: 'https://zalo.example/a.jpg' }]]);
  assert.deepEqual(parsed.messages[2].attachments, [{ type: 'image', url: 'https://zalo.example/p.jpg' }, { type: 'file' }]);
});

test('parser rejects malformed batches', () => {
  const bad = [null, { ownId: 'x', messages: [msg()] }, { ownId: '555', messages: [] }, { ownId: '555', messages: Array(101).fill(msg()) },
    { ownId: '555', messages: [msg({ threadId: 'abc' })] }, { ownId: '555', messages: [msg({ threadId: '555' })] },
    { ownId: '555', messages: [msg({ msgId: 'a b' })] }, { ownId: '555', messages: [msg({ ts: 'soon' })] },
    { ownId: '555', messages: [msg({ isSelf: 'no' })] }];
  for (const input of bad) assert.throws(() => parseZaloIngest(input), InvalidZaloPayload);
});

test('saving is idempotent, stores the customer name, and the Zalo inbox is separate from Messenger', async () => {
  await ready;
  await db.exec('TRUNCATE messenger_messages, messenger_conversations, messenger_customers CASCADE');
  const batch = () => parseZaloIngest({ ownId: '555', messages: [msg({ profile: { name: 'Lan', avatar: 'https://zalo.example/a.jpg' } }), msg({ msgId: '9002', isSelf: true, ts: '1700000001000', text: 'Còn nhé' })] });
  assert.equal(await readZaloInboxPageId(pool), null);
  assert.deepEqual(await saveZaloMessages(batch(), pool), { inserted: 2, duplicates: 0 });
  assert.deepEqual(await saveZaloMessages(batch(), pool), { inserted: 0, duplicates: 2 });
  assert.equal(await readZaloInboxPageId(pool), 'zalo:555');
  // Một tin Messenger cùng psid/mid không đụng tin Zalo.
  const { savePostgresMessages } = get('lib/services/messengerPostgres.ts');
  await savePostgresMessages([{ pageId: '111', psid: '1001', messageId: '9001', direction: 'in', timestamp: 5, text: 'fb', attachments: [] }], pool);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM messenger_messages')).rows[0].n, 3);

  const { readMessengerInbox } = get('lib/services/messengerInboxDb.ts');
  const zalo = await readMessengerInbox('zalo:555', 100, pool), fb = await readMessengerInbox('111', 100, pool);
  assert.equal(zalo.conversations.length, 1); assert.equal(fb.conversations.length, 1);
  const thread = zalo.conversations[0];
  assert.equal(thread.customer.name, 'Lan'); assert.equal(thread.customer.avatarUrl, 'https://zalo.example/a.jpg');
  assert.deepEqual(thread.messages.map(m => [m.direction, m.text]), [['in', 'Shop còn áo không?'], ['out', 'Còn nhé']]);

  const { mergeMessengerThread } = get('lib/services/messengerView.ts');
  const view = mergeMessengerThread(thread);
  assert.equal(view.channel, 'zalo'); assert.equal(view.profile.channel, 'Zalo'); assert.equal(view.isUnreplied, false);
  assert.equal(mergeMessengerThread(fb.conversations[0]).channel, 'facebook');
});

const ID1 = '11111111-1111-4111-8111-111111111111', ID2 = '22222222-2222-4222-8222-222222222222';
const reject = (promise, status) => assert.rejects(promise, e => e instanceof ZaloSendError && e.status === status);
async function seedThread() {
  await ready;
  await db.exec('TRUNCATE messenger_messages, messenger_conversations, messenger_customers, zalo_outbox, zalo_worker CASCADE');
  await saveZaloMessages(parseZaloIngest({ ownId: '555', messages: [msg()] }), pool);
}

test('queue refuses when no live worker, unknown thread, bad input; then queues, claims in order and reports results', async () => {
  await seedThread();
  const now = Date.now();
  await reject(queueZaloText({ psid: '1001', text: 'hi', requestId: ID1 }, pool, now), 503); // chưa có worker
  assert.deepEqual(await pollZaloOutbox('555', [], pool, now), []);
  await reject(queueZaloText({ psid: '1001', text: 'hi', requestId: ID1 }, pool, now + 20_000), 503); // worker im quá 15 giây
  await reject(queueZaloText({ psid: '9999', text: 'hi', requestId: ID1 }, pool, now), 404);
  await reject(queueZaloText({ psid: '1001', text: '   ', requestId: ID1 }, pool, now), 400);
  await reject(queueZaloText({ psid: '1001', text: 'x'.repeat(2001), requestId: ID1 }, pool, now), 400);
  await reject(queueZaloText({ psid: '1001', text: 'hi', requestId: 'not-a-uuid' }, pool, now), 400);

  assert.equal(await queueZaloText({ psid: '1001', text: 'Chào bạn', requestId: ID1 }, pool, now), ID1);
  assert.equal(await queueZaloText({ psid: '1001', text: 'Chào bạn', requestId: ID1 }, pool, now), ID1); // gửi lại cùng mã: không tạo tin thứ hai
  await reject(queueZaloText({ psid: '1001', text: 'Tin khác', requestId: ID1 }, pool, now), 409);
  await queueZaloText({ psid: '1001', text: 'Tin hai', requestId: ID2 }, pool, now + 1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM zalo_outbox')).rows[0].n, 2);

  const jobs = await pollZaloOutbox('555', [], pool, now + 2);
  assert.deepEqual(jobs.map(j => [j.id, j.psid, j.text]), [[ID1, '1001', 'Chào bạn'], [ID2, '1001', 'Tin hai']]);
  assert.deepEqual(await pollZaloOutbox('555', [], pool, now + 3), [], 'đã nhận thì không giao lại');
  assert.deepEqual(await pollZaloOutbox('777', [{ id: ID1, ok: true }], pool, now + 4), [], 'worker của tài khoản khác không báo được kết quả');
  assert.equal((await db.query('SELECT status FROM zalo_outbox WHERE id=$1', [ID1])).rows[0].status, 'sending');
  await pollZaloOutbox('555', [{ id: ID1, ok: true }, { id: ID2, ok: false, error: 'Zalo từ chối' }], pool, now + 5);
  assert.deepEqual((await waitZaloResult(ID1, pool, 0)).status, 'sent');
  assert.deepEqual(await waitZaloResult(ID2, pool, 0), { status: 'failed', error: 'Zalo từ chối' });
});

test('stale queue rows fail instead of being sent late; a crashed worker does not auto-resend', async () => {
  await seedThread();
  const now = Date.now();
  await pollZaloOutbox('555', [], pool, now);
  await queueZaloText({ psid: '1001', text: 'Tin cũ', requestId: ID1 }, pool, now);
  // Worker bật lại sau 2 phút: tin chờ quá 60 giây bị đánh hỏng, không gửi muộn.
  assert.deepEqual(await pollZaloOutbox('555', [], pool, now + 120_000), []);
  assert.equal((await waitZaloResult(ID1, pool, 0)).status, 'failed');
  await queueZaloText({ psid: '1001', text: 'Tin đang gửi', requestId: ID2 }, pool, now + 121_000);
  assert.equal((await pollZaloOutbox('555', [], pool, now + 121_500)).length, 1);
  assert.deepEqual(await pollZaloOutbox('555', [], pool, now + 121_500 + 130_000), []);
  assert.match((await waitZaloResult(ID2, pool, 0)).error, /kiểm tra Zalo/);
  assert.equal((await waitZaloResult(ID2, pool, 5, async () => {})).status, 'failed');
});
