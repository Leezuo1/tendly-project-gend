import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { after, afterEach, test } from 'node:test';
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

function loader(overrides = {}) {
  const cache = new Map();
  const load = (file) => {
    if (overrides[file]) return overrides[file];
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', compiled)((name) => overrides[name] ??
      (name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name)), loaded, loaded.exports);
    return loaded.exports;
  };
  return load;
}
const originalFetch = globalThis.fetch;
const env = Object.fromEntries(['PAGE_ID', 'PAGE_ACCESS_TOKEN', 'META_GRAPH_VERSION', 'APP_SECRET', 'VERIFY_TOKEN',
  'DATABASE_URL', 'DASHBOARD_KEY', 'NODE_ENV', 'GEMINI_API_KEY', 'GEMINI_MODEL'].map((k) => [k, process.env[k]]));
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});

const knowledge = {
  shop: { name: 'Shop', email: '', phone: '' }, productSource: { name: 'Catalog', connected: true, lastSyncedAt: 1 },
  products: [{ id: 'p1', sku: 'AT01', name: 'Áo thun', category: 'Áo', material: 'Cotton', colors: ['Đen'], sizes: ['L'], qty: 4, price: 150000 }],
  faqs: [], emailTriggers: [],
};
const event = (extra = {}) => ({ pageId: '111', commentId: '500_600', postId: '111_500', authorId: '222',
  authorName: 'Khách', text: 'Áo này bao nhiêu shop?', createdAt: Date.now() - 1000, eventAt: Date.now(), removed: false, ...extra });
const payload = (value, page = '111') => ({ object: 'page', entry: [{ id: page, time: Math.floor(Date.now() / 1000),
  changes: [{ field: 'feed', value: { item: 'comment', verb: 'add', comment_id: '500_600', post_id: '111_500',
    from: { id: '222', name: 'Khách' }, message: 'Áo này bao nhiêu?', created_time: Math.floor(Date.now() / 1000), ...value } }] }] });
let ai;
let aiHook;
let calls;
let postResponse;
async function setup() {
  await ready;
  await db.exec('TRUNCATE facebook_comments,facebook_comment_settings,messenger_messages,messenger_conversations,messenger_customers CASCADE');
  process.env.PAGE_ID = '111'; process.env.PAGE_ACCESS_TOKEN = 'secret-token'; process.env.META_GRAPH_VERSION = 'v26.0';
  process.env.DATABASE_URL = 'postgresql://test-only'; process.env.DASHBOARD_KEY = 'test-dashboard';
  process.env.APP_SECRET = 'test-secret'; process.env.VERIFY_TOKEN = 'verify';
  ai = { productQuestion: true, needsHuman: false, message: 'Áo thun giá 150.000đ ạ. Bạn cần size nào?', reason: 'Khách hỏi giá áo trong bài.' };
  aiHook = undefined; calls = []; postResponse = () => Response.json({ message_id: 'mid.1', recipient_id: '333' });
  globalThis.fetch = async (url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer secret-token');
    assert.ok(!url.includes('secret-token'));
    if (init.method === 'POST') {
      calls.push(JSON.parse(init.body));
      return postResponse();
    }
    if (url.includes('/111_500?')) return Response.json({ message: 'Áo thun AT01 cotton' });
    return Response.json({ can_reply_privately: true, message: 'Áo này bao nhiêu shop?' });
  };
  const raw = loader()('lib/services/messengerPostgres.ts');
  const callbacks = [];
  const load = loader({
    'lib/services/messengerPostgres.ts': { ...raw, getMessengerPool: () => pool },
    'lib/services/gemini.ts': { async generateGeminiJson(options) {
      assert.match(options.system, /150000/);
      assert.match(options.user, /AT01/);
      if (aiHook) await aiHook();
      return { result: options.parse(JSON.stringify(ai)), model: 'fake' };
    } },
    'next/server': { after: (callback) => callbacks.push(callback) },
  });
  return { load, callbacks, service: load('lib/services/facebookComments.ts') };
}
const row = async () => (await query('SELECT * FROM facebook_comments WHERE page_id=$1 AND comment_id=$2', ['111', '500_600'])).rows[0];

