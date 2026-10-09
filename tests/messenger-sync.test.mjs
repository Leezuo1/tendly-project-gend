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
  await db.exec(readFileSync('db/migrations/003-messenger-profiles.sql', 'utf8'));
  await db.exec(readFileSync('db/migrations/004-conversation-memory.sql', 'utf8'));
  await db.exec(readFileSync('db/migrations/005-conversation-view.sql', 'utf8'));
  await db.exec(readFileSync('db/migrations/005-conversation-view.sql', 'utf8'));
  await db.exec(readFileSync('db/migrations/004-conversation-memory.sql', 'utf8'));
  await db.exec(readFileSync('db/migrations/003-messenger-profiles.sql', 'utf8'));
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
  await db.exec('TRUNCATE messenger_analysis_history, messenger_outbound_requests, messenger_messages, messenger_conversations, messenger_customers CASCADE');
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

test('dashboard aggregates real messages across all conversations, isolates Page, returns empty data and counts Vietnamese local dates', async () => {
  const { load, writer } = await fixture();
  const { readDashboardData } = load('lib/services/dashboardData.ts');
  assert.deepEqual(await readDashboardData('111', pool), {
    waiting: 0, incomingToday: 0, outgoingToday: 0, recentMessages: [], weeklyChats: [],
  });
  const now = Date.now();
  const localDate = new Date(now + 7 * 3600000).toISOString().slice(0, 10);
  const start = Date.parse(localDate + 'T00:00:00+07:00');
  await writer.savePostgresMessages([
    m('yesterday', { timestamp: start - 1 }), m('today1', { timestamp: start }),
    m('today2', { timestamp: start + 1, psid: '333' }),
    m('answer', { timestamp: start + 2, direction: 'out' }),
    m('unrelated', { pageId: '999', timestamp: start + 3 }),
  ], pool);
  const result = await readDashboardData('111', pool);
  assert.equal(result.waiting, 1);
  assert.equal(result.incomingToday, 2);
  assert.equal(result.outgoingToday, 1);
  assert.deepEqual(result.recentMessages.map((x) => x.id), ['today2', 'today1', 'yesterday']);
  assert.equal(result.recentMessages[0].name, '');
  assert.equal(result.weeklyChats.find((x) => x.day === localDate).count, 2);
  const route = loader({ 'lib/services/dashboardData.ts': { readDashboardData: (id) => readDashboardData(id, pool) } })('app/api/dashboard/route.ts');
  assert.equal((await route.GET(new Request('http://localhost/api/dashboard'))).status, 401);
  const response = await route.GET(new Request('http://localhost/api/dashboard', {
    headers: { Authorization: `Bearer ${process.env.INBOX_ACCESS_KEY}` },
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).incomingToday, 2);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('settings channel status checks real Page access, requires inbox authorization and exposes no token', async () => {
  const route = loader()('app/api/settings/channels/route.ts');
  assert.equal((await route.GET(new Request('http://localhost/api/settings/channels'))).status, 401);
  const originalFetch = globalThis.fetch;
  const request = () => new Request('http://localhost/api/settings/channels', {
    headers: { Authorization: `Bearer ${process.env.INBOX_ACCESS_KEY}` },
  });
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url.includes(process.env.PAGE_ACCESS_TOKEN), false);
      assert.equal(options.headers.Authorization, `Bearer ${process.env.PAGE_ACCESS_TOKEN}`);
      assert.equal(url.includes('picture.type(large)'), true);
      return Response.json({ id: '111', name: 'Real test Page', picture: { data: {
        url: 'https://scontent.example.test/page-avatar.jpg', is_silhouette: false,
      } } });
    };
    const response = await route.GET(request());
    const result = await response.json();
    assert.equal(result.pageAccessible, true);
    assert.equal(result.pageName, 'Real test Page');
    assert.equal(result.pageAvatarUrl, 'https://scontent.example.test/page-avatar.jpg');
    assert.equal(JSON.stringify(result).includes(process.env.PAGE_ACCESS_TOKEN), false);
    globalThis.fetch = async () => Response.json({ id: '111', name: 'Real test Page', picture: { data: {
      url: `https://example.test/picture?access_token=${process.env.PAGE_ACCESS_TOKEN}`, is_silhouette: false,
    } } });
    assert.equal((await (await route.GET(request())).json()).pageAvatarUrl, '');
    globalThis.fetch = async () => Response.json({ error: { message: 'Token denied' } }, { status: 403 });
    const denied = await (await route.GET(request())).json();
    assert.equal(denied.pageAccessible, false);
    assert.equal(denied.pageName, '');
    assert.equal(denied.pageAvatarUrl, '');
  } finally { globalThis.fetch = originalFetch; }
});

