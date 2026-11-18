import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
const load = (file) => {
  if (cache.has(file)) return cache.get(file).exports;
  const loaded = { exports: {} }; cache.set(file, loaded);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)((name) => name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name), loaded, loaded.exports);
  return loaded.exports;
};
const { isReadableImage, loadMessageImages, buildImageInput } = load('lib/services/imageIntake.ts');

const photo = { type: 'image', url: 'https://scontent.xx.fbcdn.net/v/p.jpg' };
const bytes = (size) => new Uint8Array(size).fill(65);
const reply = (body, type = 'image/jpeg', headers = {}) => new Response(body, { status: 200, headers: { 'content-type': type, ...headers } });
const ok = async () => reply(bytes(3));

test('loads readable images as base64 and flags every violation as unreadable', async () => {
  const calls = [];
  const spy = async (url, init) => { calls.push({ url, init }); return reply(bytes(3)); };
  assert.deepEqual(await loadMessageImages([photo], spy), { images: [{ mimeType: 'image/jpeg', data: 'QUFB' }], unreadable: false });
  assert.equal(calls[0].init.redirect, 'error', 'a redirect to another host is never followed');
  assert.ok(calls[0].init.signal, 'every download has a timeout');
  assert.deepEqual(await loadMessageImages([photo, { ...photo, url: 'https://lookaside.fbsbx.com/x.png' }], async (url) => reply(bytes(3), url.endsWith('.png') ? 'image/png' : 'image/webp')),
    { images: [{ mimeType: 'image/webp', data: 'QUFB' }, { mimeType: 'image/png', data: 'QUFB' }], unreadable: false }, 'keeps the order of the photos');
  const bad = {
    'http URL': [{ type: 'image', url: 'http://scontent.xx.fbcdn.net/p.jpg' }, ok],
    'lookalike host evilfbcdn.net': [{ type: 'image', url: 'https://evilfbcdn.net/p.jpg' }, ok],
    'host fbcdn.net.evil.com': [{ type: 'image', url: 'https://fbcdn.net.evil.com/p.jpg' }, ok],
    'download error': [photo, async () => { throw new Error('network'); }],
    'not an image': [photo, async () => reply('<html>', 'text/html')],
    'unsupported type': [photo, async () => reply(bytes(3), 'image/gif')],
    'over 4 MB': [photo, async () => reply(bytes(4 * 1024 * 1024 + 1))],
    'declared over 4 MB': [photo, async () => reply(bytes(3), 'image/jpeg', { 'content-length': String(5 * 1024 * 1024) })],
    'HTTP error': [photo, async () => new Response('', { status: 404, headers: { 'content-type': 'image/jpeg' } })],
  };
  for (const [name, [attachment, transport]] of Object.entries(bad)) assert.deepEqual(await loadMessageImages([attachment], transport), { images: [], unreadable: true }, name);
  assert.deepEqual(await loadMessageImages([photo, photo, photo], ok), { images: Array(3).fill({ mimeType: 'image/jpeg', data: 'QUFB' }), unreadable: false }, 'exactly 3 is fine');
  assert.deepEqual(await loadMessageImages([photo, photo, photo, photo], ok), { images: [], unreadable: true }, 'more than 3 photos');
  assert.deepEqual(await loadMessageImages([photo, { type: 'image', url: 'https://evilfbcdn.net/p.jpg' }], ok), { images: [], unreadable: true }, 'one bad photo spoils the batch');
});

test('photos download in parallel, not one after another', async () => {
  let running = 0, peak = 0;
  const slow = async () => { running++; peak = Math.max(peak, running); await new Promise((resolve) => setTimeout(resolve, 20)); running--; return reply(bytes(3)); };
  await loadMessageImages([photo, photo, photo], slow);
  assert.equal(peak, 3);
});

test('isReadableImage rejects stickers, non-images and URL-less attachments', () => {
  assert.equal(isReadableImage(photo), true);
  assert.equal(isReadableImage({ ...photo, sticker: true }), false);
  assert.equal(isReadableImage({ type: 'video', url: photo.url }), false);
  assert.equal(isReadableImage({ type: 'image' }), false);
  assert.equal(isReadableImage({ type: 'image', url: 'http://scontent.xx.fbcdn.net/p.jpg' }), false);
});

test('buildImageInput is undefined when any attachment is not a readable image', async () => {
  for (const attachments of [[photo, { type: 'video', url: photo.url }], [{ ...photo, sticker: true }], [{ type: 'file', url: photo.url }], []]) {
    assert.equal(await buildImageInput(attachments, 'x', ok), undefined);
  }
  assert.deepEqual(await buildImageInput([photo], '', ok), { images: [{ mimeType: 'image/jpeg', data: 'QUFB' }], unreadable: false, count: 1, hasText: false });
  assert.equal((await buildImageInput([photo], '  giá bao nhiêu ', ok)).hasText, true);
  const unreadable = await buildImageInput([photo, { type: 'image', url: 'https://evilfbcdn.net/p.jpg' }], 'x', ok);
  assert.deepEqual([unreadable.unreadable, unreadable.count, unreadable.images], [true, 2, []]);
});

const { imageOutcome, applyImageOutcome, unreadableImageResult, IMAGE_KIND_ACTIONS, HANDOFF_REPLY, DECLINE_REPLY } = load('lib/services/imageIntake.ts');
const { parseAiAnalysis } = load('lib/services/aiAnalysis.ts');

