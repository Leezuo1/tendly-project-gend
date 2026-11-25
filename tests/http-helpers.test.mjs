import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
// Same loader seam as the other tests: compile on the fly, resolve '@/x' to 'x.ts'.
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const loaded = { exports: {} }; cache.set(file, loaded);
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', compiled)(name => name.startsWith('@/') ? load(`${name.slice(2)}.ts`) : require(name), loaded, loaded.exports);
  return loaded.exports;
}

const { parseJsonObject } = load('lib/http/body.ts');
class Fail extends Error {}

test('parseJsonObject returns plain objects', () => {
  assert.deepEqual(parseJsonObject('{"a":1}', () => new Fail()), { a: 1 });
});

test('parseJsonObject rejects null, arrays, scalars and broken JSON with the caller error', () => {
  for (const raw of ['null', '[]', '"x"', '1', '{oops', '']) {
    assert.throws(() => parseJsonObject(raw, () => new Fail('bad')), error => error instanceof Fail && error.message === 'bad', raw);
  }
});

// Behaviour pinned before the error mapping was shared: [error, status, body, cache-control header].
async function shape(response) {
  return [response.status, await response.json(), response.headers.get('cache-control')];
}
const silenced = async run => { const original = console.error; console.error = () => {}; try { return await run(); } finally { console.error = original; } };

test('marketingErrorResponse keeps every status, body and header', async () => {
  const { marketingErrorResponse } = load('lib/services/marketingApi.ts');
  const { AppSecurityError } = load('lib/services/appSecurity.ts');
  const { MarketingWorkflowError } = load('lib/services/marketingBrief.ts');
  const { InvalidAiKnowledge } = load('lib/services/aiKnowledge.ts');
  const { MessengerSendError } = load('lib/services/messengerSend.ts');
  const { GeminiNotConfigured, GeminiUnavailable } = load('lib/services/gemini.ts');
  const { MarketingNotConfigured, InvalidMarketingRequest } = load('lib/services/marketingApi.ts');
  const cases = [
    [new AppSecurityError('sec', 401, 'X'), 401, { error: 'sec', code: 'X' }, 'no-store'],
    [new MarketingWorkflowError('flow', 422), 422, { error: 'flow' }, null],
    [new InvalidMarketingRequest('bad'), 400, { error: 'bad' }, null],
    [new InvalidAiKnowledge('kn'), 400, { error: 'kn' }, null],
    [new MarketingNotConfigured('cfg'), 503, { error: 'cfg', code: 'NO_CONFIG' }, null],
    [new MessengerSendError('send', 429), 429, { error: 'send' }, null],
    [new GeminiNotConfigured('nokey'), 503, { error: 'nokey' }, null],
    [new GeminiUnavailable('down'), 502, { error: 'down' }, null],
    [Object.assign(new Error('pg detail postgres://secret'), { code: '42P01' }), 503,
      { error: 'Database chưa có đủ bảng. Chạy npm run db:migrate rồi thử lại.', code: 'NO_TABLE' }, null],
    [new Error('postgres://user:secret@host'), 503, { error: 'Không đọc được dữ liệu. Vui lòng thử lại.' }, null],
  ];
  for (const [error, status, body, cache] of cases) {
    assert.deepEqual(await silenced(async () => shape(marketingErrorResponse(error))), [status, body, cache], error.message);
  }
});

test('postsErrorResponse keeps every status, body and header', async () => {
  const { postsErrorResponse } = load('lib/services/postsApi.ts');
  const { AppSecurityError } = load('lib/services/appSecurity.ts');
  const { MarketingWorkflowError } = load('lib/services/marketingBrief.ts');
  const { InvalidPostRequest } = load('lib/services/aiPost.ts');
  const { InvalidPostImage, ImageGenerationFailed } = load('lib/services/postImages.ts');
  const { PostNotFound, PostLocked, PostsDatabaseNotConfigured } = load('lib/services/postsPostgres.ts');
  const { FacebookNotConfigured, FacebookPublishFailed } = load('lib/services/facebookPage.ts');
  const cases = [
    [new AppSecurityError('sec', 403, 'APP_PROTECTED'), 403, { error: 'sec', code: 'APP_PROTECTED' }, 'no-store'],
    [new MarketingWorkflowError('flow', 409), 409, { error: 'flow' }, null],
    [new InvalidPostRequest('post'), 400, { error: 'post' }, null],
    [new InvalidPostImage('img'), 400, { error: 'img' }, null],
    [new ImageGenerationFailed('gen'), 502, { error: 'gen' }, null],
    [new PostNotFound('nf'), 404, { error: 'nf' }, null],
    [new PostLocked('lock'), 409, { error: 'lock' }, null],
    [new PostsDatabaseNotConfigured('x'), 503, { error: 'Chưa kết nối database (DATABASE_URL) nên chưa lưu được bài viết.', code: 'NO_DATABASE' }, null],
    [new FacebookNotConfigured('nofb'), 503, { error: 'nofb', code: 'NO_FACEBOOK' }, null],
    [new FacebookPublishFailed('pub'), 502, { error: 'pub' }, null],
    [Object.assign(new Error('pg'), { code: '42P01' }), 503,
      { error: 'Database chưa có đủ bảng bài đăng (marketing_posts, marketing_post_images). Chạy npm run db:migrate rồi thử lại.', code: 'NO_TABLE' }, null],
    [new Error('postgres://user:secret@host'), 503, { error: 'Không truy cập được database. Vui lòng thử lại.' }, null],
  ];
  for (const [error, status, body, cache] of cases) {
    assert.deepEqual(await silenced(async () => shape(postsErrorResponse(error))), [status, body, cache], error.message);
  }
});

