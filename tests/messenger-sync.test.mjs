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
  await db.exec(readFileSync('db/migrations/001-messenger.sql', 'utf8'));
  await db.exec(readFileSync('db/migrations/002-messenger-outbound.sql', 'utf8'));
  await db.exec(readFileSync('db/migrations/003-messenger-profiles.sql', 'utf8'));
  await db.exec(readFileSync('db/migrations/004-conversation-memory.sql', 'utf8'));
  await db.exec(readFileSync('db/migrations/005-conversation-view.sql', 'utf8'));
  await db.exec(readFileSync('db/migrations/011-messenger-ai.sql', 'utf8'));
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
    if (file.replaceAll('\\', '/').endsWith('lib/services/appSecurity.ts')) return businessSecurity;
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
  await db.exec('TRUNCATE messenger_ai_settings');
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

async function aiFixture(enabled = true) {
  const { load, writer } = await fixture();
  const state = { canAutoReply: true, sends: 0, beforeReply: async () => {}, failSend: false, failAi: false };
  const knowledge = { shop: { name: 'Shop', email: '', phone: '' },
    productSource: { name: 'Catalog', connected: true, lastSyncedAt: 1 }, products: [],
    faqs: [{ id: 'f1', question: 'Giờ mở cửa?', answer: '8 giờ', tag: '', keywords: [], active: true }], emailTriggers: [] };
  const service = loader({
    'lib/services/gemini.ts': { generateGeminiJson: async (options) => {
      await state.beforeReply(options);
      if (state.failAi) throw new Error('AI unavailable');
      return { model: 'test', result: options.parse(JSON.stringify({ reply: 'Shop mở cửa lúc 8 giờ.', analysis: {
        sentiment: 'neutral', emotion: 'neutral', priority: 'normal', needsHuman: false,
        reason: state.canAutoReply ? 'Dựa vào FAQ giờ mở cửa.' : 'Thiếu dữ liệu đơn hàng.',
        canAutoReply: state.canAutoReply,
      } })) };
    } },
    'lib/services/messengerSend.ts': { sendMessengerMessage: (input) => load('lib/services/messengerSend.ts').sendMessengerMessage(input, pool, async () => {
      state.sends++;
      if (state.failSend) throw new Error('Timeout after sending');
      return Response.json({ message_id: 'auto-' + state.sends });
    }) },
  })('lib/services/messengerAi.ts');
  await service.saveMessengerAiSettings('111', enabled, knowledge, pool);
  await query('UPDATE messenger_ai_settings SET enabled_at=$1', [Date.now() - 10000]);
  const incoming = async (id, extra = {}) => writer.savePostgresMessages([m(id, { timestamp: Date.now() - 10, ...extra })], pool);
  const process = () => service.processMessengerAi('111', '222', undefined, pool);
  return { state, service, writer, incoming, process, knowledge, load };
}

test('Messenger AI defaults off, analyzes without sending, and sends one grounded reply when enabled', async () => {
  const f = await aiFixture(false);
  assert.equal((await f.service.readMessengerAiSettings('999', pool)).autoReply, false);
  await f.incoming('off'); await f.process();
  assert.equal(f.state.sends, 0);
  assert.equal((await query('SELECT status FROM messenger_ai_jobs')).rows[0].status, 'ready');
  await f.service.saveMessengerAiSettings('111', true, f.knowledge, pool);
  await query('UPDATE messenger_ai_settings SET enabled_at=$1', [Date.now() - 1000]);
  await f.incoming('on');
  await Promise.all([f.process(), f.process()]);
  await f.process();
  assert.equal(f.state.sends, 1);
  assert.equal((await query("SELECT status FROM messenger_ai_jobs WHERE message_id='on'")).rows[0].status, 'sent');
});

test('insufficient evidence stays pending above unread/urgent threads, survives enabling AI, and blocks later auto replies until manual response', async () => {
  const f = await aiFixture(false);
  f.state.canAutoReply = false;
  await f.incoming('missing'); await f.process();
  await f.incoming('unread-other', { psid: '333', timestamp: Date.now() });
  let snapshot = await f.load('lib/services/messengerInboxDb.ts').readMessengerInbox('111', 1, pool);
  assert.equal(snapshot.conversations[0].psid, '222');
  assert.equal(snapshot.conversations[0].waitingConfirmation, true);
  const view = f.load('lib/services/messengerView.ts').mergeMessengerThread(snapshot.conversations[0]);
  const inbox = f.load('lib/services/inboxAi.ts');
  assert.equal(inbox.sortReplyQueue([{ ...view, id: 'unread', hasNewMessage: true, waitingConfirmation: false },
    { ...view, hasNewMessage: false }])[0].id, view.id);
  await f.service.saveMessengerAiSettings('111', true, f.knowledge, pool);
  await query('UPDATE messenger_ai_settings SET enabled_at=$1', [Date.now() - 1000]);
  f.state.canAutoReply = true;
  await f.incoming('followup'); await f.process();
  assert.equal(f.state.sends, 0);
  await f.writer.savePostgresMessages([m('manual', { direction: 'out', timestamp: Date.now() })], pool);
  snapshot = await f.load('lib/services/messengerInboxDb.ts').readMessengerInbox('111', 100, pool);
  assert.equal(snapshot.conversations.find((c) => c.psid === '222').waitingConfirmation, false);
  await f.incoming('after-manual', { timestamp: Date.now() + 1 }); await f.process();
  assert.equal(f.state.sends, 1);
});

