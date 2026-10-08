import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function loadModules(overrides = {}) {
  const cache = new Map();
  const load = (file) => {
    if (overrides[file]) return overrides[file];
    if (cache.has(file)) return cache.get(file).exports;
    const loadedModule = { exports: {} };
    cache.set(file, loadedModule);
    const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', compiled)(
      (name) => name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), loadedModule, loadedModule.exports);
    return loadedModule.exports;
  };
  return load;
}
const event = (mid = 'm1', timestamp = 100, extra = {}) => ({
  sender: { id: '222' }, recipient: { id: '111' }, timestamp,
  message: { mid, text: 'Shop có áo không? 😊', ...extra },
});
const payload = (...events) => ({ object: 'page', entry: [{ id: '111', messaging: events }] });
const signature = (raw, secret = 'test-secret') => 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');

test('signature authenticates exact raw UTF-8 bytes and rejects missing, malformed or changed signatures', () => {
  const { verifyMetaSignature } = loadModules()('lib/services/metaWebhook.ts');
  const raw = Buffer.from(JSON.stringify(payload(event())));
  assert.equal(verifyMetaSignature(raw, signature(raw), 'test-secret'), true);
  for (const sig of [null, 'sha256=oops', signature(raw, 'other-secret')]) {
    assert.equal(verifyMetaSignature(raw, sig, 'test-secret'), false);
  }
  assert.equal(verifyMetaSignature(Buffer.concat([raw, Buffer.from(' ')]), signature(raw), 'test-secret'), false);
});

test('parser scopes Page, ignores receipts, distinguishes echoes and keeps attachment-only messages', () => {
  const { parseMetaMessages } = loadModules()('lib/services/metaWebhook.ts');
  const echo = { ...event('m2'), sender: { id: '111' }, recipient: { id: '222' }, message: { mid: 'm2', is_echo: true, text: 'Shop trả lời' } };
  const attachment = event('m3', 101, { text: undefined, attachments: [{ type: 'image', payload: { url: 'https://example.com/image.jpg' } }] });
  const input = payload(event(), echo, attachment, { delivery: { mids: ['m1'] } });
  input.entry.push({ id: '999', messaging: [event('other-page')] });
  const result = parseMetaMessages(input, '111');
  assert.equal(result.length, 3);
  assert.deepEqual(result.map((m) => [m.direction, m.psid]), [['in', '222'], ['out', '222'], ['in', '222']]);
  assert.equal(result[2].text, '');
  assert.equal(result[2].attachments[0].type, 'image');
  assert.throws(() => parseMetaMessages(payload(event('bad', -1)), '111'));
  assert.throws(() => parseMetaMessages({ object: 'page', entry: null }, '111'));
});

test('webhook verifies challenges, rejects untrusted payloads, writes only signed messages and returns retryable storage errors', async () => {
  const names = ['APP_SECRET', 'PAGE_ID', 'VERIFY_TOKEN', 'DATABASE_URL', 'VERCEL'];
  const old = Object.fromEntries(names.map((key) => [key, process.env[key]]));
  const stored = new Map();
  let failStorage = false;
  try {
    process.env.DATABASE_URL = 'postgresql://test-only'; delete process.env.VERCEL;
    process.env.APP_SECRET = 'test-secret'; process.env.PAGE_ID = '111'; process.env.VERIFY_TOKEN = 'test-verify';
    const load = loadModules({
      'lib/services/messengerPostgres.ts': {
        async savePostgresMessages(messages) {
          if (failStorage) throw new Error('Storage unavailable');
          for (const message of messages) stored.set(message.messageId, message);
        },
      },
    });
    const route = load('app/api/meta/webhook/route.ts');
    const get = (query) => route.GET(new Request('http://localhost/api/meta/webhook?' + query));
    const valid = await get('hub.mode=subscribe&hub.verify_token=test-verify&hub.challenge=12345');
    assert.equal(valid.status, 200); assert.equal(await valid.text(), '12345');
    assert.equal((await get('hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1')).status, 403);
    const post = (raw, sig = signature(raw)) => route.POST(new Request('http://localhost/api/meta/webhook', {
      method: 'POST', headers: { 'x-hub-signature-256': sig }, body: raw,
    }));
    const raw = JSON.stringify(payload(event()));
    assert.equal((await post(raw, 'sha256=bad')).status, 403);
    assert.equal((await post('{')).status, 400);
    assert.equal((await post(JSON.stringify(payload(event('bad', -1))))).status, 400);
    assert.equal((await post('x'.repeat(1024 * 1024 + 1))).status, 413);
    assert.equal((await post(raw)).status, 200);
    assert.equal((await post(raw)).status, 200);
    assert.equal(stored.size, 1);
    assert.equal(stored.get('m1').text, event().message.text);
    failStorage = true;
    assert.equal((await post(raw)).status, 503);
    delete process.env.DATABASE_URL;
    assert.equal((await post(raw)).status, 503);
    process.env.VERCEL = '1';
    const missingDatabase = await post(raw);
    assert.equal(missingDatabase.status, 503);
    assert.match((await missingDatabase.json()).error, /DATABASE_URL/);
    delete process.env.VERCEL;
    delete process.env.APP_SECRET;
    assert.equal((await post(raw)).status, 503);
    delete process.env.VERIFY_TOKEN;
    assert.equal((await get('hub.mode=subscribe')).status, 503);
  } finally {
    for (const key of names) { if (old[key] === undefined) delete process.env[key]; else process.env[key] = old[key]; }
  }
});