test('feed parser handles add/edit/remove, scopes Page, validates before persistence and never treats commenter as PSID', () => {
  const { parseMetaComments } = loader()('lib/services/metaWebhook.ts');
  for (const verb of ['add', 'edit', 'edited', 'remove']) {
    const [parsed] = parseMetaComments(payload({ verb }), '111');
    assert.equal(parsed.removed, verb === 'remove');
    assert.equal(parsed.authorId, '222'); assert.equal(parsed.psid, undefined);
  }
  assert.deepEqual(parseMetaComments(payload({}, '999'), '111'), []);
  assert.deepEqual(parseMetaComments(payload({ item: 'photo' }), '111'), []);
  for (const bad of [{ comment_id: '../secret' }, { post_id: '999_500' }, { created_time: -1 }, { message: 42 }]) {
    assert.throws(() => parseMetaComments(payload(bad), '111'));
  }
});

test('SQL deduplicates comment retries, invalidates edited drafts, preserves deletion tombstones and Page scope', async () => {
  const { service } = await setup();
  const first = event();
  await service.saveFacebookComments([first, first], pool);
  assert.equal((await row()).revision, 1);
  await service.saveFacebookComments([event({ text: 'Giá bao nhiêu?', eventAt: first.eventAt + 1 })], pool);
  assert.equal((await row()).revision, 2);
  await service.saveFacebookComments([first], pool);
  assert.equal((await row()).text, 'Giá bao nhiêu?');
  await service.saveFacebookComments([event({ removed: true, eventAt: first.eventAt + 2 })], pool);
  await service.saveFacebookComments([event({ eventAt: first.eventAt + 3 })], pool);
  assert.equal((await row()).status, 'deleted');
  await service.saveFacebookComments([event({ pageId: '999' })], pool);
  assert.equal((await service.readFacebookComments('111', pool)).comments.length, 1);
});

test('default drafts need review; enabling only auto-sends new product questions and stitches the returned Messenger recipient', async () => {
  const { service } = await setup();
  await service.saveCommentSettings('111', false, knowledge, pool);
  await service.saveFacebookComments([event()], pool);
  await service.processPendingComments('111', pool);
  assert.equal((await row()).status, 'review'); assert.equal(calls.length, 0);
  await query('DELETE FROM facebook_comments');
  await service.saveCommentSettings('111', true, knowledge, pool);
  const enabledAt = Number((await query('SELECT enabled_at FROM facebook_comment_settings')).rows[0].enabled_at);
  await service.saveFacebookComments([event({ createdAt: enabledAt })], pool);
  await service.processPendingComments('111', pool);
  assert.equal((await row()).status, 'sent');
  assert.deepEqual(calls[0].recipient, { comment_id: '500_600' });
  assert.equal(calls[0].messaging_type, undefined);
  const conversations = (await query('SELECT * FROM messenger_customers')).rows;
  assert.equal(conversations[0].psid, '333');
  assert.equal((await query('SELECT last_in_at FROM messenger_conversations')).rows[0].last_in_at, null);
  await service.saveFacebookComments([event({ text: 'Sửa comment', eventAt: Date.now() + 1 })], pool);
  await service.processPendingComments('111', pool);
  assert.equal(calls.length, 1);
});

