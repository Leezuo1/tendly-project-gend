import { businessSecurity } from './business-security-fixture.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { afterEach, test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function loader() {
  const cache = new Map();
  const load = (file) => {
    if (file.replaceAll('\\', '/').endsWith('lib/services/appSecurity.ts')) return businessSecurity;
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} }; cache.set(file, loaded);
    const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', compiled)((name) => name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), loaded, loaded.exports);
    return loaded.exports;
  };
  return load;
}
const originalFetch = globalThis.fetch;
const originalEnv = Object.fromEntries(['PAGE_ID', 'PAGE_ACCESS_TOKEN', 'META_GRAPH_VERSION', 'DASHBOARD_KEY', 'NODE_ENV'].map((k) => [k, process.env[k]]));
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [k, v] of Object.entries(originalEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
});
function setup() {
  process.env.PAGE_ID = '111'; process.env.PAGE_ACCESS_TOKEN = 'test-secret'; process.env.META_GRAPH_VERSION = 'v26.0';
  process.env.DASHBOARD_KEY = 'admin-key';
  return loader();
}
const post = (extra = {}) => ({ id: '111_500', message: 'Áo thun cotton\nThông tin đầy đủ', created_time: '2026-10-26T08:00:00+0700',
  full_picture: 'https://scontent.example.com/image.jpg', reactions: { summary: { total_count: 12 } },
  comments: { summary: { total_count: 4 } }, shares: { count: 2 }, ...extra });
const comment = (extra = {}) => ({ id: '500_600', message: 'Áo bao nhiêu shop?', from: { id: '222', name: 'Nguyễn An' },
  created_time: '2026-10-26T09:00:00+0700', like_count: 2, ...extra });

test('post filters use Vietnamese search, inclusive Vietnam dates and never mutate the feed', () => {
  const { filterFacebookPosts } = loader()('lib/utils/facebookPosts.ts');
  const now = Date.parse('2026-10-27T12:00:00Z');
  const posts = [
    { id: 'old', message: 'Áo thun', createdAt: Date.parse('2026-10-20T16:59:59Z'), reactions: 100, comments: 0, shares: 0 },
    { id: 'week', message: 'Áo mới', createdAt: Date.parse('2026-10-20T17:00:00Z'), reactions: null, comments: null, shares: null },
    { id: 'today', message: 'Áo THUN mới', createdAt: Date.parse('2026-10-26T17:00:00Z'), reactions: 0, comments: 5, shares: 0 },
    { id: 'tomorrow', message: 'Túi vải', createdAt: Date.parse('2026-10-27T17:00:00Z'), reactions: 0, comments: 2, shares: 0 },
  ];
  const defaults = { query: '', period: 'all', start: '', end: '', sort: 'newest' };
  const ids = (filters) => filterFacebookPosts(posts, { ...defaults, ...filters }, now).map((p) => p.id);
  assert.deepEqual(ids({ query: 'ao thun' }), ['today', 'old']);
  assert.deepEqual(ids({ period: 'today' }), ['today']);
  assert.deepEqual(ids({ period: 'week' }), ['today', 'week']);
  assert.deepEqual(ids({ period: 'custom', start: '2026-10-21', end: '2026-10-27' }), ['today', 'week']);
  assert.deepEqual(ids({ period: 'custom', start: '2026-10-28', end: '2026-10-27' }), []);
  assert.deepEqual(ids({ period: 'custom', end: '2026-10-20' }), ['old']);
  assert.deepEqual(ids({ sort: 'comments' }), ['today', 'tomorrow', 'week', 'old']);
  assert.deepEqual(ids({ sort: 'engagement' }), ['old', 'today', 'tomorrow', 'week']);
  assert.deepEqual(posts.map((p) => p.id), ['old', 'week', 'today', 'tomorrow']);
});

