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
  await db.exec(readFileSync('db/migrations/015-marketing-workspace.sql', 'utf8'));
  await db.exec(readFileSync('db/migrations/016-customer-care.sql', 'utf8'));
  await db.exec(readFileSync('db/migrations/016-customer-care.sql', 'utf8'));
  for (const file of ['008-facebook-comments.sql', '009-livestream.sql', '010-live-waiting.sql', '011-live-cockpit.sql', '017-customer-care-sources.sql', '017-customer-care-sources.sql', '023-messenger-orders.sql', '024-shop-catalog.sql', '025-conversation-staff-labels.sql', '026-conversation-handoff.sql', '027-shop-product-images.sql']) {
    await db.exec(readFileSync(`db/migrations/${file}`, 'utf8'));
  }
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
  await db.exec('TRUNCATE messenger_ai_settings, messenger_orders');
  await db.exec('TRUNCATE marketing_workspaces');
  await db.exec('TRUNCATE facebook_comments,live_sessions CASCADE');
  // A shop_catalog row would replace the approved knowledge AI tests rely on (liveKnowledge); label tests insert their own.
  await db.exec('TRUNCATE shop_catalog');
  await db.exec('TRUNCATE shop_product_images');
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
  const state = { canAutoReply: true, priority: 'normal', sends: 0, beforeReply: async () => {}, beforeTransport: async () => {}, failSend: false, failAi: false, replyText: 'Shop mở cửa lúc 8 giờ.', geminiCalls: 0, bodies: [],
    imageTransport: async () => new Response(new Uint8Array([65, 66, 67]), { headers: { 'content-type': 'image/jpeg' } }) };
  const knowledge = { shop: { name: 'Shop', email: '', phone: '' },
    productSource: { name: 'Catalog', connected: true, lastSyncedAt: 1 }, products: [],
    faqs: [{ id: 'f1', question: 'Giờ mở cửa?', answer: '8 giờ', tag: '', keywords: [], active: true }], emailTriggers: [] };
  const aiLoad = loader({
    'lib/services/messengerPostgres.ts': { ...load('lib/services/messengerPostgres.ts'), getMessengerPool: () => pool },
    // Photos are downloaded through state.imageTransport so no test touches the network.
    'lib/services/imageIntake.ts': { ...load('lib/services/imageIntake.ts'), buildImageInput: (attachments, text) => load('lib/services/imageIntake.ts').buildImageInput(attachments, text, state.imageTransport) },
    'lib/services/gemini.ts': { generateGeminiJson: async (options) => {
      state.geminiCalls++;
      await state.beforeReply(options);
      if (state.failAi) throw new Error('AI unavailable');
      return { model: 'test', result: options.parse(JSON.stringify({ reply: state.replyText, analysis: {
        sentiment: 'neutral', emotion: 'neutral', priority: state.priority, needsHuman: false,
        reason: state.canAutoReply ? 'Dựa vào FAQ giờ mở cửa.' : 'Thiếu dữ liệu đơn hàng.',
        canAutoReply: state.canAutoReply, ...(state.labels ? { labels: state.labels } : {}), ...(state.imageKinds ? { imageKinds: state.imageKinds } : {}),
        ...(state.photoProductIds ? { photoProductIds: state.photoProductIds } : {}), ...(state.analysisExtra ?? {}),
      } })) };
    } },
    'lib/services/messengerSend.ts': { ...load('lib/services/messengerSend.ts'), sendMessengerMessage: (input) => load('lib/services/messengerSend.ts').sendMessengerMessage(input, { ...pool, query: async (sql, values) => {
      const result = await query(sql, values);
      if (sql.includes('INSERT INTO messenger_outbound_requests')) await state.beforeTransport();
      return result;
    } }, async (_url, options) => {
      state.sends++; state.bodies.push(options.body);
      if (state.failSend) throw new Error('Timeout after sending');
      return state.respond?.(state.sends) ?? Response.json({ message_id: 'auto-' + state.sends });
    }) },
  });
  const service = aiLoad('lib/services/messengerAi.ts');
  const profile = aiLoad('lib/services/aiConfiguration.ts').defaultAiConfiguration().profiles.chat;
  profile.enabled = enabled;
  await aiLoad('lib/services/customerCare.ts').saveCustomerCareSettings('111', { profile, knowledge,
    confirmed: true, pageAssigned: true, pageEnabled: true, updatedAt: null,
    pageProfile: { name: '', address: '', tone: '', examples: '' } }, 'test-owner', pool);
  await query('UPDATE messenger_ai_settings SET enabled_at=$1', [Date.now() - 10000]);
  const incoming = async (id, extra = {}) => {
    await writer.savePostgresMessages([m(id, { timestamp: Date.now() - 10, ...extra })], pool);
    // Existing automatic-send scenarios explicitly opt in each new thread; production defaults stay off.
    await query('UPDATE messenger_conversations SET ai_auto_reply=true,ai_updated_at=1,ai_enabled_at=$1 WHERE ai_updated_at=0', [Date.now() - 10000]);
  };
  const process = () => service.processMessengerAi('111', '222', undefined, pool);
  return { state, service, writer, incoming, process, knowledge, load: aiLoad, profile };
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

test('a reply with a price or link the shop never gave is never sent; the fixed handoff template goes out instead and AI switches off for the conversation', async () => {
  const f = await aiFixture(true);
  await f.service.saveMessengerAiSettings('111', true, f.knowledge, pool);
  await query('UPDATE messenger_ai_settings SET enabled_at=$1', [Date.now() - 1000]);
  const { UNKNOWN_REPLY } = f.load('lib/services/handoff.ts');
  f.state.replyText = 'Áo đang giảm còn 99.000đ, xem tại https://shop-la.example/sale nhé.';
  await f.incoming('invented'); await f.process();
  assert.equal(f.state.sends, 1);
  assert.equal((await query("SELECT status FROM messenger_ai_jobs WHERE message_id='invented'")).rows[0].status, 'sent');
  assert.deepEqual((await query("SELECT text FROM messenger_outbound_requests WHERE status='sent'")).rows.map(row => row.text), [UNKNOWN_REPLY]);
  const saved = (await query("SELECT analysis,reply FROM messenger_analysis_history WHERE message_id='invented'")).rows[0];
  assert.match(saved.analysis.reason, /số tiền|đường dẫn/);
  assert.equal(saved.reply, UNKNOWN_REPLY);
  assert.equal((await query('SELECT ai_auto_reply FROM messenger_conversations')).rows[0].ai_auto_reply, false);
  await f.process();
  assert.equal(f.state.sends, 1, 'a replay never sends a second template');
});

test('an invented amount alone (no link) also hands off with the template', async () => {
  const f = await aiFixture(true);
  await f.service.saveMessengerAiSettings('111', true, f.knowledge, pool);
  await query('UPDATE messenger_ai_settings SET enabled_at=$1', [Date.now() - 1000]);
  f.state.replyText = 'Áo đang giảm còn 99.000đ nhé.';
  await f.incoming('amount-only'); await f.process();
  assert.equal(f.state.sends, 1);
  assert.equal((await query("SELECT status FROM messenger_ai_jobs WHERE message_id='amount-only'")).rows[0].status, 'sent');
  assert.match((await query("SELECT analysis FROM messenger_analysis_history WHERE message_id='amount-only'")).rows[0].analysis.reason, /số tiền/);
});

test('after the handoff template AI stays off for that conversation until staff turn the switch back on', async () => {
  const f = await aiFixture(true);
  await f.service.saveMessengerAiSettings('111', true, f.knowledge, pool);
  await query('UPDATE messenger_ai_settings SET enabled_at=$1', [Date.now() - 1000]);
  f.state.canAutoReply = false;
  await f.incoming('q1', { text: 'Bạn bán xe máy không?' }); await f.process();
  assert.equal(f.state.sends, 1, 'the template');
  f.state.canAutoReply = true; f.state.replyText = 'Shop mở cửa lúc 8 giờ.';
  await f.incoming('q2', { text: 'Giờ mở cửa?', timestamp: Date.now() + 1000 }); await f.process();
  assert.equal(f.state.sends, 1, 'AI is off for this conversation while staff handle it');
  await f.writer.savePostgresMessages([m('staff', { direction: 'out', timestamp: Date.now() + 2000, text: 'Shop xử lý giúp bạn ạ.' })], pool);
  const { ai_updated_at } = (await query('SELECT ai_updated_at FROM messenger_conversations')).rows[0];
  await f.service.saveConversationAutoReply('111', '222', true, Number(ai_updated_at), pool);
  await f.incoming('q3', { text: 'Giờ mở cửa?', timestamp: Date.now() + 3000 }); await f.process();
  assert.equal(f.state.sends, 2, 'after staff turn the switch back on AI answers again');
  assert.equal((await query("SELECT status FROM messenger_ai_jobs WHERE message_id='q3'")).rows[0].status, 'sent');
});

test('turning the switch back on closes the open handoff even before staff reply, so AI is not silently held', async () => {
  const f = await aiFixture(true);
  await f.service.saveMessengerAiSettings('111', true, f.knowledge, pool);
  await query('UPDATE messenger_ai_settings SET enabled_at=$1', [Date.now() - 1000]);
  f.state.canAutoReply = false;
  await f.incoming('q1', { text: 'Bạn bán xe máy không?' }); await f.process();
  assert.equal(f.state.sends, 1, 'the template');
  const { ai_updated_at } = (await query('SELECT ai_updated_at FROM messenger_conversations')).rows[0];
  await f.service.saveConversationAutoReply('111', '222', true, Number(ai_updated_at), pool);
  assert.equal((await query('SELECT handoff_message_id FROM messenger_conversations')).rows[0].handoff_message_id, null);
  f.state.canAutoReply = true; f.state.replyText = 'Shop mở cửa lúc 8 giờ.';
  await f.incoming('q2', { text: 'Giờ mở cửa?', timestamp: Date.now() + 3000 }); await f.process();
  assert.equal(f.state.sends, 2, 'the next question gets a real answer');
  assert.equal((await query("SELECT status FROM messenger_ai_jobs WHERE message_id='q2'")).rows[0].status, 'sent');
});

test('with the conversation switch off an unanswerable reply is held as a suggestion for staff and nothing is sent', async () => {
  const f = await aiFixture(true);
  await f.service.saveMessengerAiSettings('111', true, f.knowledge, pool);
  await query('UPDATE messenger_ai_settings SET enabled_at=$1', [Date.now() - 1000]);
  f.state.replyText = 'Áo đang giảm còn 99.000đ nhé.';
  await f.incoming('off-held'); await query('UPDATE messenger_conversations SET ai_auto_reply=false');
  const result = await f.process();
  assert.equal(f.state.sends, 0);
  assert.equal((await query("SELECT status FROM messenger_ai_jobs WHERE message_id='off-held'")).rows[0].status, 'review');
  assert.equal(result.reply.reply, 'Áo đang giảm còn 99.000đ nhé.', 'staff still see the AI draft');
});

test('a burst of messages waits for the customer to stop typing and gets one reply covering all of them', async () => {
  const f = await aiFixture(true);
  const seen = [];
  f.state.beforeReply = async (options) => { seen.push(JSON.stringify(options)); };
  await f.incoming('b1', { text: 'alpha-one' });
  const first = f.service.processMessengerAi('111', '222', undefined, pool, 150);
  await new Promise((resolve) => setTimeout(resolve, 30));
  await f.incoming('b2', { text: 'beta-two' });
  const second = f.service.processMessengerAi('111', '222', undefined, pool, 150);
  await Promise.all([first, second]);
  assert.equal(f.state.sends, 1);
  assert.equal(seen.length, 1);
  assert.match(seen[0], /alpha-one\\+nbeta-two/);
});

