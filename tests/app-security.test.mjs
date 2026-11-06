import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createHash, scryptSync } from 'node:crypto';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const db = new PGlite();
const ready = (async () => {
  for (const file of readdirSync('db/migrations').filter(file => file.endsWith('.sql')).sort()) await db.exec(readFileSync(`db/migrations/${file}`, 'utf8'));
})();
const query = async (sql, values) => { const result = await db.query(sql, values); return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length }; };
const pool = { query, connect: async () => ({ query, release() {} }) };
const envKeys = ['APP_ADMIN_USERNAME', 'APP_ADMIN_PASSWORD_HASH', 'INBOX_ACCESS_KEY', 'DASHBOARD_KEY', 'PAGE_ID', 'PAGE_ACCESS_TOKEN', 'META_GRAPH_VERSION', 'DATABASE_URL', 'CRON_SECRET', 'GEMINI_API_KEY', 'GEMINI_MODEL'];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const salt = 'a'.repeat(32);
const adminHash = `scrypt$${salt}$${scryptSync('test-admin-password', salt, 64).toString('hex')}`;
after(async () => { await ready; await db.close(); });
afterEach(() => { globalThis.fetch = originalFetch; for (const [key, value] of Object.entries(originalEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });

async function fixture() {
  await ready;
  await db.exec('TRUNCATE app_sessions,app_login_attempts');
  await query("DELETE FROM app_users WHERE id<>'demo'");
  await query("UPDATE app_users SET page_id='111' WHERE id='demo'");
  await query("UPDATE app_security_settings SET protection_enabled=true,revision=1,updated_at=1,updated_by='system',automatic_after=1 WHERE id=1");
  await query('DELETE FROM ai_page_profiles');
  await query("UPDATE ai_global_settings SET document=NULL,revision=0,updated_at=0,updated_by='' WHERE id=1");
  Object.assign(process.env, { APP_ADMIN_USERNAME: 'owner-test', APP_ADMIN_PASSWORD_HASH: adminHash, INBOX_ACCESS_KEY: 'old-inbox-secret-at-least-24-characters',
    DASHBOARD_KEY: 'old-dashboard-secret', DATABASE_URL: 'postgresql://test-only', PAGE_ID: '111', PAGE_ACCESS_TOKEN: 'test-page-token', META_GRAPH_VERSION: 'v26.0' });
  const cache = new Map();
  const load = file => {
    if (file === 'lib/services/messengerPostgres.ts') {
      const writer = loadRaw(file);
      return { ...writer, getMessengerPool: () => pool };
    }
    return loadRaw(file);
  };
  const loadRaw = file => {
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const compiled = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', compiled)(name => name.startsWith('@/') ? load(`${name.slice(2)}.ts`) : require(name), loaded, loaded.exports);
    return loaded.exports;
  };
  const security = load('lib/services/appSecurity.ts');
  const req = (method = 'GET', cookie = '', body, extra = {}, query = '') => new Request('https://test.example/api/test' + query, {
    method, headers: { cookie, origin: 'https://test.example', 'Content-Type': 'application/json', ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const login = async role => {
    const result = await security.loginApp(req('POST'), role === 'admin' ? 'owner-test' : 'admin', role === 'admin' ? 'test-admin-password' : 'admin123', pool);
    return `${security.APP_SESSION_COOKIE}=${result.token}`;
  };
  return { security, load, req, login };
}

test('default is protected; public demo account is a user and cannot forge admin identity', async () => {
  const f = await fixture();
  const cookie = await f.login('user');
  const session = await f.security.readAppSession(f.req('GET', cookie), pool);
  assert.equal(session.role, 'user'); assert.equal(session.protectionEnabled, true); assert.equal(session.canUse, false);
  await assert.rejects(f.security.changeProtection(f.req('PATCH', cookie), false, 1, pool), error => error.status === 403);
  const forged = f.req('GET', 'tendly_app_session=' + 'f'.repeat(64), undefined, { Authorization: 'Bearer old-dashboard-secret', 'x-role': 'admin' });
  assert.equal((await f.security.readAppSession(forged, pool)).authenticated, false);
  const headers = f.security.sessionCookie(f.req(), cookie.split('=')[1]);
  assert.match(headers, /HttpOnly/); assert.match(headers, /Secure/); assert.match(headers, /SameSite=Lax/);
  const stored = (await query('SELECT * FROM app_sessions')).rows[0];
  assert.equal(stored.token_hash, createHash('sha256').update(cookie.split('=')[1]).digest('hex'));
  assert.ok(!JSON.stringify(stored).includes('admin123'));
});

test('admin toggles persist, recheck existing user sessions and reject stale edits and foreign origins', async () => {
  const f = await fixture(); const owner = await f.login('admin'); const user = await f.login('user');
  assert.equal((await f.security.readAppSession(f.req('GET', owner), pool)).canUse, true);
  const unlocked = await f.security.changeProtection(f.req('PATCH', owner), false, 1, pool);
  assert.equal(unlocked.protectionEnabled, false);
  assert.equal((await f.security.readAppSession(f.req('GET', user), pool)).canUse, true);
  await assert.rejects(f.security.changeProtection(f.req('PATCH', owner), true, 1, pool), error => error.status === 409);
  await assert.rejects(f.security.changeProtection(f.req('PATCH', owner, undefined, { origin: 'https://evil.example' }), true, 2, pool), error => error.status === 403);
  await f.security.changeProtection(f.req('PATCH', owner), true, 2, pool);
  await assert.rejects(f.security.requireAppAccess(f.req('POST', user), pool), error => error.code === 'APP_PROTECTED');
  assert.equal((await f.security.readProtection(pool)).protectionEnabled, true);
  await db.exec(readFileSync('db/migrations/012-app-security.sql', 'utf8'));
  assert.equal((await f.security.readProtection(pool)).revision, 3);
});

test('sessions expire, are revoked on logout and password rotation; login attempts are limited', async () => {
  const f = await fixture(); const cookie = await f.login('admin');
  await f.security.logoutApp(f.req('DELETE', cookie), pool);
  assert.equal((await f.security.readAppSession(f.req('GET', cookie), pool)).authenticated, false);
  const rotated = await f.login('admin'); process.env.APP_ADMIN_PASSWORD_HASH += 'changed';
  assert.equal((await f.security.readAppSession(f.req('GET', rotated), pool)).authenticated, false);
  process.env.APP_ADMIN_PASSWORD_HASH = adminHash;
  const expired = await f.login('user'); await query('UPDATE app_sessions SET expires_at=1');
  assert.equal((await f.security.readAppSession(f.req('GET', expired), pool)).authenticated, false);
  for (let i = 0; i < 10; i++) await assert.rejects(f.security.loginApp(f.req('POST'), 'owner-test', 'wrong', pool), error => error.status === 401);
  await assert.rejects(f.security.loginApp(f.req('POST'), 'owner-test', 'wrong', pool), error => error.status === 429);
});

test('all data API handlers reject anonymous/legacy keys and locked users before doing any work', async () => {
  const f = await fixture(); const cookie = await f.login('user'); let providerCalls = 0;
  globalThis.fetch = async () => { providerCalls++; throw new Error('provider must not be reached'); };
  let checked = 0;
  for (const relative of readdirSync('app/api', { recursive: true }).filter(file => file.endsWith('route.ts'))) {
    const file = `app/api/${relative.replaceAll('\\', '/')}`;
    // The scheduler has a server-only bearer secret, tested separately below.
    if (['/meta/webhook/', '/auth/', '/inbox/session/', '/security/', '/marketing/schedules/run/'].some(part => file.includes(part))) continue;
    const route = f.load(file);
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
      if (!route[method]) continue;
      const anonymous = f.req(method, 'tendly_inbox_session=legacy', undefined, { Authorization: `Bearer ${process.env.DASHBOARD_KEY}` });
      assert.equal((await route[method](anonymous, { params: Promise.resolve({ id: 'fake', key: 'fake', orderId: 'fake' }) })).status, 401, `${file}:${method}:anonymous`);
      assert.equal((await route[method](f.req(method, cookie), { params: Promise.resolve({}) })).status, 403, `${file}:${method}:locked`);
      checked++;
    }
  }
  assert.ok(checked >= 40); assert.equal(providerCalls, 0);
});

test('AI global configuration is admin-only, revision-checked, and applied by the server to model calls', async () => {
  const f = await fixture(), admin = await f.login('admin'), user = await f.login('user');
  await f.security.changeProtection(f.req('PATCH', admin), false, 1, pool);
  const route = f.load('app/api/admin/ai-settings/route.ts');
  assert.equal((await route.GET(f.req('GET', user))).status, 403);
  assert.equal((await route.PUT(f.req('PUT', user, { role: 'admin' }))).status, 403);
  const initial = await (await route.GET(f.req('GET', admin))).json();
  assert.equal(initial.revision, 0);
  const configuration = initial.configuration;
  assert.deepEqual(Object.keys(configuration.profiles.content.base), ['description', 'domain', 'role', 'rules', 'forbidden']);
  configuration.profiles.content.base.rules = 'GLOBAL-CONTENT-RULE';
  configuration.profiles.content.platforms.facebook = { forbidden: 'GLOBAL-FACEBOOK-BANNED' };
  const body = { configuration, revision: 0 };
  assert.equal((await route.PUT(f.req('PUT', admin, body, { origin: 'https://foreign.example' }))).status, 403);
  assert.equal((await route.PUT(f.req('PUT', admin, { ...body, configuration: {} }))).status, 400);
  assert.equal((await route.PUT(f.req('PUT', admin, { ...body, configuration: { ...configuration, version: 1 } }))).status, 400);
  const saved = await route.PUT(f.req('PUT', admin, body));
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).revision, 1);
  assert.equal((await route.PUT(f.req('PUT', admin, body))).status, 409);
  const persisted = await (await route.GET(f.req('GET', admin))).json();
  assert.equal(persisted.configuration.profiles.content.base.rules, 'GLOBAL-CONTENT-RULE');
  const global = f.load('lib/services/aiGlobalSettings.ts');
  process.env.GEMINI_API_KEY = 'test-key'; process.env.GEMINI_MODEL = 'test-model';
  let system;
  globalThis.fetch = async (_url, options) => {
    system = JSON.parse(options.body).system_instruction.parts[0].text;
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] });
  };
  await f.load('lib/services/gemini.ts').generateGeminiJson({ role: 'content', platform: 'facebook', system: 'PRIVATE-SHOP-INPUT', user: 'Hello', schema: {}, parse: JSON.parse });
  assert.ok(system.includes('GLOBAL-CONTENT-RULE') && system.includes('GLOBAL-FACEBOOK-BANNED') && system.includes('PRIVATE-SHOP-INPUT'));
  assert.ok(!(await global.globalAiSystemPrompt('chat', 'facebook')).includes('GLOBAL-CONTENT-RULE'));
  await assert.rejects(global.readAiGlobalSettings({ query: async () => { throw new Error('unavailable'); } }));
});

