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
const envKeys = ['APP_ADMIN_USERNAME', 'APP_ADMIN_PASSWORD_HASH', 'INBOX_ACCESS_KEY', 'DASHBOARD_KEY', 'PAGE_ID', 'PAGE_ACCESS_TOKEN', 'META_GRAPH_VERSION', 'DATABASE_URL'];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const salt = 'a'.repeat(32);
const adminHash = `scrypt$${salt}$${scryptSync('test-admin-password', salt, 64).toString('hex')}`;
after(async () => { await ready; await db.close(); });
afterEach(() => { globalThis.fetch = originalFetch; for (const [key, value] of Object.entries(originalEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });

async function fixture() {
  await ready;
  await db.exec('TRUNCATE app_sessions,app_login_attempts');
  await query("UPDATE app_security_settings SET protection_enabled=true,revision=1,updated_at=1,updated_by='system',automatic_after=1 WHERE id=1");
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
  const req = (method = 'GET', cookie = '', body, extra = {}) => new Request('https://test.example/api/test', {
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
    if (['/meta/webhook/', '/auth/session/', '/inbox/session/', '/security/'].some(part => file.includes(part))) continue;
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