test('missing evidence flag, unread attachments and AI errors fail closed with persistent review', async () => {
  for (const mode of ['missing-flag', 'attachment', 'ai-error']) {
    const f = await aiFixture();
    if (mode === 'missing-flag') f.state.canAutoReply = undefined;
    if (mode === 'ai-error') f.state.failAi = true;
    await f.incoming(mode, mode === 'attachment' ? { attachments: [{ type: 'image', url: 'https://example.com/a.jpg' }] } : {});
    if (mode === 'ai-error') await assert.rejects(f.process(), /căn cứ/);
    else await f.process();
    assert.equal(f.state.sends, 0);
    assert.equal((await query('SELECT status FROM messenger_ai_jobs')).rows[0].status, 'review');
  }
});

test('turning off AI, receiving a newer question or a manual reply during generation prevents a stale automatic send', async () => {
  for (const mode of ['off', 'new-message', 'manual', 'hidden']) {
    const f = await aiFixture();
    await f.incoming('original');
    f.state.beforeReply = async () => {
      if (mode === 'off') await f.service.saveMessengerAiSettings('111', false, undefined, pool);
      if (mode === 'new-message') await f.incoming('newer', { timestamp: Date.now() + 1 });
      if (mode === 'manual') await f.writer.savePostgresMessages([m('manual', { direction: 'out' })], pool);
      if (mode === 'hidden') await f.load('lib/services/conversationMemory.ts').hideConversation('111', '222', pool);
    };
    await f.process();
    assert.equal(f.state.sends, mode === 'new-message' ? 1 : 0, mode);
    if (mode === 'new-message') assert.equal((await query("SELECT status FROM messenger_ai_jobs WHERE message_id='original'")).rows[0].status, 'ready');
  }
});

test('a newer message waits for earlier pending analysis; sufficient messages resume and missing evidence blocks the whole conversation', async () => {
  for (const sufficient of [false, true]) {
    const f = await aiFixture();
    let release, started;
    const hold = new Promise((resolve) => { release = resolve; });
    const entered = new Promise((resolve) => { started = resolve; });
    f.state.beforeReply = async (options) => {
      if (JSON.parse(options.user).latestCustomerMessage === 'original') { started(); await hold; }
    };
    await f.incoming('original', { text: 'original' });
    const older = f.process();
    await entered;
    await f.incoming('newer', { text: 'newer', timestamp: Date.now() + 1 });
    await f.process();
    assert.equal(f.state.sends, 0);
    f.state.canAutoReply = sufficient;
    release(); await older;
    assert.equal(f.state.sends, sufficient ? 1 : 0);
  }
});

test('unknown Meta delivery is never retried, even after a new message or toggling AI', async () => {
  const f = await aiFixture(); f.state.failSend = true;
  await f.incoming('unknown'); await f.process(); await f.process();
  assert.equal((await query('SELECT status FROM messenger_ai_jobs')).rows[0].status, 'unknown');
  await f.service.saveMessengerAiSettings('111', false, undefined, pool);
  await f.service.saveMessengerAiSettings('111', true, f.knowledge, pool);
  await query('UPDATE messenger_ai_settings SET enabled_at=$1', [Date.now() - 1000]);
  await f.incoming('next'); await f.process();
  assert.equal(f.state.sends, 1);
});

test('old messages and messages from other Pages cannot trigger auto reply', async () => {
  const f = await aiFixture();
  await f.incoming('expired', { timestamp: Date.now() - 25 * 3600000 }); await f.process();
  await f.incoming('other-page', { pageId: '999' });
  await f.service.processMessengerAi('999', '222', undefined, pool);
  assert.equal(f.state.sends, 0);
});

test('manual insufficient-evidence analysis persists review and reanalysis cannot remove it', async () => {
  const f = await aiFixture(false);
  await f.incoming('manual-analysis');
  const save = f.load('lib/services/conversationMemory.ts').saveConversationMemory;
  const result = { analysis: { sentiment: 'neutral', emotion: 'neutral', priority: 'normal', priorityScore: 40,
    needsHuman: false, canAutoReply: false, reason: 'Thiếu thông tin.' }, reply: 'Cần shop kiểm tra.', model: 'test', sourceSummary: 'Test' };
  await save('111', '222', 'manual-analysis', result, pool);
  await save('111', '222', 'manual-analysis', { ...result, analysis: { ...result.analysis, canAutoReply: true } }, pool);
  assert.equal((await query('SELECT status FROM messenger_ai_jobs')).rows[0].status, 'review');
});