test('shop personalizes each AI per Page on the server; prompt layers Global → Platform → Page; Pages are isolated', async () => {
  const f = await fixture(), admin = await f.login('admin'), user = await f.login('user');
  await f.security.changeProtection(f.req('PATCH', admin), false, 1, pool);
  const global = f.load('lib/services/aiGlobalSettings.ts'), route = f.load('app/api/ai-settings/route.ts');
  const profile = { base: { description: 'G', domain: 'G', role: 'G', rules: 'G', forbidden: 'a' }, platforms: { facebook: { rules: 'P', forbidden: 'b' } } };
  assert.deepEqual(global.effectiveGlobalAi(profile, 'facebook'), { description: 'G', domain: 'G', role: 'G', rules: 'P', forbidden: 'a, b' });
  assert.equal((await route.GET(f.req('GET', ''))).status, 401);
  const get = pageId => route.GET(f.req('GET', user, undefined, {}, '?pageId=' + pageId));
  const put = body => route.PUT(f.req('PUT', user, body));
  const initial = await (await get('111')).json();
  assert.equal(initial.revision, 0); assert.equal(initial.platform, 'facebook');
  const configuration = initial.configuration;
  configuration.profiles.content.instructions = 'SHOP-PAGE-INSTRUCTION';
  configuration.profiles.content.platformRules.facebook = { enabled: true, values: { cta: 'SHOP-FB-CTA' } };
  assert.equal((await get('222')).status, 403);
  assert.equal((await put({ pageId: '222', configuration, revision: 0 })).status, 403);
  assert.equal((await put({ pageId: '111', configuration: {}, revision: 0 })).status, 400);
  assert.equal((await put({ pageId: '111', configuration, revision: 0 })).status, 200);
  assert.equal((await put({ pageId: '111', configuration, revision: 0 })).status, 409);
  assert.equal((await (await get('111')).json()).configuration.profiles.content.instructions, 'SHOP-PAGE-INSTRUCTION');
  const other = f.load('lib/services/aiConfiguration.ts').defaultAiConfiguration();
  other.profiles.content.instructions = 'OTHER-PAGE';
  await query("INSERT INTO ai_page_profiles(page_id,shop_id,platform,document,updated_at,updated_by) VALUES('222','other','tiktok',$1::jsonb,1,'x')", [JSON.stringify(other)]);
  process.env.GEMINI_API_KEY = 'test-key'; process.env.GEMINI_MODEL = 'test-model';
  let system;
  globalThis.fetch = async (_url, options) => { system = JSON.parse(options.body).system_instruction.parts[0].text; return Response.json({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }); };
  const gemini = f.load('lib/services/gemini.ts');
  await gemini.generateGeminiJson({ role: 'content', system: 's', user: 'u', schema: {}, parse: JSON.parse });
  assert.ok(system.indexOf('THIẾT LẬP CHUNG') < system.indexOf('SHOP-PAGE-INSTRUCTION'));
  assert.ok(system.includes('SHOP-FB-CTA') && !system.includes('OTHER-PAGE'));
  await gemini.generateGeminiJson({ role: 'content', includeShop: false, system: 's', user: 'u', schema: {}, parse: JSON.parse });
  assert.ok(!system.includes('SHOP-PAGE-INSTRUCTION'));
});