test('feed reads real published Page posts with counts and opaque pagination; token and next URL stay server-side', async () => {
  const load = setup(); let called;
  globalThis.fetch = async (url, init) => {
    called = new URL(url);
    assert.equal(init.headers.Authorization, 'Bearer test-secret'); assert.equal(init.cache, 'no-store');
    return Response.json({ data: [post()], paging: { next: 'https://graph.facebook.com/next?access_token=do-not-expose', cursors: { after: 'opaque/+=' } } });
  };
  const result = await load('lib/services/facebookFeed.ts').readFacebookFeed('111', 'previous/+');
  assert.equal(called.pathname, '/v26.0/111/published_posts'); assert.equal(called.searchParams.get('after'), 'previous/+');
  assert.equal(called.searchParams.get('limit'), '20'); assert.ok(!called.href.includes('test-secret'));
  assert.deepEqual([result.posts[0].reactions, result.posts[0].comments, result.posts[0].shares], [12, 4, 2]);
  assert.equal(result.posts[0].message, 'Áo thun cotton\nThông tin đầy đủ'); assert.equal(result.after, 'opaque/+=');
  assert.equal(result.posts[0].url, 'https://www.facebook.com/111_500'); assert.ok(!JSON.stringify(result).includes('access_token'));
});

test('missing counts remain unknown, media-only posts work and unsafe image URLs are discarded', async () => {
  const load = setup();
  for (const image of ['javascript:alert(1)', 'http://example.com/x', 'https://user:secret@example.com/x', null]) {
    globalThis.fetch = async () => Response.json({ data: [post({ message: undefined, full_picture: image, reactions: undefined, comments: undefined, shares: undefined })] });
    const { posts } = await load('lib/services/facebookFeed.ts').readFacebookFeed('111');
    assert.equal(posts[0].imageUrl, null); assert.equal(posts[0].message, '');
    assert.deepEqual([posts[0].reactions, posts[0].comments, posts[0].shares], [null, null, null]);
  }
});

test('comments preserve reply nesting, paginate top-level comments and handle hidden author identity', async () => {
  const load = setup(); let called;
  globalThis.fetch = async (url) => {
    called = new URL(url);
    return Response.json({ data: [comment({ comments: { data: [comment({ id: '500_601', from: undefined, message: 'Dạ 150.000đ' })], paging: { next: 'https://graph.facebook.com/more' } } })],
      paging: { next: 'https://graph.facebook.com/more', cursors: { after: 'next-comment' } } });
  };
  const result = await load('lib/services/facebookFeed.ts').readFacebookPostComments('111', '111_500');
  assert.equal(called.pathname, '/v26.0/111_500/comments'); assert.equal(called.searchParams.get('filter'), 'toplevel');
  assert.match(called.searchParams.get('fields'), /comments\.limit\(3\)/);
  assert.equal(result.comments[0].authorName, 'Nguyễn An'); assert.equal(result.comments[0].replies[0].authorName, 'Người dùng Facebook');
  assert.equal(result.comments[0].replies[0].message, 'Dạ 150.000đ'); assert.equal(result.comments[0].hasMoreReplies, true);
  assert.equal(result.after, 'next-comment');
});

test('invalid Graph data and foreign Page posts fail without fabricated data', async () => {
  const load = setup();
  for (const data of [{}, { data: [null] }, { data: [post({ id: '999_500' })] }, { data: [post({ created_time: 'invalid' })] }]) {
    globalThis.fetch = async () => Response.json(data);
    await assert.rejects(load('lib/services/facebookFeed.ts').readFacebookFeed('111'));
  }
  globalThis.fetch = async () => new Response('provider detail with test-secret', { status: 400 });
  await assert.rejects(load('lib/services/facebookFeed.ts').readFacebookFeed('111'), (error) => !error.message.includes('test-secret'));
});

test('API protects access and rejects foreign post IDs and invalid cursors before making Graph requests', async () => {
  const load = setup(); let requests = 0;
  globalThis.fetch = async () => { requests++; return Response.json({ data: [] }); };
  const route = load('app/api/facebook/posts/route.ts');
  const request = (query = '', key = 'admin-key') => new Request('http://localhost/api/facebook/posts' + query, { headers: { Authorization: `Bearer ${key}` } });
  for (const query of ['?postId=999_500', '?postId=', '?postId=111_500/other', '?after=', '?after=' + 'a'.repeat(2049), '?after=%00']) {
    assert.equal((await route.GET(request(query))).status, 400, query.slice(0, 40));
  }
  assert.equal(requests, 0);
  const response = await route.GET(request());
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { posts: [], after: null });
  delete process.env.PAGE_ID;
  assert.equal((await route.GET(request())).status, 503);
  process.env.NODE_ENV = 'production'; delete process.env.DASHBOARD_KEY;
  assert.equal((await route.GET(request())).status, 503);
});