test('old, ambiguous, non-product and Page comments never auto-send', async () => {
  for (const scenario of ['old', 'human', 'not-product', 'own-page', 'expired']) {
    const { service } = await setup();
    await service.saveCommentSettings('111', true, knowledge, pool);
    const enabledAt = Number((await query('SELECT enabled_at FROM facebook_comment_settings')).rows[0].enabled_at);
    ai.needsHuman = scenario === 'human'; ai.productQuestion = scenario !== 'not-product';
    await service.saveFacebookComments([event({ createdAt: scenario === 'expired' ? Date.now() - 8 * 86400_000 :
      scenario === 'old' ? enabledAt - 1 : enabledAt, authorId: scenario === 'own-page' ? '111' : '222' })], pool);
    await service.processPendingComments('111', pool);
    assert.equal(calls.length, 0, scenario);
  }
});

test('edited comments and disabling automation while AI runs cancel the automatic send', async () => {
  for (const scenario of ['edit', 'disable']) {
    const { service } = await setup();
    await service.saveCommentSettings('111', true, knowledge, pool);
    await service.saveFacebookComments([event({ createdAt: Date.now() })], pool);
    let once = false;
    aiHook = async () => {
      if (once) return; once = true;
      if (scenario === 'edit') await service.saveFacebookComments([event({ text: 'Câu hỏi khác', eventAt: Date.now() + 1 })], pool);
      else await query('UPDATE facebook_comment_settings SET auto_reply=false');
    };
    await service.processPendingComments('111', pool);
    assert.equal(calls.length, 0);
    assert.notEqual((await row()).status, 'sending');
  }
});

test('private reply reservation permits only one concurrent send, even with different text', async () => {
  const { service } = await setup();
  await service.saveFacebookComments([event()], pool);
  await query("UPDATE facebook_comments SET status='review'");
  await Promise.allSettled([
    service.sendCommentPrivateReply('111', '500_600', 'Tin một', 1, pool),
    service.sendCommentPrivateReply('111', '500_600', 'Tin hai', 1, pool),
  ]);
  assert.equal(calls.length, 1); assert.equal((await row()).status, 'sent');
});

test('interrupted AI leases are recoverable and missing AI or database writes never produce a send', async () => {
  const { service } = await setup();
  await service.saveCommentSettings('111', false, knowledge, pool);
  await service.saveFacebookComments([event()], pool);
  await query("UPDATE facebook_comments SET status='processing',processing_at=$1", [Date.now() - 121_000]);
  assert.equal((await service.readFacebookComments('111', pool)).pending, 1);
  await service.processPendingComments('111', pool);
  assert.equal((await row()).status, 'review');
  aiHook = async () => { throw new Error('AI unavailable'); };
  await service.draftCommentReply('111', '500_600', pool);
  assert.equal((await row()).status, 'review'); assert.equal(calls.length, 0);
  const failing = { ...pool, query: async (sql, args) => {
    if (sql.includes("SET status='sending'")) throw new Error('database unavailable');
    return query(sql, args);
  } };
  await assert.rejects(service.sendCommentPrivateReply('111', '500_600', 'Tin', 1, failing));
  assert.equal(calls.length, 0);
});

test('timeouts, 5xx and malformed success never resend; explicit rejection can be corrected manually', async () => {
  for (const scenario of ['timeout', '5xx', 'missing-mid', '4xx']) {
    const { service } = await setup();
    await service.saveFacebookComments([event()], pool);
    await query("UPDATE facebook_comments SET status='review'");
    postResponse = () => {
      if (scenario === 'timeout') throw new Error('connection lost');
      return scenario === 'missing-mid' ? Response.json({}) : new Response('', { status: scenario === '4xx' ? 400 : 503 });
    };
    const result = await service.sendCommentPrivateReply('111', '500_600', 'Tin nhắn', 1, pool);
    assert.equal(result.status, scenario === '4xx' ? 'failed' : 'unknown');
    if (scenario !== '4xx') await assert.rejects(service.sendCommentPrivateReply('111', '500_600', 'Tin nhắn', 1, pool));
    assert.equal(calls.length, 1);
  }
});