test('scheduler rejects app cookies, legacy keys and a missing/wrong cron secret', async () => {
  const f = await fixture(); const route = f.load('app/api/marketing/schedules/run/route.ts');
  const cookie = await f.login('admin');
  delete process.env.CRON_SECRET;
  assert.equal((await route.GET(f.req('GET', cookie))).status, 401);
  process.env.CRON_SECRET = 'server-only-cron-test-secret';
  assert.equal((await route.GET(f.req('GET', cookie))).status, 401);
  assert.equal((await route.GET(f.req('GET', cookie, undefined, { Authorization: 'Bearer wrong-secret' }))).status, 401);
});

test('Customer Care configuration and conversation switches reject foreign origins for an authorized admin', async () => {
  const f = await fixture(); const owner = await f.login('admin');
  for (const file of ['app/api/customer-care/route.ts', 'app/api/messenger/ai/route.ts']) {
    const route = f.load(file);
    const response = await route.PUT(f.req('PUT', owner, { autoReply: false }, { origin: 'https://foreign.example' }));
    assert.equal(response.status, 403, file);
    assert.equal((await response.json()).code, 'BAD_ORIGIN');
  }
});

test('inbox bootstrap never mints authority; missing settings fail closed', async () => {
  const f = await fixture(); const route = f.load('app/api/inbox/session/route.ts');
  const response = await route.GET(f.req());
  assert.equal((await response.json()).ready, false); assert.equal(response.headers.get('set-cookie'), null);
  const broken = { query: async () => { throw new Error('database private credentials'); } };
  await assert.rejects(f.security.requireAppAccess(f.req('GET', 'tendly_app_session=' + 'f'.repeat(64)), broken), error => error.status === 503 && !error.message.includes('private credentials'));
});