test('automatic env session issues an HttpOnly cookie without exposing the key and rejects tampering, expiration and cross-origin access', async () => {
  const load = loader();
  const route = load('app/api/inbox/session/route.ts');
  const access = load('lib/services/inboxAccess.ts');
  const request = new Request('https://test.example/api/inbox/session');
  const response = await route.GET(request);
  assert.deepEqual(await response.json(), { ready: true });
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.match(cookie, /Secure/);
  assert.equal(cookie.includes(process.env.INBOX_ACCESS_KEY), false);
  const cookiePair = cookie.split(';')[0];
  const authorized = (cookie, origin) => new Request('https://test.example/api/messenger/inbox', {
    headers: { Cookie: cookie, ...(origin ? { Origin: origin } : {}) },
  });
  assert.equal(access.inboxAccessError(authorized(cookiePair)), undefined);
  assert.equal(access.inboxAccessError(authorized(cookiePair, 'https://evil.example')).status, 403);
  assert.equal(access.inboxAccessError(authorized(cookiePair.replace(/.$/, (c) => c === 'a' ? 'b' : 'a'))).status, 401);
  const expired = access.createInboxSession(process.env.INBOX_ACCESS_KEY, Date.now() - 7200000);
  assert.equal(access.inboxAccessError(authorized(`${access.INBOX_SESSION_COOKIE}=${expired}`)).status, 401);
  const originalKey = process.env.INBOX_ACCESS_KEY;
  try {
    delete process.env.INBOX_ACCESS_KEY;
    const unavailable = await route.GET(request);
    assert.equal(unavailable.status, 503);
    assert.match(unavailable.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal(access.inboxAccessError(authorized(cookiePair)).status, 503);
  } finally { process.env.INBOX_ACCESS_KEY = originalKey; }
  assert.equal((await route.GET(new Request('https://test.example/api/inbox/session', { headers: { Origin: 'https://evil.example' } }))).status, 403);
});

test('conversation memory survives reload, deduplicates per message, backfills all stored history and deletion hides only the shop view', async () => {
  const { load, writer } = await fixture();
  const memory = load('lib/services/conversationMemory.ts');
  const read = load('lib/services/messengerInboxDb.ts');
  const base = Date.now() - 100000;
  await writer.savePostgresMessages(Array.from({ length: 55 }, (_, i) => m(`history-${String(i).padStart(2, '0')}`, { timestamp: base + i })), pool);
  const jobs = await memory.pendingHistoricalAnalysis('111', '222', pool);
  assert.equal(jobs.length, 10); assert.equal(jobs[0].messageId, 'history-00'); assert.equal(jobs[0].context.length, 0);
  assert.equal(jobs[9].context.length, 9);
  const data = { reply: 'Shop hỗ trợ bạn nhé', model: 'test', sourceSummary: 'Cấu hình AI', analysis: {
    sentiment: 'negative', emotion: 'worried', priority: 'normal', priorityScore: 45, needsHuman: false,
    reason: 'Khách cần được giải thích', communicationStyle: 'Thường hỏi thêm chi tiết để yên tâm',
  } };
  assert.equal(await memory.saveConversationMemory('111', '222', 'history-54', data, pool), true);
  await memory.saveConversationMemory('111', '222', 'history-54', data, pool);
  assert.equal(await memory.saveConversationMemory('111', '333', 'history-54', data, pool), false);
  assert.equal(await memory.saveConversationMemory('999', '222', 'history-54', data, pool), false);
  const snapshot = await read.readMessengerInbox('111', 100, pool);
  assert.equal(snapshot.conversations[0].memory.length, 1);
  const restored = load('lib/services/messengerView.ts').mergeMessengerThread(snapshot.conversations[0]);
  assert.equal(restored.analysis.emotion, 'worried'); assert.equal(restored.aiSuggestion.text, data.reply);
  assert.equal(restored.memory[0].analysis.communicationStyle, data.analysis.communicationStyle);
  const hidden = await memory.hideConversation('111', '222', pool);
  assert.equal(hidden.rowCount, 1);
  assert.equal((await read.readMessengerInbox('111', 100, pool)).conversations.length, 0);
  assert.equal((await load('lib/services/dashboardData.ts').readDashboardData('111', pool)).recentMessages.length, 0);
  assert.equal((await query('SELECT COUNT(*) AS count FROM messenger_messages')).rows[0].count, 55);
  assert.equal((await memory.pendingHistoricalAnalysis('111', '222', pool)).length, 0);
  await writer.savePostgresMessages([m('history-54', { timestamp: base + 54 }), m('late-history', { timestamp: base - 1 })], pool);
  assert.equal((await read.readMessengerInbox('111', 100, pool)).conversations.length, 0);
  await writer.savePostgresMessages([m('fresh', { timestamp: Number(hidden.rows[0].hidden_at) + 100 })], pool);
  const reopened = await read.readMessengerInbox('111', 100, pool);
  assert.equal(reopened.conversations.length, 1); assert.equal(reopened.conversations[0].memory.length, 1);
  assert.deepEqual(reopened.conversations[0].messages.map((m) => m.messageId), ['fresh']);
  assert.equal(reopened.conversations[0].hasOlder, false);
  const afterDeletion = load('lib/services/messengerView.ts').mergeMessengerThread(reopened.conversations[0], restored);
  assert.deepEqual(afterDeletion.messages.map((m) => m.id), ['fresh']);
  const older = await read.readOlderMessengerMessages('111', '222', reopened.conversations[0].messages[0].timestamp, 'fresh', pool);
  assert.deepEqual(older.messages, []);
  assert.equal((await query('SELECT COUNT(*) AS count FROM messenger_messages')).rows[0].count, 57);
});

test('one-line personality summarizes the entire persisted analysis history and caches until evidence changes', async () => {
  const { load, writer } = await fixture();
  const memory = load('lib/services/conversationMemory.ts');
  const personality = load('lib/services/customerPersonality.ts');
  const messages = [m('old1', { timestamp: 100 }), m('old2', { timestamp: 200 }), m('latest', { timestamp: 300 })];
  await writer.savePostgresMessages(messages, pool);
  const result = { reply: 'Shop hỗ trợ bạn', model: 'test', sourceSummary: 'Cấu hình AI', analysis: {
    sentiment: 'positive', emotion: 'happy', priority: 'normal', priorityScore: 40, reason: 'Khách hỏi lịch sự',
    needsHuman: false, communicationStyle: 'Lịch sự, ngắn gọn',
  } };
  let calls = 0;
  const generate = async (options) => {
    calls++;
    const input = JSON.parse(options.user);
    assert.equal(input.messageCount, 3);
    assert.equal(input.styles.reduce((n, s) => n + s.count, 0), 3);
    return { result: options.parse(JSON.stringify({ summary: 'Lịch sự, thường trao đổi ngắn gọn.' })), model: 'test' };
  };
  await memory.saveConversationMemory('111', '222', 'latest', result, pool);
  assert.equal((await personality.refreshCustomerPersonality('111', '222', pool, generate)).summary, '');
  assert.equal(calls, 0);
  for (const id of ['old1', 'old2']) await memory.saveConversationMemory('111', '222', id, result, pool);
  const summary = await personality.refreshCustomerPersonality('111', '222', pool, generate);
  assert.equal(summary.summary, 'Lịch sự, thường trao đổi ngắn gọn.');
  await personality.refreshCustomerPersonality('111', '222', pool, generate);
  assert.equal(calls, 1);
  await memory.saveConversationMemory('111', '222', 'old1', { ...result, analysis: { ...result.analysis, communicationStyle: 'Hỏi nhiều chi tiết' } }, pool);
  await personality.refreshCustomerPersonality('111', '222', pool, generate);
  assert.equal(calls, 2);
  const snapshot = await load('lib/services/messengerInboxDb.ts').readMessengerInbox('111', 100, pool);
  assert.equal(snapshot.conversations[0].personalitySummary, summary.summary);
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
  }, 'lib/services/messengerProfiles.ts': { refreshMessengerProfiles: async (snapshot) => snapshot } });
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