test('Meta eligibility, stale content and seven-day window are checked before sending', async () => {
  for (const scenario of ['expired', 'ineligible', 'edited']) {
    const { service } = await setup();
    await service.saveFacebookComments([event({ createdAt: scenario === 'expired' ? Date.now() - 7 * 86400_000 : Date.now() })], pool);
    await query("UPDATE facebook_comments SET status='review'");
    globalThis.fetch = async () => Response.json({ can_reply_privately: scenario !== 'ineligible', message: scenario === 'edited' ? 'Nội dung mới' : 'Áo này bao nhiêu shop?' });
    await assert.rejects(service.sendCommentPrivateReply('111', '500_600', 'Tin', 1, pool));
    assert.equal((await row()).status, 'review'); assert.equal(calls.length, 0);
  }
});

test('signed webhook persists comments before ack, defers AI and rejects invalid signatures', async () => {
  const { load, callbacks } = await setup();
  const route = load('app/api/meta/webhook/route.ts');
  const raw = JSON.stringify(payload());
  const signature = 'sha256=' + createHmac('sha256', 'test-secret').update(raw).digest('hex');
  const post = (sig) => route.POST(new Request('http://localhost/api/meta/webhook', {
    method: 'POST', headers: { 'x-hub-signature-256': sig }, body: raw,
  }));
  assert.equal((await post('bad')).status, 403); assert.equal(await row(), undefined);
  assert.equal((await post(signature)).status, 200); assert.equal((await row()).status, 'pending');
  assert.equal(callbacks.length, 1); assert.equal(calls.length, 0);
  await callbacks[0](); assert.equal(calls.length, 0);
});

test('comments APIs require dashboard authorization, validate sends and allow stopping without a local catalog', async () => {
  const { load, service } = await setup();
  const route = load('app/api/facebook/comments/route.ts');
  const req = (method, body, key = 'test-dashboard') => new Request('http://localhost/api/facebook/comments', {
    method, headers: { Authorization: `Bearer ${key}` }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal((await route.GET(req('GET', null, 'wrong'))).status, 401);
  process.env.NODE_ENV = 'production'; delete process.env.DASHBOARD_KEY;
  assert.equal((await route.GET(req('GET'))).status, 503); process.env.DASHBOARD_KEY = 'test-dashboard';
  assert.equal((await route.PUT(req('PUT', { autoReply: true, knowledge: { ...knowledge, products: [] } }))).status, 400);
  await service.saveCommentSettings('111', true, knowledge, pool);
  assert.equal((await route.PUT(req('PUT', { autoReply: false }))).status, 200);
  assert.equal((await service.readFacebookComments('111', pool)).settings.autoReply, false);
  for (const body of [{ action: 'send', commentId: '../oops' }, { action: 'send', commentId: '500_600', revision: 1, text: '' },
    { action: 'send', commentId: '500_600', revision: '1', text: 'Tin' }, { action: 'delete', commentId: '500_600' }]) {
    assert.equal((await route.POST(req('POST', body))).status, 400);
  }
  const response = await route.GET(req('GET'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(!JSON.stringify(await response.json()).includes('secret-token'));
});

test('AI output is validated and aborting the shared Gemini helper stops model fallback', async () => {
  const { service } = await setup();
  for (const value of [null, {}, { productQuestion: 'yes' }, { productQuestion: true, needsHuman: false, message: '', reason: '' }]) {
    assert.throws(() => service.parseCommentAiOutput(JSON.stringify(value)));
  }
  const controller = new AbortController(); let attempts = 0;
  process.env.GEMINI_API_KEY = 'fake'; delete process.env.GEMINI_MODEL;
  globalThis.fetch = async () => { attempts++; controller.abort(); throw new Error('aborted'); };
  const gemini = loader()('lib/services/gemini.ts');
  await assert.rejects(gemini.generateGeminiJson({ system: '', user: '', schema: {}, signal: controller.signal, parse: JSON.parse }));
  assert.equal(attempts, 1);
});