test('login and security JSON inputs are bounded and reject foreign origins before parsing', async () => {
  const f = await fixture();
  await assert.rejects(f.security.readSecurityJson(f.req('POST', '', { username: 'x'.repeat(9000) })), error => error.status === 413);
  await assert.rejects(f.security.readSecurityJson(f.req('POST', '', {}, { origin: 'https://evil.example' })), error => error.status === 403);
  await assert.rejects(f.security.readSecurityJson(new Request('https://test.example/api/test', { method: 'POST', headers: { origin: 'https://test.example' }, body: '{bad' })), error => error.status === 400);
});

test('automatic sends pause while protected and old queued events do not replay after unlock', async () => {
  const f = await fixture(); const owner = await f.login('admin');
  assert.equal(await f.security.canRunAutomation(pool), false);
  await assert.rejects(f.security.runAutomaticAccess(Date.now(), () => f.security.assertOperationAllowed(pool)), error => error.status === 403);
  await f.security.changeProtection(f.req('PATCH', owner), false, 1, pool);
  assert.equal(await f.security.canRunAutomation(pool), true);
  await assert.rejects(f.security.runAutomaticAccess(1, () => f.security.assertOperationAllowed(pool)), error => error.status === 403);
  await f.security.runAutomaticAccess(Date.now() + 1000, () => f.security.assertOperationAllowed(pool));
});