test('the quiet period is counted from the message timestamp, so an already-quiet customer is answered without waiting', async () => {
  const f = await aiFixture(true);
  await f.incoming('quiet', { timestamp: Date.now() - 5000 });
  const started = Date.now();
  await f.service.processMessengerAi('111', '222', undefined, pool, 5000);
  assert.ok(Date.now() - started < 2000);
  assert.equal(f.state.sends, 1);
});

test('a message arriving during the AI call is answered once, after its own quiet period, together with the earlier one', async () => {
  const f = await aiFixture(true);
  const seen = [];
  let injected = false;
  await f.incoming('d1', { text: 'alpha' });
  f.state.beforeReply = async (options) => {
    seen.push(JSON.stringify(options));
    if (!injected) { injected = true; await f.incoming('d2', { text: 'beta' }); }
  };
  await f.service.processMessengerAi('111', '222', undefined, pool, 300);
  assert.equal(f.state.sends, 0);
  await f.service.processMessengerAi('111', '222', undefined, pool, 300);
  assert.equal(f.state.sends, 1);
  assert.match(seen.at(-1), /alpha\\+nbeta/);
});

test('a newer message whose quiet period already passed is picked up by the running job, not left unanswered', async () => {
  const f = await aiFixture(true);
  let injected = false;
  await f.incoming('e1', { text: 'alpha', timestamp: Date.now() - 5000 });
  f.state.beforeReply = async () => {
    if (injected) return;
    injected = true;
    await f.incoming('e2', { text: 'beta', timestamp: Date.now() - 1000 });
    // Its wait is already over, but the running e1 job is still processing and blocks the send.
    await f.service.processMessengerAi('111', '222', undefined, pool, 300);
  };
  await f.service.processMessengerAi('111', '222', undefined, pool, 300);
  assert.equal(f.state.sends, 1);
});

test('past orders reach the AI as a summary without personal data, only for that customer', async () => {
  const f = await aiFixture(true);
  await query(`INSERT INTO messenger_orders(id,page_id,psid,items_json,total,status,is_mock,created_at,updated_at) VALUES
    ('o1','111','222','[{"name":"Áo thun trắng","qty":2}]',400000,'confirmed',true,1000,1000),
    ('o2','111','222','[{"name":"Quần đã hủy","qty":1}]',300000,'cancelled',true,2000,2000),
    ('o3','111','333','[{"name":"Giày của khách khác","qty":1}]',900000,'confirmed',true,3000,3000)`);
  const seen = [];
  f.state.beforeReply = async (options) => { seen.push(options.user); };
  await f.incoming('h1'); await f.process();
  assert.match(seen[0], /o1/);
  assert.match(seen[0], /Áo thun trắng x2/);
  assert.match(seen[0], /"confirmedOrders":1/);
  assert.doesNotMatch(seen[0], /Quần đã hủy|Giày của khách khác/);
  assert.doesNotMatch(seen[0], /0\d{9}/);
  await query('DELETE FROM messenger_orders');
  await f.incoming('h2', { timestamp: Date.now() + 5 }); await f.process();
  assert.doesNotMatch(seen.at(-1), /customerOrderHistory/);
});

test('phone numbers and emails are masked before text reaches the AI, and the debounce is shared and clamped', async () => {
  const { maskPersonalData } = loader()('lib/services/piiMask.ts');
  for (const phone of ['0901 234 567', '0901.234.567', '0901-234-567', '+84901234567', '84901234567', '0901234567']) {
    assert.equal(maskPersonalData(`gọi ${phone} nhé`), 'gọi [SĐT] nhé', phone);
  }
  assert.equal(maskPersonalData('mail lan.nguyen+shop@gmail.com ok'), 'mail [email] ok');
  assert.equal(maskPersonalData('áo 400000đ, size 38, 2 cái'), 'áo 400000đ, size 38, 2 cái');
  const f = await aiFixture(true);
  const seen = [];
  f.state.beforeReply = async (options) => { seen.push(options.user); };
  await f.incoming('p1', { text: 'SĐT mình 0901 234 567, mail a.b@c.vn' }); await f.process();
  assert.match(seen[0], /\[SĐT\]/);
  assert.doesNotMatch(seen[0], /0901|234 567|a\.b@c\.vn/);
  // Customer-written comments inside the conversation sources are masked too, the shop's own phone is not.
  const system = f.load('lib/services/customerCare.ts').buildCustomerCarePrompt(
    { ...f.knowledge, shop: { ...f.knowledge.shop, phone: '0281234567' } }, f.profile, null,
    { sources: [{ id: 'c1', commentText: '0901234567 chốt nha' }] });
  assert.doesNotMatch(system, /0901234567/);
  assert.match(system, /\[SĐT\] chốt nha/);
  assert.match(system, /0281234567/);
  const { messengerDebounceMs } = loader()('lib/services/messengerDebounce.ts');
  const old = process.env.MESSENGER_AI_DEBOUNCE_MS;
  try {
    delete process.env.MESSENGER_AI_DEBOUNCE_MS; assert.equal(messengerDebounceMs(), 5000);
    process.env.MESSENGER_AI_DEBOUNCE_MS = '99999'; assert.equal(messengerDebounceMs(), 15000);
    process.env.MESSENGER_AI_DEBOUNCE_MS = '0'; assert.equal(messengerDebounceMs(), 0);
    process.env.MESSENGER_AI_DEBOUNCE_MS = 'abc'; assert.equal(messengerDebounceMs(), 0);
  } finally { if (old === undefined) delete process.env.MESSENGER_AI_DEBOUNCE_MS; else process.env.MESSENGER_AI_DEBOUNCE_MS = old; }
});

test('a dead processing job stops blocking auto replies after two minutes, a live one still does', async () => {
  const f = await aiFixture(true);
  await f.incoming('stuck', { timestamp: Date.now() - 3000 });
  const stuck = (updatedAt) => query(`INSERT INTO messenger_ai_jobs(page_id,message_id,conversation_id,sent_at,status,updated_at)
    SELECT page_id,message_id,conversation_id,sent_at,'processing',$1 FROM messenger_messages WHERE message_id='stuck'
    ON CONFLICT(page_id,message_id) DO UPDATE SET status='processing',updated_at=$1`, [updatedAt]);
  await stuck(Date.now());
  await f.incoming('fresh', { timestamp: Date.now() - 1000 }); await f.process();
  assert.equal(f.state.sends, 0);
  await stuck(Date.now() - 200000);
  await f.process();
  assert.equal(f.state.sends, 1);
});

