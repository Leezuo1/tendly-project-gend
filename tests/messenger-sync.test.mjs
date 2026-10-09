import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { after, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const db = new PGlite();
const ready = (async () => {
  await db.exec(readFileSync('db/migrations/001-messenger.sql', 'utf8'));
  await db.exec(readFileSync('db/migrations/002-messenger-outbound.sql', 'utf8'));
})();
const query = async (sql, values) => {
  const result = await db.query(sql, values);
  return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
};
const pool = { query, connect: async () => ({ query, release() {} }) };
after(async () => { await ready; await db.close(); });

function loader(overrides = {}) {
  const cache = new Map();
  const load = (file) => {
    if (overrides[file]) return overrides[file];
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
const m = (messageId, extra = {}) => ({ pageId: '111', psid: '222', messageId, direction: 'in',
  timestamp: Date.now(), text: 'Shop có áo không?', attachments: [], ...extra });
async function fixture() {
  await ready;
  await db.exec('TRUNCATE messenger_outbound_requests, messenger_messages, messenger_conversations, messenger_customers CASCADE');
  const load = loader();
  const writer = load('lib/services/messengerPostgres.ts');
  return { load, writer };
}
const envKeys = ['PAGE_ID', 'PAGE_ACCESS_TOKEN', 'META_GRAPH_VERSION', 'INBOX_ACCESS_KEY', 'DATABASE_URL'];
const original = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
Object.assign(process.env, { PAGE_ID: '111', PAGE_ACCESS_TOKEN: 'test-page-token', META_GRAPH_VERSION: 'v23.0',
  INBOX_ACCESS_KEY: 'test-inbox-code-at-least-24-characters', DATABASE_URL: 'postgresql://test-only' });
after(() => { for (const [key, value] of Object.entries(original)) {
  if (value === undefined) delete process.env[key]; else process.env[key] = value;
} });

test('Postgres inbox snapshot, page isolation and cursor history use real PostgreSQL SQL', async () => {
  const { load, writer } = await fixture();
  const base = Date.now() - 10000;
  const messages = Array.from({ length: 55 }, (_, i) => m(`m${String(i).padStart(3, '0')}`, { timestamp: base + i, text: `Tin ${i}` }));
  await writer.savePostgresMessages([...messages, m('other-page', { pageId: '999' })], pool);
  const read = load('lib/services/messengerInboxDb.ts');
  const snapshot = await read.readMessengerInbox('111', 100, pool);
  assert.equal(snapshot.conversations.length, 1);
  const thread = snapshot.conversations[0];
  assert.equal(thread.messages.length, 50);
  assert.equal(thread.messages[0].messageId, 'm005');
  assert.equal(thread.messages.at(-1).messageId, 'm054');
  assert.equal(thread.hasOlder, true);
  const older = await read.readOlderMessengerMessages('111', '222', thread.messages[0].timestamp, 'm005', pool);
  assert.deepEqual(older.messages.map((x) => x.messageId), ['m000', 'm001', 'm002', 'm003', 'm004']);
  assert.equal(older.hasOlder, false);
});

test('two-way send -> stored outgoing -> webhook echo stays single; same request never sends twice', async () => {
  const { load, writer } = await fixture();
  await writer.savePostgresMessages([m('customer')], pool);
  const { sendMessengerMessage } = load('lib/services/messengerSend.ts');
  let calls = 0;
  const transport = async (url, options) => {
    calls++;
    assert.match(url, /\/111\/messages$/);
    assert.equal(options.headers.Authorization, 'Bearer test-page-token');
    assert.deepEqual(JSON.parse(options.body), { recipient: { id: '222' }, messaging_type: 'RESPONSE', message: { text: 'Chào bạn!' } });
    return Response.json({ recipient_id: '222', message_id: 'meta-out' });
  };
  const input = { psid: '222', text: 'Chào bạn!', requestId: '11111111-1111-4111-8111-111111111111' };
  const sent = await sendMessengerMessage(input, pool, transport);
  assert.equal(sent.persisted, true);
  await sendMessengerMessage(input, pool, transport);
  assert.equal(calls, 1);
  assert.deepEqual(await writer.savePostgresMessages([sent.message], pool), { inserted: 0, duplicates: 1 });
  assert.equal((await query("SELECT * FROM messenger_messages WHERE direction='out'")).rows.length, 1);
});

test('ambiguous timeout and duplicate in-flight request never auto-resend; expired window blocks Meta call', async () => {
  const { load, writer } = await fixture();
  await writer.savePostgresMessages([m('customer')], pool);
  const { sendMessengerMessage } = load('lib/services/messengerSend.ts');
  let calls = 0;
  const transport = async () => { calls++; throw new Error('timeout'); };
  const input = { psid: '222', text: 'Tin thử', requestId: '22222222-2222-4222-8222-222222222222' };
  await assert.rejects(sendMessengerMessage(input, pool, transport), /gián đoạn/);
  await assert.rejects(sendMessengerMessage(input, pool, transport), /Chưa xác định/);
  assert.equal(calls, 1);
  await query('UPDATE messenger_conversations SET last_in_at=$1', [Date.now() - 25 * 60 * 60 * 1000]);
  await assert.rejects(sendMessengerMessage({ ...input, requestId: 'new' }, pool, transport), /24 giờ/);
  assert.equal(calls, 1);
});

test('Meta rejection keeps conversation awaiting reply; database failure after Meta success is not a failed send', async () => {
  const { load, writer } = await fixture();
  await writer.savePostgresMessages([m('customer')], pool);
  const { sendMessengerMessage } = load('lib/services/messengerSend.ts');
  const input = { psid: '222', text: 'Tin thử', requestId: '33333333-3333-4333-8333-333333333333' };
  await assert.rejects(sendMessengerMessage(input, pool, async () => new Response('{}', { status: 403 })), /từ chối/);
  assert.equal((await query('SELECT * FROM messenger_conversations')).rows[0].last_out_at, null);
  const broken = { ...pool, connect: async () => { throw new Error('database down'); } };
  const result = await sendMessengerMessage({ ...input, requestId: '44444444-4444-4444-8444-444444444444' }, broken,
    async () => Response.json({ message_id: 'already-sent' }));
  assert.equal(result.persisted, false);
  assert.equal(result.message.messageId, 'already-sent');
});

test('dashboard APIs deny missing code, validate send input, and return stored messages with no secret', async () => {
  const { load, writer } = await fixture();
  await writer.savePostgresMessages([m('customer')], pool);
  const read = load('lib/services/messengerInboxDb.ts');
  const routes = loader({ 'lib/services/messengerInboxDb.ts': {
    readMessengerInbox: (pageId, limit) => read.readMessengerInbox(pageId, limit, pool),
    readOlderMessengerMessages: (...args) => read.readOlderMessengerMessages(...args, pool),
  } });
  const inbox = routes('app/api/messenger/inbox/route.ts');
  assert.equal((await inbox.GET(new Request('http://localhost/api/messenger/inbox'))).status, 401);
  const response = await inbox.GET(new Request('http://localhost/api/messenger/inbox', {
    headers: { Authorization: `Bearer ${process.env.INBOX_ACCESS_KEY}` },
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const text = await response.text();
  assert.match(text, /customer/);
  assert.equal(text.includes('test-page-token'), false);
  const send = routes('app/api/messenger/send/route.ts');
  assert.equal((await send.POST(new Request('http://localhost/api/messenger/send', { method: 'POST' }))).status, 401);
  assert.equal((await send.POST(new Request('http://localhost/api/messenger/send', { method: 'POST',
    headers: { Authorization: `Bearer ${process.env.INBOX_ACCESS_KEY}` }, body: JSON.stringify({ psid: 'wrong', text: 'x' }),
  }))).status, 400);
});

test('UI merge preserves loaded history, deduplicates echoes, invalidates stale AI and keeps new inbound pending', () => {
  const load = loader();
  const { mergeMessengerThread } = load('lib/services/messengerView.ts');
  const thread = { id: '["111","222"]', psid: '222', pageId: '111', createdAt: 1,
    lastInAt: 100, lastOutAt: null, messages: [m('customer', { timestamp: 100 })], hasOlder: false };
  let view = mergeMessengerThread(thread);
  assert.equal(view.isUnreplied, true);
  view.analysis = { messageId: 'customer', sentiment: 'negative' };
  view.aiSuggestion = { text: 'old suggestion' };
  const replied = mergeMessengerThread({ ...thread, lastOutAt: 200,
    messages: [...thread.messages, m('out', { timestamp: 200, direction: 'out' })] }, view);
  assert.equal(replied.isUnreplied, false);
  assert.equal(replied.aiSuggestion, undefined);
  const newQuestion = mergeMessengerThread({ ...thread, lastInAt: 300,
    messages: [...thread.messages, m('out', { timestamp: 200, direction: 'out' }), m('new', { timestamp: 300 })] }, replied);
  assert.equal(newQuestion.analysis, undefined);
  assert.equal(newQuestion.isUnreplied, true);
  const repeated = mergeMessengerThread({ ...thread, messages: [m('new', { timestamp: 300 })] }, newQuestion);
  assert.equal(repeated.messages.length, 3);
});