test('send rechecks protection immediately before Meta; interrupted reservations are known not sent', async () => {
  const f = await fixture(); const owner = await f.login('admin'); const user = await f.login('user');
  await f.security.changeProtection(f.req('PATCH', owner), false, 1, pool);
  const now = Date.now();
  await query("INSERT INTO messenger_customers(id,page_id,psid,created_at) VALUES('security-test','111','333',$1) ON CONFLICT DO NOTHING", [now]);
  await query("INSERT INTO messenger_conversations(id,customer_id,page_id,created_at,last_in_at) VALUES('[\"111\",\"333\"]','security-test','111',$1,$1) ON CONFLICT(id) DO UPDATE SET last_in_at=$1", [now]);
  const send = f.load('lib/services/messengerSend.ts'); let sent = 0;
  const intercepted = { ...pool, query: async (sql, args) => {
    const result = await query(sql, args);
    if (sql.startsWith('INSERT INTO messenger_outbound_requests')) await f.security.changeProtection(f.req('PATCH', owner), true, 2, pool);
    return result;
  } };
  const handler = f.security.withAppAccess(async () => {
    await send.sendMessengerMessage({ psid: '333', text: 'Do not send', requestId: 'security-race' }, intercepted,
      async () => { sent++; return Response.json({ message_id: 'unexpected' }); });
    return Response.json({ ok: true });
  });
  const result = await handler(f.req('POST', user));
  assert.equal(result.status, 403); assert.equal(sent, 0);
  assert.equal((await query("SELECT status FROM messenger_outbound_requests WHERE request_id='security-race'")).rows[0].status, 'failed');
  const adminHandler = f.security.withAppAccess(async () => { await f.security.assertOperationAllowed(pool); return Response.json({ ok: true }); });
  const adminResponse = await adminHandler(f.req('POST', owner));
  assert.equal(adminResponse.status, 200);
  assert.equal(adminResponse.headers.get('cache-control'), 'no-store');
});

test('setup script preserves existing env values and generates a salted admin hash without printing credentials', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'tendly-security-'));
  try {
    writeFileSync(path.join(directory, '.env.local'), 'EXISTING_SETTING=keep\n');
    const output = execFileSync(process.execPath, [path.resolve('scripts/setup-app-security.mjs')], { cwd: directory, encoding: 'utf8' });
    const credentials = readFileSync(path.join(directory, '.env.security-admin.local'), 'utf8');
    const password = /Password: (.+)/.exec(credentials)[1];
    const env = readFileSync(path.join(directory, '.env.local'), 'utf8');
    assert.ok(env.includes('EXISTING_SETTING=keep')); assert.ok(!env.includes(password)); assert.ok(!output.includes(password));
    const encoded = /APP_ADMIN_PASSWORD_HASH=(.+)/.exec(env)[1].replaceAll('\\$', '$');
    const [, salt, derived] = encoded.split('$');
    assert.equal(scryptSync(password, salt, 64).toString('hex'), derived);
    execFileSync(process.execPath, [path.resolve('scripts/setup-app-security.mjs')], { cwd: directory });
    assert.equal(readFileSync(path.join(directory, '.env.local'), 'utf8'), env);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith('tendly-security-'));
    rmSync(directory, { recursive: true, force: true });
  }
});