test('new inbound highlights until viewed; repeated snapshots, loaded history and outgoing echoes never mark it new again', () => {
  const { mergeMessengerThread } = loader()('lib/services/messengerView.ts');
  const thread = { id: 'thread', psid: '222', pageId: '111', createdAt: 1,
    messages: [m('in', { timestamp: 100 })], hasOlder: false };
  const initial = mergeMessengerThread(thread);
  assert.equal(initial.hasNewMessage, true);
  assert.deepEqual(initial.unreadMessageIds, ['in']);
  const seen = { ...initial, hasNewMessage: false, unreadMessageIds: [] };
  assert.equal(mergeMessengerThread(thread, seen).hasNewMessage, false);
  assert.deepEqual(mergeMessengerThread(thread, seen).unreadMessageIds, []);
  const echo = mergeMessengerThread({ ...thread, messages: [m('out', { timestamp: 200, direction: 'out' })] }, seen);
  assert.equal(echo.hasNewMessage, false);
  assert.equal(mergeMessengerThread({ ...thread, messages: [m('old', { timestamp: 50 })] }, echo).hasNewMessage, false);
  const fresh = mergeMessengerThread({ ...thread, messages: [m('new', { timestamp: 300 })] }, echo);
  assert.equal(fresh.hasNewMessage, true);
  assert.deepEqual(fresh.unreadMessageIds, ['new']);
  assert.equal(mergeMessengerThread(thread, fresh).hasNewMessage, true);
  assert.deepEqual(mergeMessengerThread(thread, fresh).unreadMessageIds, ['new']);
  const burst = mergeMessengerThread({ ...thread, messages: [
    m('next1', { timestamp: 400 }), m('next2', { timestamp: 500 }),
  ] }, fresh);
  assert.equal(burst.unreadMessageIds.length, 3);
  const outgoing = mergeMessengerThread({ ...thread, messages: [m('reply', { timestamp: 600, direction: 'out' })] }, burst);
  assert.equal(outgoing.unreadMessageIds.length, 3);
});