test('outcome table: product answers, support kinds hand off, unrelated declines only without text', () => {
  assert.deepEqual(IMAGE_KIND_ACTIONS, { product: 'answer', defect: 'handoff', receipt: 'handoff', other_support: 'handoff', unrelated: 'decline' });
  assert.equal(imageOutcome(['product'], 1, false), 'answer');
  for (const kind of ['defect', 'receipt', 'other_support']) assert.equal(imageOutcome([kind], 1, true), 'handoff', kind);
  assert.equal(imageOutcome(['unrelated'], 1, false), 'decline');
  assert.equal(imageOutcome(['unrelated'], 1, true), 'answer', 'a text question is answered normally, not declined');
  assert.equal(imageOutcome(['product', 'receipt'], 2, false), 'handoff');
  assert.equal(imageOutcome(['product', 'unrelated'], 2, false), 'answer');
  assert.equal(imageOutcome(['unrelated', 'unrelated'], 2, false), 'decline');
});

test('malformed imageKinds fail closed to handoff', () => {
  for (const [kinds, count] of [[undefined, 1], [[], 1], [['product', 'product'], 1], [['lạ'], 1], ['product', 1], [[null], 1], [['PRODUCT'], 1], [['product'], 2]]) {
    assert.equal(imageOutcome(kinds, count, true), 'handoff', JSON.stringify(kinds));
  }
});

test('applyImageOutcome replaces the reply with the fixed template and sets the flags', () => {
  assert.equal(HANDOFF_REPLY, 'Shop đã nhận được hình ảnh của bạn. Nhân viên sẽ kiểm tra và phản hồi bạn sớm nhất có thể nhé.');
  assert.equal(DECLINE_REPLY, 'Mình chưa xử lý được hình ảnh này. Bạn mô tả bằng tin nhắn hoặc gửi ảnh sản phẩm bạn quan tâm giúp shop nhé.');
  const make = () => ({ reply: 'Câu do model viết, hứa giảm 50%.', analysis: { sentiment: 'neutral', emotion: 'neutral', priority: 'normal', priorityScore: 40, reason: 'x', needsHuman: false, canAutoReply: false } });
  const handoff = make(); applyImageOutcome(handoff, 'handoff');
  assert.equal(handoff.reply, HANDOFF_REPLY);
  assert.deepEqual([handoff.analysis.imageOutcome, handoff.analysis.canAutoReply, handoff.analysis.needsHuman, handoff.analysis.priority], ['handoff', true, true, 'high']);
  assert.ok(handoff.analysis.priorityScore >= 80);
  const decline = make(); decline.analysis.needsHuman = true; applyImageOutcome(decline, 'decline');
  assert.equal(decline.reply, DECLINE_REPLY);
  assert.deepEqual([decline.analysis.imageOutcome, decline.analysis.canAutoReply, decline.analysis.needsHuman, decline.analysis.priority], ['decline', true, false, 'low']);
});

test('parseAiAnalysis keeps imageKinds all-or-nothing and ignores a model-set imageOutcome', () => {
  const base = { sentiment: 'neutral', emotion: 'neutral', priority: 'normal', needsHuman: false, reason: 'x' };
  const parsed = parseAiAnalysis({ ...base, imageKinds: ['product', 'receipt', 'unrelated'], imageOutcome: 'decline' });
  assert.deepEqual(parsed.imageKinds, ['product', 'receipt', 'unrelated']);
  assert.equal('imageOutcome' in parsed, false);
  // One bad value, or more than 3, drops the whole list so the outcome fails closed to handoff instead of answering a trimmed list.
  for (const kinds of [['product', 'bogus', 'product'], ['product', 'lạ'], ['product', 'product', 'product', 'defect'], ['PRODUCT'], [null]]) {
    const dropped = parseAiAnalysis({ ...base, imageKinds: kinds });
    assert.equal('imageKinds' in dropped, false, JSON.stringify(kinds));
    assert.equal(imageOutcome(dropped.imageKinds, kinds.length, true), 'handoff', JSON.stringify(kinds));
  }
  assert.equal('imageKinds' in parseAiAnalysis(base), false);
  assert.equal('imageKinds' in parseAiAnalysis({ ...base, imageKinds: 'product' }), false);
});

test('unreadableImageResult hands off without a model', () => {
  const result = unreadableImageResult();
  assert.equal(result.reply, HANDOFF_REPLY);
  assert.deepEqual([result.model, result.analysis.imageOutcome, result.analysis.needsHuman, result.analysis.priority], ['none', 'handoff', true, 'high']);
  assert.match(result.analysis.reason, /Không đọc được ảnh/);
});

test('generateGeminiJson sends images as inline_data parts and leaves text-only calls unchanged', async () => {
  const { generateGeminiJson } = load('lib/services/gemini.ts');
  const originalFetch = globalThis.fetch, keys = { GEMINI_API_KEY: process.env.GEMINI_API_KEY, GEMINI_MODEL: process.env.GEMINI_MODEL };
  const bodies = [];
  process.env.GEMINI_API_KEY = 'test-key'; process.env.GEMINI_MODEL = 'test-model';
  globalThis.fetch = async (_url, init) => { bodies.push(JSON.parse(init.body)); return Response.json({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }); };
  try {
    const call = (images) => generateGeminiJson({ role: 'sourcing', system: 's', user: 'u', schema: {}, parse: (text) => JSON.parse(text), ...(images ? { images } : {}) });
    await call([{ mimeType: 'image/png', data: 'QUJD' }, { mimeType: 'image/jpeg', data: 'REVG' }]);
    await call();
    await call([]);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(keys)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
  assert.deepEqual(bodies[0].contents[0].parts, [{ text: 'u' }, { inline_data: { mime_type: 'image/png', data: 'QUJD' } }, { inline_data: { mime_type: 'image/jpeg', data: 'REVG' } }]);
  assert.deepEqual(bodies[1].contents[0].parts, [{ text: 'u' }]);
  assert.deepEqual(bodies[2].contents[0].parts, [{ text: 'u' }]);
});