test('liveErrorResponse keeps no-store only on live branches and falls back to marketing', async () => {
  const { liveErrorResponse } = load('lib/services/live/api.ts');
  const { LiveError } = load('lib/services/live/engine.ts');
  const { LivePreparationError } = load('lib/services/live/preparation.ts');
  const { FacebookCommentError } = load('lib/services/facebookComments.ts');
  const { GeminiUnavailable } = load('lib/services/gemini.ts');
  const cases = [
    [new LivePreparationError('prep'), 400, { error: 'prep' }, 'no-store'],
    [new LiveError('live', 409, 'CODE'), 409, { error: 'live', code: 'CODE' }, 'no-store'],
    [new LiveError('live2'), 400, { error: 'live2' }, 'no-store'],
    [new FacebookCommentError('fb', 502), 502, { error: 'fb' }, 'no-store'],
    [new GeminiUnavailable('down'), 502, { error: 'down' }, null],
  ];
  for (const [error, status, body, cache] of cases) {
    assert.deepEqual(await silenced(async () => shape(liveErrorResponse(error))), [status, body, cache], error.message);
  }
});

test('errorJson, mapError and isMissingTable', async () => {
  const { errorJson, mapError, rule, isMissingTable } = load('lib/http/errors.ts');
  assert.deepEqual(await shape(errorJson('x', 400, { code: 'C' })), [400, { error: 'x', code: 'C' }, null]);
  assert.deepEqual(await shape(errorJson('x', 418)), [418, { error: 'x' }, null]);
  assert.deepEqual(await shape(errorJson('x', 400, { noStore: true })), [400, { error: 'x' }, 'no-store']);
  class A extends Error {} class B extends A {}
  const rules = [rule(B, () => errorJson('b', 501)), rule(A, e => errorJson(e.message, 502))];
  assert.equal((await shape(mapError(new B('m'), rules)))[1].error, 'b');
  assert.equal((await shape(mapError(new A('m'), rules)))[1].error, 'm');
  assert.equal(mapError(new Error('z'), rules), undefined);
  assert.equal(isMissingTable({ code: '42P01' }), true);
  assert.equal(isMissingTable({ code: 'x' }), false);
  assert.equal(isMissingTable(null), false);
});

test('createPool applies the shared limits and the caller connection timeout', async () => {
  const { createPool } = load('lib/db/pool.ts');
  process.env.DATABASE_URL = 'postgresql://user:pw@127.0.0.1:1/db';
  const pool = createPool({ label: 'Test', connectionTimeoutMillis: 1234 });
  try {
    assert.equal(pool.options.max, 3);
    assert.equal(pool.options.connectionTimeoutMillis, 1234);
    assert.equal(pool.options.idleTimeoutMillis, 5000);
    assert.equal(pool.options.statement_timeout, 8000);
  } finally { await pool.end(); }
});

test('graphCredentials trims, validates the version and graphUrl builds Graph URLs', () => {
  const { graphCredentials, graphUrl } = load('lib/services/graph.ts');
  const saved = { token: process.env.PAGE_ACCESS_TOKEN, version: process.env.META_GRAPH_VERSION };
  try {
    Object.assign(process.env, { PAGE_ACCESS_TOKEN: ' tok ', META_GRAPH_VERSION: ' v23.0 ' });
    assert.deepEqual(graphCredentials(), { token: 'tok', version: 'v23.0' });
    process.env.META_GRAPH_VERSION = '23';
    assert.equal(graphCredentials(), null);
    Object.assign(process.env, { PAGE_ACCESS_TOKEN: '  ', META_GRAPH_VERSION: 'v23.0' });
    assert.equal(graphCredentials(), null);
    delete process.env.PAGE_ACCESS_TOKEN;
    assert.equal(graphCredentials(), null);
  } finally {
    for (const [key, value] of [['PAGE_ACCESS_TOKEN', saved.token], ['META_GRAPH_VERSION', saved.version]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
  assert.equal(graphUrl('v23.0', '222/messages'), 'https://graph.facebook.com/v23.0/222/messages');
});