test('customer profile loads from Meta, persists by Page/PSID, and supplies real name/avatar/history to UI', async () => {
  const { load, writer } = await fixture();
  await writer.savePostgresMessages([m('profile-customer'), m('other-page', { pageId: '999' })], pool);
  const read = load('lib/services/messengerInboxDb.ts');
  const profiles = load('lib/services/messengerProfiles.ts');
  let calls = 0;
  const transport = async (url, options) => {
    calls++;
    assert.equal(url, 'https://graph.facebook.com/v23.0/222?fields=first_name,last_name,profile_pic');
    assert.equal(options.headers.Authorization, 'Bearer test-page-token');
    assert.equal(url.includes('test-page-token'), false);
    return Response.json({ id: '222', first_name: 'Ngọc', last_name: 'Anh', profile_pic: 'https://example.com/avatar.jpg' });
  };
  const routes = loader({
    'lib/services/messengerInboxDb.ts': { readMessengerInbox: (pageId, limit) => read.readMessengerInbox(pageId, limit, pool) },
    'lib/services/messengerProfiles.ts': { refreshMessengerProfiles: (snapshot) => profiles.refreshMessengerProfiles(snapshot, pool, transport) },
  });
  const route = routes('app/api/messenger/inbox/route.ts');
  const req = () => new Request('http://localhost/api/messenger/inbox', { headers: { Authorization: `Bearer ${process.env.INBOX_ACCESS_KEY}` } });
  const response = await route.GET(req());
  assert.equal(response.status, 200);
  const snapshot = await response.json();
  assert.equal(snapshot.conversations[0].customer.name, 'Ngọc Anh');
  const view = load('lib/services/messengerView.ts').mergeMessengerThread(snapshot.conversations[0]);
  assert.equal(view.name, 'Ngọc Anh');
  assert.equal(view.threadWho.name, 'Ngọc Anh');
  assert.equal(view.profile.name, 'Ngọc Anh');
  assert.equal(view.avatar, 'NA');
  assert.equal(view.avatarUrl, 'https://example.com/avatar.jpg');
  assert.equal(view.profile.messengerId, '222');
  assert.equal(view.profile.timeline[0].text, 'Khách nhắn: Shop có áo không?');
  assert.equal(view.profile.orderCount, 'Chưa có dữ liệu');
  await route.GET(req());
  assert.equal(calls, 1); // Polling reads persisted profile instead of hitting Meta again.
  const stored = (await pool.query('SELECT display_name, profile_status FROM messenger_customers WHERE page_id=$1', ['111'])).rows[0];
  assert.equal(stored.display_name, 'Ngọc Anh');
  assert.equal(stored.profile_status, 'ready');
  assert.equal((await read.readMessengerInbox('999', 100, pool)).conversations[0].customer.name, null);
});