const registration = { name: 'Minh Anh', email: 'New.Shop@example.com', password: 'real-password-123', confirmPassword: 'real-password-123' };
const cookieFrom = response => response.headers.get('set-cookie').split(';')[0];

test('registration persists a salted account and issues a server session; logout and login restore its identity', async () => {
  const f = await fixture();
  const response = await f.load('app/api/auth/register/route.ts').POST(f.req('POST', '', registration));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
  assert.deepEqual(await response.json(), { authenticated: true, role: 'user', needsSetup: true });
  const cookie = cookieFrom(response);
  const session = await f.security.readAppSession(f.req('GET', cookie), pool);
  assert.equal(session.authenticated, true); assert.equal(session.name, 'Minh Anh');
  assert.equal(session.username, 'new.shop@example.com'); assert.equal(session.pageId, null);
  assert.equal(session.needsSetup, true); assert.equal(session.canUse, false);
  const saved = (await query('SELECT * FROM app_users WHERE id=$1', [session.userId])).rows[0];
  assert.ok(!JSON.stringify(saved).includes(registration.password));
  const [format, salt, encoded] = saved.password_hash.split('$');
  assert.equal(format, 'scrypt-v1');
  assert.equal(scryptSync(registration.password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 268435456 }).toString('hex'), encoded);
  await f.security.logoutApp(f.req('DELETE', cookie), pool);
  assert.equal((await f.security.readAppSession(f.req('GET', cookie), pool)).authenticated, false);
  const loginRoute = f.load('app/api/auth/session/route.ts');
  const login = await loginRoute.POST(f.req('POST', '', { username: ' NEW.SHOP@EXAMPLE.COM ', password: registration.password }));
  assert.equal(login.status, 200);
  assert.equal((await f.security.readAppSession(f.req('GET', cookieFrom(login)), pool)).userId, session.userId);
  assert.ok(!JSON.stringify(session).includes('scrypt'));
});

test('duplicate emails cannot race into separate accounts; user input cannot assign role, ID or Page', async () => {
  const f = await fixture(); const route = f.load('app/api/auth/register/route.ts');
  const responses = await Promise.all([
    route.POST(f.req('POST', '', { ...registration, role: 'admin', id: 'demo', pageId: '111' })),
    route.POST(f.req('POST', '', { ...registration, email: 'new.shop@EXAMPLE.COM' })),
  ]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  const response = responses.find(response => response.status === 201);
  const session = await f.security.readAppSession(f.req('GET', cookieFrom(response)), pool);
  assert.equal(session.role, 'user'); assert.notEqual(session.userId, 'demo'); assert.equal(session.pageId, null);
  assert.equal(Number((await query("SELECT count(*) FROM app_users WHERE username='new.shop@example.com'")).rows[0].count), 1);
});

test('registration validates all fields and rejects reserved admin identity, foreign origins and oversized JSON', async () => {
  const f = await fixture(); const route = f.load('app/api/auth/register/route.ts');
  for (const patch of [{ name: '' }, { name: 'a'.repeat(101) }, { email: 'admin' }, { email: 'a'.repeat(250) + '@x.com' },
    { password: 'short', confirmPassword: 'short' }, { password: 'a'.repeat(1025), confirmPassword: 'a'.repeat(1025) },
    { confirmPassword: 'mismatch' }, { password: null }, { email: ['test@example.com'] }]) {
    assert.equal((await route.POST(f.req('POST', '', { ...registration, ...patch }))).status, 400);
  }
  process.env.APP_ADMIN_USERNAME = registration.email.toLowerCase();
  assert.equal((await route.POST(f.req('POST', '', registration))).status, 409);
  assert.equal((await route.POST(f.req('POST', '', registration, { origin: 'https://evil.example' }))).status, 403);
  assert.equal((await route.POST(f.req('POST', '', { padding: 'a'.repeat(9000) }))).status, 413);
  assert.equal(Number((await query('SELECT count(*) FROM app_users')).rows[0].count), 1);
});

test('new accounts cannot reach any business API even after the demo is unlocked', async () => {
  const f = await fixture(); const owner = await f.login('admin'); const demo = await f.login('user');
  await f.security.changeProtection(f.req('PATCH', owner), false, 1, pool);
  const result = await f.security.registerApp(f.req('POST', demo), registration, pool);
  assert.equal((await f.security.readAppSession(f.req('GET', demo), pool)).authenticated, false, 'account switch revokes old browser session');
  const cookie = `tendly_app_session=${result.token}`;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('new user must not reach providers'); };
  for (const relative of readdirSync('app/api', { recursive: true }).filter(file => file.endsWith('route.ts'))) {
    const file = `app/api/${relative.replaceAll('\\', '/')}`;
    if (['/meta/webhook/', '/auth/', '/inbox/session/', '/security/', '/marketing/schedules/run/'].some(part => file.includes(part))) continue;
    const route = f.load(file);
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
      if (!route[method]) continue;
      const response = await route[method](f.req(method, cookie), { params: Promise.resolve({ id: 'fake', key: 'fake', orderId: 'fake' }) });
      assert.equal(response.status, 403, `${file}:${method}`);
      assert.equal((await response.json()).code, 'SETUP_REQUIRED');
    }
  }
  assert.equal(calls, 0);
  await assert.rejects(f.security.changeProtection(f.req('PATCH', cookie), false, 2, pool), error => error.status === 403);
  await query("UPDATE app_users SET page_id='111' WHERE username=$1", [registration.email.toLowerCase()]);
  assert.equal((await f.security.readAppSession(f.req('GET', cookie), pool)).canUse, false);
});