test('analysing an older message never creates a blocking review job, only the latest message can', async () => {
  const f = await aiFixture(true);
  await f.incoming('old1', { timestamp: Date.now() - 3000 });
  await f.incoming('new1', { timestamp: Date.now() - 1000 });
  const memory = f.load('lib/services/conversationMemory.ts');
  const result = { analysis: { canAutoReply: false }, reply: 'r', model: 'm', sourceSummary: 's' };
  await memory.saveConversationMemory('111', '222', 'old1', result, pool);
  assert.equal((await query("SELECT 1 FROM messenger_ai_jobs WHERE message_id='old1'")).rows.length, 0);
  await memory.saveConversationMemory('111', '222', 'new1', result, pool);
  assert.equal((await query("SELECT status FROM messenger_ai_jobs WHERE message_id='new1'")).rows[0].status, 'review');
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

test('missing evidence flag and unread attachments hand off with the template; AI errors still fail closed with persistent review', async () => {
  for (const mode of ['missing-flag', 'attachment', 'ai-error']) {
    const f = await aiFixture();
    if (mode === 'missing-flag') f.state.canAutoReply = undefined;
    if (mode === 'ai-error') f.state.failAi = true;
    // Not a photo: readable photos now go through the image path (see the photo tests below).
    await f.incoming(mode, mode === 'attachment' ? { attachments: [{ type: 'video', url: 'https://example.com/a.mp4' }] } : {});
    if (mode === 'ai-error') await assert.rejects(f.process(), /căn cứ/);
    else await f.process();
    assert.equal(f.state.sends, mode === 'ai-error' ? 0 : 1, mode);
    assert.equal((await query('SELECT status FROM messenger_ai_jobs')).rows[0].status, mode === 'ai-error' ? 'review' : 'sent', mode);
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

test('conversation auto reply defaults off, isolates customers and Pages, rejects stale edits and does not send old messages on enable', async () => {
  const f = await aiFixture();
  await f.writer.savePostgresMessages([m('default-off', { timestamp: Date.now() - 100 }), m('other-customer', { psid: '333' })], pool);
  await f.process();
  assert.equal(f.state.sends, 0);
  const snapshot = await f.load('lib/services/messengerInboxDb.ts').readMessengerInbox('111', 100, pool);
  assert.ok(snapshot.conversations.every(thread => thread.autoReply === false));
  assert.equal(snapshot.aiEnabled, true);
  const enabled = await f.service.saveConversationAutoReply('111', '222', true, 0, pool);
  await assert.rejects(f.service.saveConversationAutoReply('111', '222', false, 0, pool), error => error.status === 409);
  await assert.rejects(f.service.saveConversationAutoReply('999', '222', true, 0, pool), error => error.status === 409);
  await f.process(); assert.equal(f.state.sends, 0, 'enabling never sends the previous message');
  await f.writer.savePostgresMessages([m('new-after-enable', { timestamp: Date.now() + 1 })], pool); await f.process();
  assert.equal(f.state.sends, 1);
  assert.equal((await query("SELECT ai_auto_reply FROM messenger_conversations WHERE id='[\"111\",\"333\"]'")).rows[0].ai_auto_reply, false);
  const view = f.load('lib/services/messengerView.ts').mergeMessengerThread({ ...snapshot.conversations.find(t => t.psid === '222'), aiUpdatedAt: 0, autoReply: false },
    { ...f.load('lib/services/messengerView.ts').mergeMessengerThread(snapshot.conversations[0]), aiUpdatedAt: enabled.updatedAt, autoReply: true });
  assert.equal(view.autoReply, true, 'an older poll cannot undo an acknowledged switch');
});

test('global off overrides opted-in threads and re-enabling preserves opted-out threads without replay', async () => {
  const f = await aiFixture();
  const approvedAt = (await f.service.readMessengerAiSettings('111', pool)).approvedAt;
  await f.incoming('first');
  await f.incoming('other-off', { psid: '333' });
  const other = (await query("SELECT ai_updated_at FROM messenger_conversations WHERE id='[\"111\",\"333\"]'")).rows[0];
  await f.service.saveConversationAutoReply('111', '333', false, Number(other.ai_updated_at), pool);
  await f.service.saveMessengerAiSettings('111', false, undefined, pool);
  await f.incoming('during-off'); await f.process(); assert.equal(f.state.sends, 0);
  await f.service.saveMessengerAiSettings('111', true, undefined, pool);
  assert.equal((await f.service.readMessengerAiSettings('111', pool)).approvedAt, approvedAt, 'toggling does not falsely record a new policy approval');
  await f.process(); assert.equal(f.state.sends, 0);
  const rows = (await query('SELECT id,ai_auto_reply FROM messenger_conversations ORDER BY id')).rows;
  assert.equal(rows.find(row => row.id === '["111","222"]').ai_auto_reply, true);
  assert.equal(rows.find(row => row.id === '["111","333"]').ai_auto_reply, false);
  await f.incoming('after-global-enable', { timestamp: Date.now() + 1 }); await f.process(); assert.equal(f.state.sends, 1);
});

test('turning a conversation off or off/on during generation blocks that job; final transport gate also rechecks the switch', async () => {
  for (const mode of ['off', 'off-on', 'transport']) {
    const f = await aiFixture(); await f.incoming('racing-switch');
    const flip = async () => {
      const off = await f.service.saveConversationAutoReply('111', '222', false, 1, pool);
      if (mode === 'off-on') await f.service.saveConversationAutoReply('111', '222', true, off.updatedAt, pool);
    };
    if (mode === 'transport') f.state.beforeTransport = flip; else f.state.beforeReply = flip;
    await f.process(); assert.equal(f.state.sends, 0, mode);
    assert.notEqual((await query('SELECT status FROM messenger_ai_jobs')).rows[0].status, 'unknown');
    if (mode === 'transport') assert.equal((await query('SELECT status FROM messenger_outbound_requests')).rows[0].status, 'failed');
  }
});

test('urgent requests are never answered by the model even if it marks them safe to send; the handoff template goes out', async () => {
  const f = await aiFixture(); f.state.priority = 'high';
  await f.incoming('urgent'); await f.process();
  assert.equal(f.state.sends, 1);
  assert.deepEqual((await query("SELECT text FROM messenger_outbound_requests WHERE status='sent'")).rows.map(row => row.text), [f.load('lib/services/handoff.ts').UNKNOWN_REPLY]);
  assert.equal((await query('SELECT status FROM messenger_ai_jobs')).rows[0].status, 'sent');
});

test('confirmed server rules and Page voice reach every generation; a configuration change during generation blocks the old output', async () => {
  const f = await aiFixture();
  const care = f.load('lib/services/customerCare.ts');
  const page = { name: 'Nhà Linh', address: 'Nhà Linh – chị', tone: 'Điềm đạm', examples: 'Chị cho Nhà Linh xin mã sản phẩm nhé.' };
  await query('INSERT INTO marketing_workspaces(page_id,document,updated_at) VALUES($1,$2,1)', ['111', JSON.stringify({ profiles: { 111: page } })]);
  const current = await f.service.readMessengerAiSettings('111', pool);
  const input = { profile: f.profile, knowledge: f.knowledge, pageProfile: page, pageAssigned: true, pageEnabled: true, confirmed: true, updatedAt: current.updatedAt };
  await care.saveCustomerCareSettings('111', input, 'owner', pool);
  await query('UPDATE messenger_ai_settings SET enabled_at=$1', [Date.now() - 10000]);
  let system;
  f.state.beforeReply = async options => { system = options.system; };
  await f.incoming('server-rules'); await f.process();
  assert.ok(system.includes(page.address)); assert.ok(system.includes(page.tone)); assert.ok(system.includes(page.examples));
  const rules = care.careRules({ ...f.profile, platformRules: { facebook: { enabled: true, values: { address: 'em – anh/chị' } } } }, page);
  assert.equal(rules.address, 'em – anh/chị'); assert.equal(rules.tone, page.tone);
  await f.incoming('old-config', { timestamp: Date.now() + 1 });
  f.state.beforeReply = async () => {
    const settings = await f.service.readMessengerAiSettings('111', pool);
    await care.saveCustomerCareSettings('111', { ...input, updatedAt: settings.updatedAt,
      knowledge: { ...f.knowledge, faqs: [{ ...f.knowledge.faqs[0], answer: '9 giờ' }] } }, 'owner', pool);
  };
  await f.process(); assert.equal(f.state.sends, 1, 'old configuration output must not send');
  await assert.rejects(care.saveCustomerCareSettings('111', input, 'owner', pool), error => error.status === 409);
});

test('Customer Care API previews without persisting or sending, requires confirmation, and uses only approved server knowledge for Inbox suggestions', async () => {
  const f = await aiFixture(false);
  const route = f.load('app/api/customer-care/route.ts');
  const req = (method, body) => new Request('http://localhost/api/customer-care', { method, headers: { origin: 'http://localhost' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const initial = await route.GET(req('GET'));
  assert.equal(initial.status, 200); assert.equal(initial.headers.get('Cache-Control'), 'no-store');
  const settings = await initial.json();
  const input = { profile: f.profile, knowledge: f.knowledge, pageAssigned: true, pageEnabled: true, confirmed: false,
    updatedAt: settings.updatedAt, pageProfile: settings.currentPageProfile };
  assert.equal((await route.PUT(req('PUT', input))).status, 400);
  assert.equal((await route.PUT(req('PUT', { ...input, confirmed: true, pageProfile: { ...settings.currentPageProfile, name: 'wrong' } }))).status, 409);
  const preview = await route.POST(req('POST', { action: 'preview', profile: f.profile, knowledge: f.knowledge, message: 'Giờ mở cửa?' }));
  assert.equal(preview.status, 200); assert.equal(f.state.sends, 0);
  assert.equal((await query('SELECT * FROM messenger_ai_jobs')).rows.length, 0);
  const applied = await route.PUT(req('PUT', { ...input, confirmed: true }));
  assert.equal(applied.status, 200); assert.equal((await applied.json()).approvedBy, 'test-owner');
  assert.equal((await route.PUT(req('PUT', { ...input, confirmed: true }))).status, 409);
  await f.incoming('manual-server');
  f.state.beforeReply = async options => { assert.ok(options.system.includes('8 giờ')); assert.ok(!options.system.includes('UnapprovedPolicy')); };
  const suggestion = await route.POST(req('POST', { action: 'suggest', psid: '222', messageId: 'manual-server', knowledge: { UnapprovedPolicy: true } }));
  assert.equal(suggestion.status, 200); assert.equal(f.state.sends, 0);
  assert.equal((await query('SELECT * FROM messenger_analysis_history')).rows.length, 1);
  assert.equal((await route.POST(req('POST', { action: 'suggest', psid: '333', messageId: 'manual-server' }))).status, 409);
});

// Shop label set for Page 111, stored the way catalog sync stores it, keeping the approved AI knowledge unchanged.
const setTagRules = (rules) => query(`INSERT INTO shop_catalog(page_id,catalog_json,knowledge_json,updated_at)
  VALUES('111',$1::json,(SELECT knowledge_json FROM messenger_ai_settings WHERE page_id='111'),1)
  ON CONFLICT(page_id) DO UPDATE SET catalog_json=EXCLUDED.catalog_json`, [JSON.stringify({ contextTagRules: rules })]);
const tagRule = (id, label) => ({ id, label, keywords: [], type: 'neutral', enabled: true });
const labelRequest = (route, body) => route.POST(new Request('http://localhost/api/messenger/conversation', { method: 'POST',
  headers: { origin: 'http://localhost', Authorization: `Bearer ${process.env.INBOX_ACCESS_KEY}` }, body: JSON.stringify({ action: 'labels', ...body }) }));

test('staff labels: changes are applied on the server against the shop set, no cap, unknown new label asks to retry, per Page', async () => {
  const f = await aiFixture(false);
  const route = f.load('app/api/messenger/conversation/route.ts');
  await f.incoming('label-1');
  await setTagRules([tagRule('buy', 'Muốn đặt hàng'), tagRule('delivery', 'Hỏi giao hàng'), ...Array.from({ length: 10 }, (_, i) => tagRule(`r${i}`, `Nhãn ${i}`))]);
  const change = async (type, id, psid = '222') => labelRequest(route, { psid, change: { type, id } });
  const labels = async (type, id) => (await (await change(type, id)).json()).staffLabels;
  let response = await change('add', 'buy');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { staffLabels: { added: ['buy'], hidden: [] } });
  assert.deepEqual(await labels('hideRule', 'delivery'), { added: ['buy'], hidden: ['delivery'] });
  assert.deepEqual(await labels('hideRule', 'gone'), { added: ['buy'], hidden: ['delivery'] }, 'unknown id is ignored');
  assert.deepEqual(await labels('removeStaff', 'buy'), { added: [], hidden: ['delivery', 'buy'] }, 'removing a staff label also hides it, so a matching keyword does not bring it back');
  assert.deepEqual(await labels('add', 'buy'), { added: ['buy'], hidden: ['delivery'] }, 'adding again clears the hidden mark');
  response = await change('add', 'khong-co');
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /chưa đồng bộ/);
  for (let i = 0; i < 10; i++) assert.equal((await change('add', `r${i}`)).status, 200, 'no cap on applied labels: all 12 of the shop set fit');
  assert.equal((await labels('add', 'delivery')).added.length, 12);
  assert.equal((await change('add', 'buy')).status, 200, 'adding a label that is already there is a no-op');
  for (const bad of [{ type: 'drop', id: 'buy' }, { type: 'add' }, { type: 'add', id: 5 }, 'add', undefined]) assert.equal((await labelRequest(route, { psid: '222', change: bad })).status, 400);
  assert.equal((await labelRequest(route, { psid: '222', added: ['buy'], hidden: [] })).status, 400, 'the old whole-state body is refused');
  // A rule deleted elsewhere never blocks or undoes another change: it is dropped on the server, and a stale tab only sends the one change it made.
  await setTagRules([tagRule('buy', 'Muốn đặt hàng'), tagRule('delivery', 'Hỏi giao hàng'), ...Array.from({ length: 8 }, (_, i) => tagRule(`r${i}`, `Nhãn ${i}`))]); // r8, r9 deleted
  const kept = await labels('hideRule', 'returns');
  assert.ok(!kept.added.includes('r8') && !kept.added.includes('r9') && kept.added.includes('delivery') && kept.added.includes('r0'), 'other devices\' labels survive, deleted ones are dropped');
  await f.writer.savePostgresMessages([m('label-other', { psid: '333', timestamp: Date.now() - 10 })], pool);
  const snapshot = await f.load('lib/services/messengerInboxDb.ts').readMessengerInbox('111', 100, pool);
  assert.deepEqual(snapshot.conversations.find(thread => thread.psid === '222').staffLabels, kept);
  assert.deepEqual(snapshot.conversations.find(thread => thread.psid === '333').staffLabels, { added: [], hidden: [] });
  const { mergeMessengerThread } = f.load('lib/services/messengerView.ts');
  const thread = snapshot.conversations.find(item => item.psid === '222');
  const stale = { ...mergeMessengerThread(thread), staffLabels: { added: ['delivery'], hidden: [] } };
  assert.deepEqual(mergeMessengerThread(thread, stale).staffLabels, kept, 'server labels win over the previous view');
  assert.deepEqual(mergeMessengerThread({ ...thread, staffLabels: undefined }, stale).staffLabels, stale.staffLabels, 'a thread without the field keeps the previous labels');
  assert.equal((await change('add', 'buy', '444')).status, 404, 'no such conversation on this Page');
  await query('UPDATE messenger_conversations SET hidden_at=1');
  assert.equal((await change('add', 'buy')).status, 404, 'hidden conversation');
});

test('a reply that names a staff label is never auto-sent; the handoff template goes out instead', async () => {
  const f = await aiFixture(true);
  await f.service.saveMessengerAiSettings('111', true, f.knowledge, pool);
  await query('UPDATE messenger_ai_settings SET enabled_at=$1', [Date.now() - 1000]);
  const conversation = f.load('app/api/messenger/conversation/route.ts');
  await f.incoming('label-ok');
  await setTagRules([tagRule('bom', 'Khách bom hàng')]);
  assert.equal((await labelRequest(conversation, { psid: '222', change: { type: 'add', id: 'bom' } })).status, 200);
  f.state.replyText = 'Shop mở cửa lúc 8 giờ.';
  await f.process();
  assert.equal(f.state.sends, 1, 'a reply that does not name the label still sends');
  f.state.replyText = 'Dạ vì bạn là khach bom hang nên shop xin phép từ chối.';
  await f.incoming('label-leak', { timestamp: Date.now() + 5 }); await f.process();
  assert.equal(f.state.sends, 2, 'the reply naming the label is not sent; the fixed template is');
  assert.deepEqual((await query("SELECT text FROM messenger_outbound_requests WHERE status='sent' ORDER BY created_at")).rows.map(row => row.text), ['Shop mở cửa lúc 8 giờ.', f.load('lib/services/handoff.ts').UNKNOWN_REPLY]);
  assert.equal((await query("SELECT status FROM messenger_ai_jobs WHERE message_id='label-leak'")).rows[0].status, 'sent');
});

test('AI reads staff labels by name (masked) and picks up to 3 labels from the shop set, on the webhook run and the re-analyse button', async () => {
  const f = await aiFixture(false);
  const conversation = f.load('app/api/messenger/conversation/route.ts'), care = f.load('app/api/customer-care/route.ts');
  const suggest = () => care.POST(new Request('http://localhost/api/customer-care', { method: 'POST', headers: { origin: 'http://localhost' },
    body: JSON.stringify({ action: 'suggest', psid: '222', messageId: 'ai-label-1' }) }));
  await f.incoming('ai-label-1');
  await setTagRules([{ ...tagRule('call', 'Gọi lại 0912345678'), type: 'risk', context: 'Gọi 0912345678 sau 5 giờ chiều' },
    { ...tagRule('si', 'Khách sỉ'), context: 'Khách mua sỉ từ 10 cái, ưu tiên báo giá sỉ.' }, tagRule('buy', 'Muốn đặt hàng')]);
  for (const id of ['si', 'call']) assert.equal((await labelRequest(conversation, { psid: '222', change: { type: 'add', id } })).status, 200);
  const seen = [];
  f.state.beforeReply = async (options) => { seen.push(options); };
  f.state.labels = ['buy', 'khong-co', 'buy'];
  await f.process();
  const applied = '"staffLabels":[{"label":"Khách sỉ","context":"Khách mua sỉ từ 10 cái, ưu tiên báo giá sỉ."},{"label":"Gọi lại [SĐT]","context":"Gọi [SĐT] sau 5 giờ chiều"}]';
  assert.ok(seen[0].user.includes(applied), 'each applied label reaches the AI with its context, in the order applied, masked');
  assert.ok(seen[0].user.includes('"labelOptions":[{"id":"call","label":"Gọi lại [SĐT]","context":"Gọi [SĐT] sau 5 giờ chiều"},{"id":"si","label":"Khách sỉ","context":"Khách mua sỉ từ 10 cái, ưu tiên báo giá sỉ."},{"id":"buy","label":"Muốn đặt hàng"}]'), 'options carry the context too, none when empty');
  assert.doesNotMatch(seen[0].user, /0912345678/);
  assert.ok(seen[0].system.includes('staffLabels là các nhãn nhân viên đã dán') && seen[0].system.includes('Đọc context để hiểu khách đang ở tình huống nào'));
  assert.ok(seen[0].system.includes('labelOptions là bộ nhãn của shop'));
  assert.deepEqual((await query('SELECT analysis FROM messenger_analysis_history')).rows[0].analysis.labels, ['buy'], 'unknown ids dropped, deduplicated');
  assert.equal((await suggest()).status, 200);
  assert.ok(seen.at(-1).user.includes(applied), 're-analyse button passes labels too');
  await setTagRules([{ ...tagRule('call', 'Gọi lại 0912345678'), type: 'risk' }]);
  await suggest();
  assert.ok(seen.at(-1).user.includes('"staffLabels":[{"label":"Gọi lại [SĐT]"}]'), 'a label deleted from the set is no longer sent; a label without context sends its name only');
  await setTagRules([]);
  f.state.labels = undefined;
  await suggest();
  assert.doesNotMatch(seen.at(-1).user, /staffLabels|labelOptions/);
  assert.equal((await query('SELECT analysis FROM messenger_analysis_history')).rows[0].analysis.labels, undefined);
  const { parseAiAnalysis } = f.load('lib/services/aiAnalysis.ts');
  assert.deepEqual(parseAiAnalysis({ sentiment: 'neutral', emotion: 'neutral', priority: 'normal', needsHuman: false, reason: 'x',
    labels: ['a', 'b', 'a', 'c', 'd', ''] }).labels, ['a', 'b', 'c']);
});

// --- Photos the customer sends (design: 2026-11-17-ai-chat-image-understanding) ---
const photo = { type: 'image', url: 'https://scontent.xx.fbcdn.net/v/p.jpg' };
const enableAutoReply = async (f) => {
  await f.service.saveMessengerAiSettings('111', true, f.knowledge, pool);
  await query('UPDATE messenger_ai_settings SET enabled_at=$1', [Date.now() - 1000]);
};
const sentTexts = async () => (await query("SELECT text FROM messenger_outbound_requests WHERE status='sent' ORDER BY created_at")).rows.map(row => row.text);
const jobStatus = async (id) => (await query('SELECT status FROM messenger_ai_jobs WHERE message_id=$1', [id])).rows[0]?.status;
const savedAnalysis = async (id) => (await query('SELECT analysis FROM messenger_analysis_history WHERE message_id=$1', [id])).rows[0]?.analysis;

test('a product photo is answered like text and may be sent automatically', async () => {
  const f = await aiFixture(true); await enableAutoReply(f);
  const seen = [];
  f.state.beforeReply = async (options) => { seen.push(options); };
  f.state.imageKinds = ['product'];
  f.state.replyText = 'Mình có Áo thun basic AT-01 ạ, bạn muốn xem size nào?';
  await f.incoming('photo-product', { text: '', attachments: [photo] }); await f.process();
  assert.equal(f.state.sends, 1);
  assert.deepEqual(await sentTexts(), [f.state.replyText]);
  assert.equal(seen[0].images.length, 1);
  assert.deepEqual(seen[0].images[0], { mimeType: 'image/jpeg', data: 'QUJD' });
  assert.ok(seen[0].system.includes('Khách có gửi ảnh') && seen[0].system.includes('analysis.imageKinds'));
  assert.match(seen[0].user, /"imageCount":1/);
  const analysis = await savedAnalysis('photo-product');
  assert.deepEqual(analysis.imageKinds, ['product']);
  assert.equal(analysis.imageOutcome, undefined);
  assert.equal(await jobStatus('photo-product'), 'sent');
});

test('a product-photo reply that repeats a long number read from the image is never sent; the handoff template goes out', async () => {
  const f = await aiFixture(true); await enableAutoReply(f);
  f.state.imageKinds = ['product'];
  f.state.replyText = 'Số tài khoản trên ảnh là 0123456789, đúng không ạ?';
  await f.incoming('photo-number', { text: '', attachments: [photo] }); await f.process();
  assert.deepEqual(await sentTexts(), [f.load('lib/services/handoff.ts').UNKNOWN_REPLY]);
  assert.equal(await jobStatus('photo-number'), 'sent');
  assert.match((await savedAnalysis('photo-number')).reason, /dãy số/);
  // The same words typed by the customer themselves (a text message with no photo) keep the old rules.
  const text = await aiFixture(true); await enableAutoReply(text);
  text.state.replyText = 'Mình đã nhận số 0123456789 bạn gửi ạ.';
  await text.incoming('typed-number', { text: 'Số của mình là 0123456789' }); await text.process();
  assert.equal(text.state.sends, 1);
});

test('defect, receipt and other_support photos send the handoff template', async () => {
  const { HANDOFF_REPLY } = loader()('lib/services/imageIntake.ts');
  for (const kind of ['defect', 'receipt', 'other_support']) {
    const f = await aiFixture(true); await enableAutoReply(f);
    f.state.imageKinds = [kind];
    f.state.replyText = 'Câu do model viết: shop hoàn tiền 100% ngay.';
    await f.incoming(`photo-${kind}`, { text: '', attachments: [photo] }); await f.process();
    assert.deepEqual(await sentTexts(), [HANDOFF_REPLY], kind);
    const analysis = await savedAnalysis(`photo-${kind}`);
    assert.deepEqual([analysis.imageOutcome, analysis.needsHuman, analysis.priority], ['handoff', true, 'high'], kind);
    assert.equal(await jobStatus(`photo-${kind}`), 'sent', kind);
  }
});

test('an unrelated photo alone gets the one-line decline; with a text question it is answered normally', async () => {
  const { DECLINE_REPLY } = loader()('lib/services/imageIntake.ts');
  const alone = await aiFixture(true); await enableAutoReply(alone);
  alone.state.imageKinds = ['unrelated'];
  await alone.incoming('photo-meme', { text: '', attachments: [photo] }); await alone.process();
  assert.deepEqual(await sentTexts(), [DECLINE_REPLY]);
  assert.equal((await savedAnalysis('photo-meme')).imageOutcome, 'decline');
  const withText = await aiFixture(true); await enableAutoReply(withText);
  withText.state.imageKinds = ['unrelated'];
  await withText.incoming('photo-text', { text: 'Shop mở cửa mấy giờ?', attachments: [photo] }); await withText.process();
  assert.deepEqual(await sentTexts(), ['Shop mở cửa lúc 8 giờ.']);
});

test('an unreadable photo (foreign host, download error, more than 3) hands off without calling Gemini', async () => {
  const { HANDOFF_REPLY } = loader()('lib/services/imageIntake.ts');
  const cases = { 'foreign host': [{ type: 'image', url: 'https://evilfbcdn.net/p.jpg' }], 'download error': [photo], 'four photos': [photo, photo, photo, photo] };
  for (const [name, attachments] of Object.entries(cases)) {
    const f = await aiFixture(true); await enableAutoReply(f);
    if (name === 'download error') f.state.imageTransport = async () => { throw new Error('network'); };
    f.state.imageKinds = ['product'];
    await f.incoming('photo-bad', { text: '', attachments }); await f.process();
    assert.equal(f.state.geminiCalls, 0, name);
    assert.deepEqual(await sentTexts(), [HANDOFF_REPLY], name);
    assert.equal((await savedAnalysis('photo-bad')).imageOutcome, 'handoff', name);
  }
});

test('wrong imageKinds from the model fail closed to the handoff template', async () => {
  const { HANDOFF_REPLY } = loader()('lib/services/imageIntake.ts');
  for (const kinds of [[], ['product', 'product'], undefined]) {
    const f = await aiFixture(true); await enableAutoReply(f);
    f.state.imageKinds = kinds;
    await f.incoming('photo-kinds', { text: '', attachments: [photo] }); await f.process();
    assert.deepEqual(await sentTexts(), [HANDOFF_REPLY], JSON.stringify(kinds));
  }
});

test('stickers, video and mixed attachments hand off with the template', async () => {
  const cases = { sticker: [{ ...photo, sticker: true }], video: [{ type: 'video', url: 'https://example.com/a.mp4' }], mixed: [photo, { type: 'video', url: 'https://example.com/a.mp4' }] };
  for (const [name, attachments] of Object.entries(cases)) {
    const f = await aiFixture(true); await enableAutoReply(f);
    f.state.imageKinds = ['product'];
    await f.incoming(`att-${name}`, { text: '', attachments }); await f.process();
    assert.deepEqual(await sentTexts(), [f.load('lib/services/handoff.ts').UNKNOWN_REPLY], name);
    assert.equal(await jobStatus(`att-${name}`), 'sent', name);
    assert.equal(f.state.geminiCalls, 1, `${name}: still analysed as text`);
  }
});

test('the re-analyse button reads photos too and never sends', async () => {
  const f = await aiFixture(true);
  const care = f.load('app/api/customer-care/route.ts');
  const seen = [];
  f.state.beforeReply = async (options) => { seen.push(options); };
  f.state.imageKinds = ['receipt'];
  await f.incoming('photo-suggest', { text: '', attachments: [photo] });
  const response = await care.POST(new Request('http://localhost/api/customer-care', { method: 'POST', headers: { origin: 'http://localhost' },
    body: JSON.stringify({ action: 'suggest', psid: '222', messageId: 'photo-suggest' }) }));
  assert.equal(response.status, 200);
  assert.equal(seen[0].images.length, 1);
  assert.equal(f.state.sends, 0);
  assert.equal((await response.json()).reply.analysis.imageOutcome, 'handoff');
});

test('prompt rewording: readable photos are not "unverified files" that must always go to staff', async () => {
  const f = await aiFixture(false);
  const { EMOTION_RESPONSE_PROMPT } = f.load('lib/services/aiAnalysis.ts');
  const care = f.load('lib/services/customerCare.ts');
  const text = care.buildCustomerCarePrompt(f.knowledge, f.profile, null, undefined, false);
  const images = care.buildCustomerCarePrompt(f.knowledge, f.profile, null, undefined, true);
  assert.ok(!EMOTION_RESPONSE_PROMPT.includes('chỉ có tệp đính kèm hoặc'));
  assert.ok(!images.includes('Tệp chưa được xác minh phải để nhân viên kiểm tra'));
  assert.ok(images.includes('Tệp không phải ảnh khách gửi thì để nhân viên kiểm tra'));
  assert.ok(images.includes('analysis.imageKinds') && !text.includes('analysis.imageKinds'), 'the image block only appears when photos are present');
  assert.ok(care.buildCustomerCarePrompt(f.knowledge, f.profile, null, undefined, false, true).includes('khung chat CÓ gửi được ảnh'), 'with shopPhotos the model is told it can send photos and must not claim otherwise');
  assert.ok(!text.includes('khung chat CÓ gửi được ảnh'), 'no photo rule when no shop photos are offered');
});

// --- A photo that needs staff keeps the conversation in the unanswered queue until someone else replies ---
const handoffThread = async (f) => (await f.load('lib/services/messengerInboxDb.ts').readMessengerInbox('111', 100, pool)).conversations.find(thread => thread.psid === '222');

test('handoff keeps the conversation in the unanswered queue after the template is sent, and any other outbound message closes it', async () => {
  const f = await aiFixture(true); await enableAutoReply(f);
  const { HANDOFF_REPLY } = loader()('lib/services/imageIntake.ts');
  const view = f.load('lib/services/messengerView.ts'), count = f.load('lib/services/messengerCount.ts');
  f.state.imageKinds = ['receipt'];
  await f.incoming('ho-1', { text: '', attachments: [photo] }); await f.process();
  assert.deepEqual(await sentTexts(), [HANDOFF_REPLY]);
  const notice = (await query("SELECT request_id,message_id FROM messenger_outbound_requests WHERE status='sent'")).rows[0];
  const row = (await query('SELECT handoff_message_id,handoff_request_id,last_out_at FROM messenger_conversations')).rows[0];
  assert.deepEqual([row.handoff_message_id, row.handoff_request_id], ['ho-1', notice.request_id], 'the request id is stored before sending, so the notice\'s own echo cannot close the handoff');
  assert.ok(row.last_out_at, 'the notice counts as an outbound message');
  let thread = await handoffThread(f);
  assert.deepEqual([thread.handoff, thread.waitingConfirmation], [true, true]);
  assert.equal(await count.readUnrepliedCount('111', pool), 1);
  const conversation = view.mergeMessengerThread(thread);
  assert.deepEqual([conversation.isUnreplied, conversation.waitingConfirmation, conversation.isUrgent], [true, true, true]);
  assert.equal(conversation.aiSuggestion, undefined, 'the template was already sent, so it is not offered again');
  // The echo of the notice itself (same message id) does not close it.
  await f.writer.savePostgresMessages([m(notice.message_id, { direction: 'out', timestamp: Date.now() + 5, text: HANDOFF_REPLY })], pool);
  assert.equal((await handoffThread(f)).handoff, true);
  assert.equal(await count.readUnrepliedCount('111', pool), 1);
  // Any other outbound message (from Tendly or from the Page inbox, which arrives as an echo) closes it.
  await f.writer.savePostgresMessages([m('staff-reply', { direction: 'out', timestamp: Date.now() + 1000, text: 'Shop xử lý giúp bạn ạ.' })], pool);
  thread = await handoffThread(f);
  assert.deepEqual([thread.handoff, thread.waitingConfirmation], [false, false]);
  assert.equal(await count.readUnrepliedCount('111', pool), 0);
  assert.equal(view.mergeMessengerThread(thread).isUnreplied, false);
});

test('the notice never closes its own handoff, even when Meta\'s answer was not recorded on the request (timeout, no message_id, failed save)', async () => {
  const f = await aiFixture(true); await enableAutoReply(f);
  const { HANDOFF_REPLY } = loader()('lib/services/imageIntake.ts');
  const count = f.load('lib/services/messengerCount.ts');
  f.state.imageKinds = ['defect'];
  await f.incoming('ho-lost', { text: '', attachments: [photo] }); await f.process();
  assert.deepEqual(await sentTexts(), [HANDOFF_REPLY]);
  await query('UPDATE messenger_outbound_requests SET message_id=NULL');
  assert.equal((await handoffThread(f)).handoff, true, 'the notice (and its echo) is recognised by its fixed text');
  assert.equal(await count.readUnrepliedCount('111', pool), 1);
  await f.writer.savePostgresMessages([m('staff-late', { direction: 'out', timestamp: Date.now() + 1000, text: 'Shop đã nhận ảnh và đang xử lý ạ.' })], pool);
  assert.equal((await handoffThread(f)).handoff, false, 'a real reply still closes it');
  assert.equal(await count.readUnrepliedCount('111', pool), 0);
});

test('while a handoff is open, AI does not auto-send for later customer messages; after staff replies it sends again', async () => {
  const f = await aiFixture(true); await enableAutoReply(f);
  f.state.imageKinds = ['defect'];
  await f.incoming('ho-a', { text: '', attachments: [photo] }); await f.process();
  assert.equal(f.state.sends, 1);
  f.state.imageKinds = undefined; f.state.replyText = 'Dạ shop cảm ơn bạn ạ.';
  await f.incoming('ho-b', { timestamp: Date.now() + 50 }); await f.process();
  assert.equal(f.state.sends, 1, 'held while the handoff is open');
  assert.equal(await jobStatus('ho-b'), 'review');
  await f.incoming('ho-c', { text: '', attachments: [photo], timestamp: Date.now() + 60 });
  f.state.imageKinds = ['receipt']; await f.process();
  assert.equal(f.state.sends, 1, 'a second photo does not send a second notice');
  assert.equal(await jobStatus('ho-c'), 'review');
  await f.writer.savePostgresMessages([m('staff-reply-2', { direction: 'out', timestamp: Date.now() + 1000, text: 'Shop đã xử lý ạ.' })], pool);
  f.state.imageKinds = undefined;
  await f.incoming('ho-d', { timestamp: Date.now() + 2000 }); await f.process();
  assert.equal(f.state.sends, 2, 'automatic replies resume once staff has answered');
});

test('an open handoff never lets a model-written reply go out for the same photo, even if a re-run classifies it differently', async () => {
  const f = await aiFixture(true); await enableAutoReply(f);
  // The conversation switch is off when the photo arrives: the handoff is marked, the job stays "ready", nothing is sent.
  f.state.imageKinds = ['receipt'];
  await f.incoming('ho-race', { text: '', attachments: [photo] });
  await query('UPDATE messenger_conversations SET ai_auto_reply=false');
  await f.process();
  assert.equal(f.state.sends, 0);
  assert.equal((await query('SELECT handoff_message_id FROM messenger_conversations')).rows[0].handoff_message_id, 'ho-race');
  assert.equal(await jobStatus('ho-race'), 'ready');
  // The shop turns the switch on and the same message is analysed again; this time the model calls the photo a product.
  await query('UPDATE messenger_conversations SET ai_auto_reply=true');
  f.state.imageKinds = ['product']; f.state.replyText = 'Mình có Áo thun basic AT-01 ạ.';
  await f.process();
  assert.equal(f.state.sends, 0, 'only the fixed template may leave while the handoff is open');
  assert.equal(await jobStatus('ho-race'), 'review');
});

test('with the conversation switch off no template is sent, but the handoff flag is still set and the template is only a suggestion', async () => {
  const f = await aiFixture(true); await enableAutoReply(f);
  const { HANDOFF_REPLY } = loader()('lib/services/imageIntake.ts');
  f.state.imageKinds = ['receipt'];
  await f.incoming('ho-off', { text: '', attachments: [photo] });
  await query('UPDATE messenger_conversations SET ai_auto_reply=false');
  await f.process();
  assert.equal(f.state.sends, 0);
  const thread = await handoffThread(f);
  assert.equal(thread.handoff, true);
  const conversation = f.load('lib/services/messengerView.ts').mergeMessengerThread(thread);
  assert.equal(conversation.isUnreplied, true);
  assert.equal(conversation.aiSuggestion.text, HANDOFF_REPLY);
});

test('a product photo never sets the handoff flag, and the re-analyse button marks a handoff without sending', async () => {
  const product = await aiFixture(true); await enableAutoReply(product);
  product.state.imageKinds = ['product'];
  await product.incoming('ho-product', { text: '', attachments: [photo] }); await product.process();
  assert.equal((await query('SELECT handoff_message_id FROM messenger_conversations')).rows[0].handoff_message_id, null);
  assert.equal((await handoffThread(product)).handoff, false);
  const f = await aiFixture(true);
  const care = f.load('app/api/customer-care/route.ts');
  f.state.imageKinds = ['defect'];
  await f.incoming('ho-suggest', { text: '', attachments: [photo] });
  const response = await care.POST(new Request('http://localhost/api/customer-care', { method: 'POST', headers: { origin: 'http://localhost' },
    body: JSON.stringify({ action: 'suggest', psid: '222', messageId: 'ho-suggest' }) }));
  assert.equal(response.status, 200);
  assert.equal(f.state.sends, 0);
  assert.equal((await query('SELECT handoff_message_id FROM messenger_conversations')).rows[0].handoff_message_id, 'ho-suggest');
  assert.equal((await handoffThread(f)).handoff, true);
});

async function sourceFixture() {
  const f = await aiFixture();
  const product = { id: 'p1', sku: 'AT01', name: 'Áo thun', category: 'Áo', material: 'Cotton', colors: ['Đen'], sizes: ['L'], qty: 4, price: 250000 };
  f.knowledge.products = [product];
  const settings = await f.service.readMessengerAiSettings('111', pool);
  await f.load('lib/services/customerCare.ts').saveCustomerCareSettings('111', { profile: f.profile, knowledge: f.knowledge,
    confirmed: true, pageAssigned: true, pageEnabled: true, updatedAt: settings.updatedAt, pageProfile: settings.pageProfile }, 'owner', pool);
  await query('UPDATE messenger_ai_settings SET enabled_at=$1', [Date.now() - 10000]);
  const api = f.load('lib/services/marketingBrief.ts');
  const campaign = { ...api.emptyCampaignBrief('111'), id: 'campaign-1', name: 'Áo mùa hè', productIds: ['p1'], message: 'Áo thun mùa hè',
    version: 1, approvedAt: Date.now(), approvedBy: 'owner', knowledge: f.knowledge,
    profile: api.emptyMarketingProfile(), configuration: f.load('lib/services/aiConfiguration.ts').defaultAiConfiguration(),
    offer: { kind: 'discount', details: 'Giảm 10%', conditions: 'Chỉ áp dụng AT01, tối đa 1 sản phẩm', confirmed: true,
      startsAt: new Date(Date.now() - 3600000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString() } };
  const workspace = { ...api.emptyMarketingWorkspace(), campaigns: [campaign], reviews: [{ postId: 'post-local', campaignId: campaign.id,
    campaignVersion: 1, publication: 'published', externalId: '111_555', campaignSnapshot: structuredClone(campaign) }] };
  const saveWorkspace = () => query(`INSERT INTO marketing_workspaces(page_id,document,updated_at) VALUES('111',$1::jsonb,1)
    ON CONFLICT(page_id) DO UPDATE SET document=EXCLUDED.document`, [JSON.stringify(workspace)]);
  await saveWorkspace();
  const linkPost = async ({ mid = 'private-post', psid = '222', pageId = '111', postId = '111_555', commentId = '555_600', status = 'sent', recipientId = psid } = {}) => {
    const sentAt = Date.now() - 2000;
    const snapshot = { commentText: 'Áo AT01 có ưu đãi không?', postText: 'Áo thun mùa hè', revision: 1 };
    await query(`INSERT INTO facebook_comments(page_id,comment_id,post_id,author_id,author_name,text,created_at,event_at,status,
      post_text,message_id,recipient_id,sent_at,care_context_json) VALUES($1,$2,$3,'444','Trùng tên',$4,$5,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
    [pageId, commentId, postId, snapshot.commentText, sentAt - 100, status, snapshot.postText, mid, recipientId, sentAt, JSON.stringify(snapshot)]);
    await f.writer.savePostgresMessages([m(mid, { pageId, psid, direction: 'out', timestamp: sentAt, text: 'Tin nhắn riêng về AT01.' })], pool);
  };
  const linkLive = async ({ mid = 'private-live', sessionId = 'live-1', commentId = '999_600', flashPrice = 180000 } = {}) => {
    const sentAt = Date.now() - 2000;
    await query(`INSERT INTO live_sessions(id,page_id,platform,source_kind,source_id,source_post_id,title,status,knowledge_json,started_at,live_at,flash_json)
      VALUES($1,'111','facebook','live_video','999','111_999','Live áo thun','live',$2::jsonb,$3,$3,$4::jsonb)`,
    [sessionId, JSON.stringify(f.knowledge), sentAt - 1000, JSON.stringify({ AT01: flashPrice })]);
    const snapshot = { commentText: 'Áo AT01 bao nhiêu?', sku: 'AT01', product: { id: product.id, sku: product.sku, name: product.name }, flashPrice };
    await query(`INSERT INTO live_comments(session_id,comment_id,author_id,author_name,text,created_at,received_at,intent,sku,reply_status,message_id,sent_at,care_context_json)
      VALUES($1,$2,'444','Trùng tên',$3,$4,$4,'price','AT01','sent',$5,$4,$6::jsonb)`, [sessionId, commentId, snapshot.commentText, sentAt, mid, JSON.stringify(snapshot)]);
    await f.writer.savePostgresMessages([m(mid, { direction: 'out', timestamp: sentAt, text: 'Giá trong phiên 180.000đ.' })], pool);
  };
  return { ...f, workspace, campaign, saveWorkspace, linkPost, linkLive,
    readSources: (psid, messageId, at) => f.load('lib/services/conversationSources.ts').readConversationSources('111', psid, messageId, pool, at) };
}

test('source links use exact Page/message/recipient evidence, not commenter IDs or duplicate names; unknown sends stay unlinked', async () => {
  const f = await sourceFixture();
  await f.linkPost();
  await f.incoming('question');
  await f.incoming('same-name', { psid: '444' });
  const sources = await f.readSources('222', 'question');
  assert.equal(sources.resolution, 'linked'); assert.equal(sources.blocked, false);
  assert.equal(sources.sources[0].campaign.id, f.campaign.id);
  assert.equal(sources.sources[0].campaign.offerActive, true);
  assert.equal(sources.sources[0].products[0].sku, 'AT01');
  assert.equal(sources.sources[0].products[0].price, undefined, 'historical catalog prices must not replace confirmed Chat prices');
  const missing = await f.load('lib/services/customerCare.ts').generateCareReply({ ...f.knowledge, products: [] }, f.profile, null, 'Giá áo này?', [], sources);
  assert.equal(missing.analysis.canAutoReply, false); assert.match(missing.analysis.reason, /chưa có trong tri thức Chat/);
  assert.equal((await f.readSources('444', 'same-name')).resolution, 'none', 'a commenter ID is never treated as a PSID');
  await f.linkPost({ mid: 'unknown-private', commentId: '555_601', status: 'unknown', psid: '333' });
  await f.linkPost({ mid: 'foreign-private', pageId: '999', postId: '999_555', commentId: '555_602' });
  await f.linkPost({ mid: 'wrong-recipient', commentId: '555_603', psid: '333', recipientId: '444' });
  await f.incoming('no-proof', { psid: '333' });
  assert.equal((await f.readSources('333', 'no-proof')).resolution, 'none');
  assert.equal(await f.load('lib/services/conversationSources.ts').readConversationSources('999', '222', 'question', pool), null);
  const snap = await f.load('lib/services/messengerInboxDb.ts').readMessengerInbox('111', 100, pool);
  assert.equal(snap.conversations.find(thread => thread.psid === '222').sourceContext.sources[0].commentId, '555_600');
});

test('multiple sources never select the newest implicitly; a direct reply resolves only its own source and history keeps the evidence', async () => {
  const f = await sourceFixture(); await f.linkPost(); await f.linkLive(); await f.incoming('ambiguous');
  let context = await f.readSources('222', 'ambiguous');
  assert.equal(context.resolution, 'ambiguous'); assert.equal(context.selectedId, null); assert.equal(context.blocked, false, 'an unclear source no longer blocks the AI');
  let system = ''; f.state.beforeReply = async (options) => { system = options.system; };
  await f.process(); assert.equal(f.state.sends, 1, 'the AI answers from the catalog');
  assert.ok(system.includes('"sources":[]') && !system.includes('Giảm 10%'), 'the model gets no content of any candidate source, not even the offer');
  const saved = (await query("SELECT * FROM messenger_analysis_history WHERE message_id='ambiguous'")).rows[0];
  assert.equal(saved.source_context_json.resolution, 'ambiguous');
  assert.notEqual(saved.reply, f.load('lib/services/handoff.ts').UNKNOWN_REPLY, 'a normal answer, not the handoff template');
  await f.incoming('explicit', { replyToMessageId: 'private-post', timestamp: Date.now() + 1 });
  context = await f.readSources('222', 'explicit');
  assert.equal(context.resolution, 'reply'); assert.equal(context.selectedId, 'private-post'); assert.equal(context.blocked, false);
  await f.incoming('unknown-reference', { replyToMessageId: 'not-a-linked-message', timestamp: Date.now() + 2 });
  assert.equal((await f.readSources('222', 'unknown-reference')).resolution, 'unresolved');
  const memory = await f.load('lib/services/conversationMemory.ts').readConversationMemories('111', ['["111","222"]'], pool);
  assert.equal(memory.get('["111","222"]')[0].sourceContext.sources.length, 2);
});

test('campaign boundaries, changed approvals and edited comments block model answers (only the handoff template goes out) while preserving the original offer and comment', async () => {
  const f = await sourceFixture(); await f.linkPost(); await f.incoming('offer');
  const active = await f.readSources('222', 'offer');
  const expired = await f.readSources('222', 'offer', Date.parse(f.campaign.offer.endsAt));
  assert.equal(expired.blocked, true); assert.equal(expired.sources[0].campaign.offerActive, false);
  assert.equal(expired.sources[0].campaign.offer.details, 'Giảm 10%');
  assert.notEqual(active.fingerprint, expired.fingerprint);
  f.workspace.campaigns[0].version++; f.workspace.campaigns[0].approvedAt = null; await f.saveWorkspace();
  assert.equal((await f.readSources('222', 'offer')).blocked, true);
  await query("UPDATE facebook_comments SET text='Nội dung đã sửa',revision=revision+1 WHERE page_id='111'");
  const changed = await f.readSources('222', 'offer');
  assert.equal(changed.sources[0].commentText, 'Áo AT01 có ưu đãi không?');
  assert.ok(changed.sources[0].issues.some(issue => issue.includes('Bình luận đã thay đổi')));
  await f.process(); assert.equal(f.state.sends, 1, 'blocked sources never get a model answer, only the fixed handoff template');
  assert.equal((await query("SELECT text FROM messenger_outbound_requests WHERE status='sent'")).rows[0].text, f.load('lib/services/handoff.ts').UNKNOWN_REPLY);
});

test('Live carries the exact SKU and flash snapshot, deduplicates shared post replies and expires when the session ends or price changes', async () => {
  const f = await sourceFixture(); await f.linkLive();
  await f.linkPost({ mid: 'private-live', postId: '111_999', commentId: '999_600' });
  await f.incoming('live-question');
  const active = await f.readSources('222', 'live-question');
  assert.equal(active.sources.length, 1); assert.equal(active.sources[0].kind, 'live');
  assert.equal(active.sources[0].live.flashPrice, 180000); assert.equal(active.sources[0].live.flashActive, true);
  await query("UPDATE live_sessions SET flash_json='{}'::jsonb WHERE id='live-1'");
  const changed = await f.readSources('222', 'live-question');
  assert.equal(changed.blocked, true); assert.equal(changed.sources[0].live.flashPrice, 180000);
  await query("UPDATE live_sessions SET status='ended',ended_at=$1,flash_json=$2::jsonb WHERE id='live-1'", [Date.now(), JSON.stringify({ AT01: 180000 })]);
  const ended = await f.readSources('222', 'live-question');
  assert.equal(ended.blocked, true); assert.equal(ended.sources[0].live.flashActive, false);
  const reply = await f.load('lib/services/customerCare.ts').generateCareReply(f.knowledge, f.profile, null, 'Giá live còn không?', [], ended);
  assert.equal(reply.analysis.canAutoReply, false); assert.equal(reply.analysis.needsHuman, true);
});

test('source changes during generation or just before transport prevent stale sends; source snapshots reach the prompt and persisted history', async () => {
  for (const stage of ['normal', 'generation', 'transport']) {
    const f = await sourceFixture(); await f.linkPost(); await f.incoming('source-race');
    let prompt;
    const change = async () => { f.workspace.campaigns[0].version++; await f.saveWorkspace(); };
    f.state.beforeReply = async options => { prompt = options.system; if (stage === 'generation') await change(); };
    if (stage === 'transport') f.state.beforeTransport = change;
    await f.process();
    assert.ok(prompt.includes('Áo mùa hè')); assert.ok(prompt.includes('Chỉ áp dụng AT01'));
    assert.equal(f.state.sends, stage === 'normal' ? 1 : 0, stage);
    if (stage === 'transport') assert.equal((await query('SELECT status FROM messenger_outbound_requests')).rows[0].status, 'failed');
    if (stage === 'normal') {
      const saved = (await query('SELECT source_context_json FROM messenger_analysis_history')).rows[0];
      assert.equal(saved.source_context_json.sources[0].campaign.id, 'campaign-1');
    }
  }
});

test('the final transport gate checks offer expiry again even when the configuration and conversation versions are unchanged', async () => {
  const originalNow = Date.now;
  let tick = originalNow(); Date.now = () => tick;
  try {
    const f = await sourceFixture(); await f.linkPost(); await f.incoming('expiry-race');
    f.state.beforeTransport = async () => { tick = Date.parse(f.campaign.offer.endsAt); };
    await f.process(); assert.equal(f.state.sends, 0);
    assert.equal((await query('SELECT status FROM messenger_outbound_requests')).rows[0].status, 'failed');
  } finally { Date.now = originalNow; }
});

test('a direct reply to an older source is resolved beyond the bounded recent-source list', async () => {
  const f = await sourceFixture();
  for (let i = 0; i < 24; i++) await f.linkPost({ mid: `private-${i}`, commentId: `555_${600 + i}` });
  await f.incoming('many-sources');
  const ambiguous = await f.readSources('222', 'many-sources');
  assert.equal(ambiguous.resolution, 'ambiguous'); assert.equal(ambiguous.sources.length, 5);
  await f.incoming('reply-oldest', { replyToMessageId: 'private-0', timestamp: Date.now() + 1 });
  const explicit = await f.readSources('222', 'reply-oldest');
  assert.equal(explicit.resolution, 'reply'); assert.equal(explicit.selectedId, 'private-0'); assert.equal(explicit.sources[0].id, 'private-0');
});

test('Inbox hides a suggestion when source facts change; legacy memory saves cannot erase its stored source evidence', async () => {
  const f = await sourceFixture(); await f.linkPost(); await f.incoming('current-context');
  const sources = await f.readSources('222', 'current-context');
  const result = await f.load('lib/services/customerCare.ts').generateCareReply(f.knowledge, f.profile, null, 'Ưu đãi áo?', [], sources);
  const memory = f.load('lib/services/conversationMemory.ts');
  await memory.saveConversationMemory('111', '222', 'current-context', result, pool);
  const { sourceContext: omitted, ...legacy } = result;
  assert.equal(omitted.fingerprint, sources.fingerprint);
  await memory.saveConversationMemory('111', '222', 'current-context', legacy, pool);
  assert.equal((await query('SELECT source_context_json FROM messenger_analysis_history')).rows[0].source_context_json.fingerprint, sources.fingerprint);
  const read = f.load('lib/services/messengerInboxDb.ts'), view = f.load('lib/services/messengerView.ts');
  let thread = (await read.readMessengerInbox('111', 100, pool)).conversations[0];
  const before = view.mergeMessengerThread(thread); assert.ok(before.aiSuggestion);
  f.workspace.campaigns[0].version++; await f.saveWorkspace();
  thread = (await read.readMessengerInbox('111', 100, pool)).conversations[0];
  const after = view.mergeMessengerThread(thread, before);
  assert.equal(after.aiSuggestion, undefined); assert.equal(after.aiStatus, 'error');
  assert.equal(f.load('lib/services/inboxAi.ts').applyConversationAnalysis(after, 'current-context', result).aiSuggestion, undefined);
});

test('Messenger AI API validates switches and customer, keeps confirmed knowledge and permits disabling without browser knowledge', async () => {
  const f = await aiFixture(false);
  const route = f.load('app/api/messenger/ai/route.ts');
  const req = (method, body) => new Request('http://localhost/api/messenger/ai', { method,
    headers: { origin: 'http://localhost', Authorization: `Bearer ${process.env.INBOX_ACCESS_KEY}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const response = await route.GET(req('GET'));
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal((await response.json()).autoReply, false);
  assert.equal((await route.PUT(req('PUT', { autoReply: 'yes' }))).status, 400);
  assert.equal((await route.PUT(req('PUT', { autoReply: true }))).status, 200);
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

const IMAGE_REQUEST = { psid: '222', text: '', requestId: '55555555-5555-4555-8555-555555555555',
  image: { data: Uint8Array.from([0xff, 0xd8, 0xff, 1, 2]), mime: 'image/jpeg', label: 'img-1' } };

test('image send posts multipart filedata with the message JSON, is idempotent and is saved with an image attachment', async () => {
  const { load, writer } = await fixture();
  await writer.savePostgresMessages([m('customer')], pool);
  const { sendMessengerMessage } = load('lib/services/messengerSend.ts');
  const calls = [];
  const transport = async (url, options) => { calls.push({ url, options }); return Response.json({ recipient_id: '222', message_id: 'meta-img' }); };
  const sent = await sendMessengerMessage(IMAGE_REQUEST, pool, transport);
  assert.match(calls[0].url, /\/111\/messages$/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-page-token');
  assert.equal(calls[0].options.headers['Content-Type'], undefined, 'fetch sets the multipart boundary itself');
  const form = calls[0].options.body;
  assert.ok(form instanceof FormData);
  assert.deepEqual(JSON.parse(form.get('recipient')), { id: '222' });
  assert.equal(form.get('messaging_type'), 'RESPONSE');
  assert.deepEqual(JSON.parse(form.get('message')), { attachment: { type: 'image', payload: {} } }, 'no is_reusable');
  assert.equal(form.get('filedata').type, 'image/jpeg');
  assert.equal(form.get('filedata').size, 5);
  assert.equal(sent.message.text, '');
  assert.deepEqual(sent.message.attachments, [{ type: 'image' }]);
  const row = (await query('SELECT * FROM messenger_outbound_requests')).rows[0];
  assert.equal(row.text, '[ảnh] img-1'); assert.equal(row.status, 'sent');
  assert.deepEqual((await query("SELECT attachments_json FROM messenger_messages WHERE direction='out'")).rows[0].attachments_json, [{ type: 'image' }]);
  const again = await sendMessengerMessage(IMAGE_REQUEST, pool, transport);
  assert.equal(calls.length, 1, 'the same request never sends twice');
  assert.deepEqual(again.message.attachments, [{ type: 'image' }]);
  await assert.rejects(sendMessengerMessage({ ...IMAGE_REQUEST, image: { ...IMAGE_REQUEST.image, label: 'img-2' } }, pool, transport), /Mã yêu cầu/);
});

test('image send obeys the 24 hour window and records Meta failures as failed or unknown', async () => {
  const { load, writer } = await fixture();
  await writer.savePostgresMessages([m('customer')], pool);
  const { sendMessengerMessage } = load('lib/services/messengerSend.ts');
  let calls = 0; const bodies = [];
  const reject = (status) => async (_url, options) => { calls++; bodies.push(options.body); return new Response('{}', { status }); };
  await assert.rejects(sendMessengerMessage(IMAGE_REQUEST, pool, reject(400)), /từ chối/);
  assert.equal((await query('SELECT status FROM messenger_outbound_requests')).rows[0].status, 'failed');
  await assert.rejects(sendMessengerMessage({ ...IMAGE_REQUEST, requestId: '66666666-6666-4666-8666-666666666666' }, pool, reject(502)), /chưa xác nhận/);
  assert.deepEqual((await query('SELECT status FROM messenger_outbound_requests ORDER BY created_at, request_id')).rows.map(row => row.status).sort(), ['failed', 'unknown']);
  await query('UPDATE messenger_conversations SET last_in_at=$1', [Date.now() - 25 * 60 * 60 * 1000]);
  await assert.rejects(sendMessengerMessage({ ...IMAGE_REQUEST, requestId: '77777777-7777-4777-8777-777777777777' }, pool, reject(200)), /24 giờ/);
  assert.equal(calls, 2, 'the expired window never reaches Meta');
  assert.ok(bodies.every(body => body instanceof FormData), 'failures are judged on the multipart image request');
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

const PHOTO_PRODUCT = { id: 'p1', sku: 'AT-01', name: 'Áo thun Đen Basic', material: '', category: 'Áo', colors: [], sizes: [], qty: 5, price: 199000 };
const PHOTOS = [{ productId: 'p1', name: PHOTO_PRODUCT.name, sku: 'AT-01', imageIds: ['img-a', 'img-b'] }, { productId: 'p2', name: 'Đầm hoa', sku: 'DM-02', imageIds: ['img-c'] }];
async function photoReply(f, photos, options = {}) {
  const seen = [];
  f.state.beforeReply = async (request) => { seen.push(request); };
  const knowledge = { ...f.knowledge, products: [PHOTO_PRODUCT] };
  const reply = await f.load('lib/services/customerCare.ts').generateCareReply(knowledge, options.profile ?? f.profile, null, 'Cho mình xem ảnh áo thun nhé',
    [], options.sources, null, undefined, options.images, photos);
  return { reply, seen };
}

test('model-picked photos are kept only for products the reply names, rotated and capped at 3 images', async () => {
  const f = await aiFixture(true);
  f.state.photoProductIds = ['p1', 'p2'];
  f.state.replyText = 'Dạ mẫu Áo thun Đen Basic và Đầm hoa đều đang có ạ.';
  const { reply, seen } = await photoReply(f, PHOTOS);
  assert.deepEqual(reply.analysis.photoImageIds, ['img-a', 'img-c', 'img-b']);
  assert.equal(reply.analysis.photoProductIds, undefined, 'the model-facing field never leaves generateCareReply');
  assert.deepEqual(JSON.parse(seen[0].user).shopPhotos, [{ productId: 'p1', name: 'Áo thun Đen Basic' }, { productId: 'p2', name: 'Đầm hoa' }]);
  assert.ok(seen[0].system.includes('photoProductIds') && seen[0].system.includes('mặc định KHÔNG chọn'));
});

test('a reply that does not name the picked product sends no photos, and unknown ids are ignored', async () => {
  const f = await aiFixture(true);
  f.state.photoProductIds = ['p1', 'zzz'];
  f.state.replyText = 'Dạ còn hàng size M ạ.';
  const { reply } = await photoReply(f, PHOTOS);
  assert.equal(reply.analysis.photoImageIds, undefined);
  f.state.photoProductIds = ['zzz']; f.state.replyText = 'Dạ mẫu Áo thun Đen Basic còn ạ.';
  assert.equal((await photoReply(f, PHOTOS)).reply.analysis.photoImageIds, undefined);
});

test('without candidates, or with the products source off, nothing about photos reaches the model or the result', async () => {
  const f = await aiFixture(true);
  f.state.photoProductIds = ['p1']; f.state.analysisExtra = { photoImageIds: ['evil'] }; f.state.replyText = 'Mẫu Áo thun Đen Basic ạ.';
  for (const [photos, options] of [[[], {}], [PHOTOS, { profile: { ...f.profile, sources: ['shop', 'faqs', 'conversation'] } }]]) {
    const { reply, seen } = await photoReply(f, photos, options);
    assert.ok(!seen[0].user.includes('shopPhotos') && !seen[0].system.includes('photoProductIds'));
    assert.equal(reply.analysis.photoImageIds, undefined, 'a model-supplied photoImageIds is never copied');
    assert.equal(reply.analysis.photoProductIds, undefined);
  }
});

test('photos are decided on the final reply: the fixed source-blocked template and image handoff carry none', async () => {
  const f = await aiFixture(true);
  f.state.photoProductIds = ['p1']; f.state.replyText = 'Mẫu Áo thun Đen Basic ạ.';
  const blocked = { blocked: true, resolution: 'linked', selectedId: 's1', fingerprint: 'f', sources: [{ id: 's1', kind: 'post', products: [], issues: ['Ưu đãi đã hết hạn.'] }] };
  const template = await photoReply(f, PHOTOS, { sources: blocked });
  assert.match(template.reply.reply, /Bạn gửi giúp shop mã sản phẩm/);
  assert.equal(template.reply.analysis.photoImageIds, undefined);
  f.state.imageKinds = ['receipt'];
  const images = { images: [{ mimeType: 'image/jpeg', data: 'QUJD' }], count: 1, hasText: false, unreadable: false };
  const handoff = await photoReply(f, PHOTOS, { images });
  assert.equal(handoff.reply.analysis.imageOutcome, 'handoff');
  assert.equal(handoff.reply.analysis.photoImageIds, undefined);
});

// saveMessengerAiSettings never replaces the approved knowledge snapshot, so the product goes in directly.
const withPhotoProduct = (f) => query('UPDATE messenger_ai_settings SET knowledge_json=$1::jsonb', [JSON.stringify({ ...f.knowledge, products: [PHOTO_PRODUCT] })]);
async function photoShop(f) {
  await enableAutoReply(f); await withPhotoProduct(f);
  const { addProductImage } = f.load('lib/services/productImages.ts');
  const ids = [];
  for (const fill of [1, 2, 3]) ids.push((await addProductImage('111', 'p1', Uint8Array.from([0xff, 0xd8, 0xff, fill, fill]), pool)).id);
  return ids;
}
const asked = (extra = {}) => ({ text: 'Cho mình xem ảnh áo thun Đen Basic nhé', ...extra });
const outbound = async () => (await query('SELECT request_id,text,status FROM messenger_outbound_requests ORDER BY request_id')).rows;
const NAMING_REPLY = 'Dạ mẫu Áo thun Đen Basic đây ạ, bạn xem nhé.';

test('after the text the chosen photos follow in order, one request each, and the job reflects only the text', async () => {
  const f = await aiFixture(true); const ids = await photoShop(f);
  f.state.photoProductIds = ['p1']; f.state.replyText = NAMING_REPLY;
  await f.incoming('ask', asked()); await f.process();
  assert.equal(f.state.sends, 4);
  assert.equal(typeof f.state.bodies[0], 'string');
  assert.ok(f.state.bodies.slice(1).every(body => body instanceof FormData), 'photos are multipart uploads');
  const rows = await outbound();
  assert.deepEqual(rows.map(row => row.text), [NAMING_REPLY, ...ids.map(id => '[ảnh] ' + id)]);
  assert.deepEqual(rows.slice(1).map(row => row.request_id), [1, 2, 3].map(n => `${rows[0].request_id}:img:${n}`));
  assert.ok(rows.every(row => row.status === 'sent'));
  assert.equal(await jobStatus('ask'), 'sent');
  assert.deepEqual((await savedAnalysis('ask')).photoImageIds, ids);
});

test('photos already sent in this conversation are offered again and go out again when the customer asks and the model picks them', async () => {
  const f = await aiFixture(true); await photoShop(f);
  f.state.photoProductIds = ['p1']; f.state.replyText = NAMING_REPLY;
  await f.incoming('ask', asked()); await f.process();
  assert.equal(f.state.sends, 4);
  const seen = []; f.state.beforeReply = async (options) => { seen.push(options); };
  await f.incoming('again', asked({ timestamp: Date.now() + 1000 })); await f.process();
  assert.deepEqual(JSON.parse(seen[0].user).shopPhotos.map(({ productId }) => productId), ['p1'], 'the product is still offered although all its images were sent');
  assert.equal(f.state.sends, 8, 'the text and the 3 photos go out again');
});

test('a photo failing stops the later photos but the job stays sent and the next customer message is still auto-replied', async () => {
  const f = await aiFixture(true); await photoShop(f);
  f.state.photoProductIds = ['p1']; f.state.replyText = NAMING_REPLY;
  f.state.respond = (n) => n === 3 ? new Response('{}', { status: 400 }) : undefined;
  await f.incoming('ask', asked()); await f.process();
  assert.equal(f.state.sends, 3, 'the third photo is never attempted');
  assert.deepEqual((await outbound()).map(row => row.status), ['sent', 'sent', 'failed']);
  assert.equal(await jobStatus('ask'), 'sent');
  f.state.respond = undefined; f.state.photoProductIds = undefined; f.state.replyText = 'Shop mở cửa lúc 8 giờ.';
  await f.incoming('next', { text: 'Giờ mở cửa?', timestamp: Date.now() + 1000 }); await f.process();
  assert.equal(f.state.sends, 4);
  assert.equal(await jobStatus('next'), 'sent');
});

test('a customer message arriving after the text stops the remaining photos', async () => {
  const f = await aiFixture(true); await photoShop(f);
  f.state.photoProductIds = ['p1']; f.state.replyText = NAMING_REPLY;
  let reservations = 0;
  f.state.beforeTransport = async () => {
    if (++reservations !== 2) return;
    await f.writer.savePostgresMessages([m('late', { timestamp: Date.now() + 1000, text: 'Còn size M không?' })], pool);
    f.state.canAutoReply = false; // the follow-up run for the late message cannot answer, so it sends the handoff template
  };
  await f.incoming('ask', asked()); await f.process();
  assert.equal(f.state.sends, 3, 'the text, the photo already in flight and the template for the late message');
  assert.equal((await outbound()).filter(row => row.text.startsWith('[ảnh]')).length, 1, 'the remaining photos are not sent');
});

test('auto-reply switched off after the text stops the remaining photos', async () => {
  const f = await aiFixture(true); await photoShop(f);
  f.state.photoProductIds = ['p1']; f.state.replyText = NAMING_REPLY;
  let reservations = 0;
  f.state.beforeTransport = async () => { if (++reservations === 2) await query('UPDATE messenger_conversations SET ai_auto_reply=false'); };
  await f.incoming('ask', asked()); await f.process();
  assert.equal(f.state.sends, 2);
});

test('a held reply (conversation switch off) keeps its photo ids for the inbox and sends nothing, also on replay', async () => {
  const f = await aiFixture(true); const ids = await photoShop(f);
  f.state.canAutoReply = false; f.state.photoProductIds = ['p1']; f.state.replyText = NAMING_REPLY;
  await f.incoming('held', asked()); await query('UPDATE messenger_conversations SET ai_auto_reply=false');
  const first = await f.process();
  assert.deepEqual(first.reply.analysis.photoImageIds, ids);
  assert.equal(await jobStatus('held'), 'review');
  assert.deepEqual((await f.process()).reply.analysis.photoImageIds, ids, 'the replay of a held review reads the saved analysis');
  assert.equal(f.state.sends, 0);
});

test('a customer photo that goes to staff gets the fixed template and no product photos', async () => {
  const f = await aiFixture(true); await photoShop(f);
  f.state.imageKinds = ['receipt']; f.state.photoProductIds = ['p1']; f.state.replyText = NAMING_REPLY;
  await f.incoming('receipt', { text: '', attachments: [photo] }); await f.process();
  assert.equal(f.state.sends, 1);
  assert.ok((await outbound()).every(row => !row.text.startsWith('[ảnh]')));
});

test('with no uploaded photos the AI answers with text only', async () => {
  const f = await aiFixture(true);
  await enableAutoReply(f); await withPhotoProduct(f);
  f.state.photoProductIds = ['p1']; f.state.replyText = NAMING_REPLY;
  await f.incoming('ask', asked()); await f.process();
  assert.equal(f.state.sends, 1);
  assert.equal((await savedAnalysis('ask')).photoImageIds, undefined);
});

test('the suggest button returns the photo ids and never sends', async () => {
  const f = await aiFixture(true); const ids = await photoShop(f);
  f.state.photoProductIds = ['p1']; f.state.replyText = NAMING_REPLY;
  await f.incoming('sug', asked());
  const response = await f.load('app/api/customer-care/route.ts').POST(new Request('http://localhost/api/customer-care', { method: 'POST', headers: { origin: 'http://localhost' },
    body: JSON.stringify({ action: 'suggest', psid: '222', messageId: 'sug' }) }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).reply.analysis.photoImageIds, ids);
  assert.equal(f.state.sends, 0);
});

test('unsent photos show up for the inbox: failed and unknown (also stale sending), cleared by a later sent, never device uploads or old ones', async () => {
  const f = await aiFixture(true);
  await f.writer.savePostgresMessages([m('customer')], pool);
  const now = Date.now();
  const row = (id, text, status, createdAt = now, psid = '222') => query('INSERT INTO messenger_outbound_requests(page_id,request_id,psid,text,status,created_at) VALUES($1,$2,$3,$4,$5,$6)',
    ['111', crypto.randomUUID(), psid, text, status, createdAt]);
  await row(0, '[ảnh] img-failed', 'failed'); await row(0, '[ảnh] img-failed', 'failed', now + 1); await row(0, '[ảnh] img-unknown', 'unknown'); await row(0, '[ảnh] img-stale', 'sending', now - 3 * 60 * 1000);
  await row(0, '[ảnh] img-fresh', 'sending', now - 5 * 1000);
  await row(0, '[ảnh] img-resent', 'failed'); await row(0, '[ảnh] img-resent', 'sent');
  await row(0, '[ảnh] img-resend-failed', 'sent', now - 1000); await row(0, '[ảnh] img-resend-failed', 'failed'); // an older success must not hide a newer failed resend
  await row(0, '[ảnh] upload', 'failed'); await row(0, '[ảnh] img-old', 'failed', now - 25 * 60 * 60 * 1000);
  await row(0, '[ảnh] img-other-customer', 'failed', now, '999'); await row(0, 'một câu chữ', 'failed');
  const thread = await handoffThread(f);
  const byId = Object.fromEntries(thread.failedImages.map(image => [image.imageId, image.status]));
  assert.equal(thread.failedImages.length, 4, 'two failed attempts of one image show once');
  assert.deepEqual(byId, { 'img-failed': 'failed', 'img-unknown': 'unknown', 'img-stale': 'unknown', 'img-resend-failed': 'failed' });
  const view = f.load('lib/services/messengerView.ts').mergeMessengerThread(thread);
  assert.deepEqual(view.failedImages, thread.failedImages, 'the conversation carries the same list');
  assert.equal(f.load('lib/services/messengerView.ts').mergeMessengerThread({ ...thread, failedImages: undefined }, view).failedImages, undefined, 'the server list wins: a cleared failure is gone');
});