test('profile denial/timeout never breaks messages, never invents identity, backs off, and retains cached names', async () => {
  const { load, writer } = await fixture();
  await writer.savePostgresMessages([m('profile-denied')], pool);
  const read = load('lib/services/messengerInboxDb.ts');
  const { refreshMessengerProfiles } = load('lib/services/messengerProfiles.ts');
  let calls = 0;
  const denied = async () => { calls++; return Response.json({ error: { message: 'Permission denied' } }, { status: 403 }); };
  let snapshot = await read.readMessengerInbox('111', 100, pool);
  await refreshMessengerProfiles(snapshot, pool, denied);
  assert.equal(snapshot.conversations[0].customer.status, 'unavailable');
  assert.equal(snapshot.conversations[0].customer.name, null);
  assert.equal(snapshot.conversations[0].messages[0].messageId, 'profile-denied');
  snapshot = await read.readMessengerInbox('111', 100, pool);
  await refreshMessengerProfiles(snapshot, pool, denied);
  assert.equal(calls, 1);
  await pool.query(`UPDATE messenger_customers SET display_name='Tên đã lưu', profile_status='ready', profile_retry_after=0 WHERE page_id=$1`, ['111']);
  snapshot = await read.readMessengerInbox('111', 100, pool);
  await refreshMessengerProfiles(snapshot, pool, async () => { throw new Error('timeout'); });
  assert.equal(snapshot.conversations[0].customer.name, 'Tên đã lưu');
  assert.equal(snapshot.conversations[0].customer.status, 'ready');
});

test('profile requests are bounded, leased across simultaneous polls, and unsafe image URLs are rejected', async () => {
  const { load, writer } = await fixture();
  await writer.savePostgresMessages(Array.from({ length: 5 }, (_, i) => m(`profile-${i}`, { psid: String(300 + i) })), pool);
  const read = load('lib/services/messengerInboxDb.ts');
  const { refreshMessengerProfiles } = load('lib/services/messengerProfiles.ts');
  let calls = 0;
  let finish;
  let started;
  const pending = new Promise((resolve) => { finish = resolve; });
  const entered = new Promise((resolve) => { started = resolve; });
  const transport = async () => {
    calls++;
    if (calls === 3) started();
    await pending;
    return Response.json({ first_name: 'Khách có tên', profile_pic: 'javascript:alert(1)' });
  };
  const first = await read.readMessengerInbox('111', 100, pool);
  const stale = await read.readMessengerInbox('111', 100, pool);
  const updating = refreshMessengerProfiles(first, pool, transport);
  await entered;
  await refreshMessengerProfiles(stale, pool, transport);
  assert.equal(calls, 3);
  finish();
  await updating;
  assert.equal(first.conversations.filter((thread) => thread.customer.name).length, 3);
  assert.equal(first.conversations[0].customer.avatarUrl, null);
  assert.equal((await read.readMessengerInbox('111', 100, pool)).conversations.filter((thread) => thread.customer.status === 'pending').length, 2);
});