test('demo Page binding persists through migrations and rejects a different configured Page; old user sessions expire safely', async () => {
  const f = await fixture(); const owner = await f.login('admin'); const demo = await f.login('user');
  await f.security.changeProtection(f.req('PATCH', owner), false, 1, pool);
  await db.exec(readFileSync('db/migrations/013-app-accounts.sql', 'utf8'));
  let session = await f.security.readAppSession(f.req('GET', demo), pool);
  assert.equal(session.pageId, '111'); assert.equal(session.userId, 'demo'); assert.equal(session.needsSetup, false);
  assert.equal(session.canUse, true);
  process.env.PAGE_ID = '222';
  session = await f.security.readAppSession(f.req('GET', demo), pool);
  assert.equal(session.pageId, '111'); assert.equal(session.canUse, false);
  await query('UPDATE app_sessions SET user_id=NULL WHERE role=$1', ['user']);
  assert.equal((await f.security.readAppSession(f.req('GET', demo), pool)).authenticated, false);
});

test('registered accounts reject wrong passwords, expire, revoke after password changes, and registration is throttled', async () => {
  const f = await fixture(); const result = await f.security.registerApp(f.req('POST'), registration, pool);
  const cookie = `tendly_app_session=${result.token}`;
  await assert.rejects(f.security.loginApp(f.req('POST'), registration.email, 'wrong-password', pool), error => error.status === 401);
  await query('UPDATE app_sessions SET expires_at=1');
  assert.equal((await f.security.readAppSession(f.req('GET', cookie), pool)).authenticated, false);
  const login = await f.security.loginApp(f.req('POST'), registration.email, registration.password, pool);
  await query('UPDATE app_users SET password_hash=$1 WHERE username=$2', ['invalidated', registration.email.toLowerCase()]);
  assert.equal((await f.security.readAppSession(f.req('GET', `tendly_app_session=${login.token}`), pool)).authenticated, false);
  await query("UPDATE app_login_attempts SET attempts=10 WHERE bucket='register'");
  await assert.rejects(f.security.registerApp(f.req('POST'), { ...registration, email: 'second@example.com' }, pool), error => error.status === 429);
  await query("UPDATE app_login_attempts SET reset_at=1 WHERE bucket='register'");
  assert.equal((await f.security.registerApp(f.req('POST'), { ...registration, email: 'second@example.com' }, pool)).role, 'user');
});