test('Messenger AI API protects settings, validates knowledge and customer, and permits disabling without browser knowledge', async () => {
  const f = await aiFixture(false);
  const route = loader({ 'lib/services/messengerAi.ts': {
    readMessengerAiSettings: (pageId) => f.service.readMessengerAiSettings(pageId, pool),
    saveMessengerAiSettings: (pageId, enabled, knowledge) => f.service.saveMessengerAiSettings(pageId, enabled, knowledge, pool),
    processMessengerAi: (pageId, psid, knowledge) => f.service.processMessengerAi(pageId, psid, knowledge, pool),
  } })('app/api/messenger/ai/route.ts');
  const req = (method, body) => new Request('http://localhost/api/messenger/ai', { method,
    headers: { Authorization: `Bearer ${process.env.INBOX_ACCESS_KEY}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const response = await route.GET(req('GET'));
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal((await response.json()).autoReply, false);
  assert.equal((await route.PUT(req('PUT', { autoReply: 'yes' }))).status, 400);
  assert.equal((await route.PUT(req('PUT', { autoReply: true }))).status, 400);
  assert.equal((await route.POST(req('POST', { psid: 'bad', knowledge: f.knowledge }))).status, 400);
  assert.equal((await route.PUT(req('PUT', { autoReply: true, knowledge: f.knowledge }))).status, 200);
  assert.equal((await route.PUT(req('PUT', { autoReply: false }))).status, 200);
  assert.equal((await f.service.readMessengerAiSettings('111', pool)).autoReply, false);
});

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
  const response = await route.GET(new Request('http://localhost/api/dashboard', {
    headers: { Authorization: `Bearer ${process.env.INBOX_ACCESS_KEY}` },
  }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).incomingToday, 2);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('sidebar count tracks unanswered conversations without opening inbox, excludes hidden and other Pages', async () => {
  const { load, writer } = await fixture();
  const { readUnrepliedCount } = load('lib/services/messengerCount.ts');
  const count = () => readUnrepliedCount('111', pool);
  assert.equal(await count(), 0);
  const base = Date.now() - 10000;
  await writer.savePostgresMessages([
    m('count-in', { timestamp: base }), m('count-in-again', { timestamp: base + 1 }),
    m('count-other-customer', { psid: '333', timestamp: base + 2 }),
    m('count-other-page', { pageId: '999', timestamp: base + 3 }),
    m('count-out-only', { psid: '444', direction: 'out', timestamp: base + 4 }),
  ], pool);
  assert.equal(await count(), 2, 'multiple messages from one customer count as one waiting conversation');
  await load('lib/services/messengerInboxDb.ts').readMessengerInbox('111', 100, pool);
  assert.equal(await count(), 2, 'reading inbox does not answer conversations');
  await writer.savePostgresMessages([m('count-reply', { direction: 'out', timestamp: base + 5 })], pool);
  assert.equal(await count(), 1);
  await writer.savePostgresMessages([m('count-next-in', { timestamp: base + 6 })], pool);
  assert.equal(await count(), 2, 'new inbound message reopens waiting state');
  await load('lib/services/conversationMemory.ts').hideConversation('111', '333', pool);
  assert.equal(await count(), 1);

  const route = loader({ 'lib/services/messengerCount.ts': {
    readUnrepliedCount: (id) => readUnrepliedCount(id, pool),
  } })('app/api/messenger/unreplied/route.ts');
  const request = () => new Request('http://localhost/api/messenger/unreplied', {
    headers: { Authorization: `Bearer ${process.env.INBOX_ACCESS_KEY}` },
  });
  const response = await route.GET(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { count: 1 });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const databaseUrl = process.env.DATABASE_URL;
  try {
    delete process.env.DATABASE_URL;
    assert.equal((await route.GET(request())).status, 503);
  } finally { process.env.DATABASE_URL = databaseUrl; }
});

test('settings channel status checks real Page access, requires inbox authorization and exposes no token', async () => {
  const route = loader()('app/api/settings/channels/route.ts');
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
  const response = await inbox.GET(new Request('http://localhost/api/messenger/inbox', {
    headers: { Authorization: `Bearer ${process.env.INBOX_ACCESS_KEY}` },
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const text = await response.text();
  assert.match(text, /customer/);
  assert.equal(text.includes('test-page-token'), false);
  const send = routes('app/api/messenger/send/route.ts');
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
