import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { after, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
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
const images = load('lib/services/productImages.ts');
const { keepNamedProducts, photoImageIds } = load('lib/services/productPhotos.ts');
const { parseSendRequest } = load('lib/services/messengerSendRequest.ts');
const { addProductImage, listProductImages, readProductImage, deleteProductImage, readPhotoCandidates, ProductImageError } = images;
const wrap = (db) => ({ query: async (sql, values) => { const result = await db.query(sql, values); return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length }; } });
const bare = new PGlite(), full = new PGlite();
const ready = full.exec(readFileSync('db/migrations/027-shop-product-images.sql', 'utf8') + readFileSync('db/migrations/002-messenger-outbound.sql', 'utf8'));
after(async () => { await ready; await bare.close(); await full.close(); });

const jpeg = (fill = 1) => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, fill, fill, fill, fill]);
const png = () => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

test('adds, lists in upload order and reads back the bytes', async () => {
  await ready; const db = wrap(full);
  const first = await addProductImage('111', 'p-1', jpeg(1), db);
  const second = await addProductImage('111', 'p-1', png(), db);
  assert.match(first.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual((await listProductImages('111', 'p-1', db)).map((image) => image.id), [first.id, second.id]);
  const read = await readProductImage('111', first.id, db);
  assert.equal(read.mime, 'image/jpeg');
  assert.deepEqual([...read.data], [...jpeg(1)]);
  assert.equal((await readProductImage('111', second.id, db)).mime, 'image/png');
});

test('rejects a 4th image for the same product with 409 and stores nothing', async () => {
  await ready; const db = wrap(full);
  for (let i = 0; i < 3; i++) await addProductImage('111', 'p-full', jpeg(i + 1), db);
  await assert.rejects(addProductImage('111', 'p-full', jpeg(9), db), (error) => error instanceof ProductImageError && error.status === 409);
  assert.equal((await listProductImages('111', 'p-full', db)).length, 3);
});

test('rejects non-images and files over 4 MB with 400', async () => {
  await ready; const db = wrap(full);
  await assert.rejects(addProductImage('111', 'p-bad', new TextEncoder().encode('<html>hello</html>'), db), (error) => error instanceof ProductImageError && error.status === 400);
  await assert.rejects(addProductImage('111', 'p-bad', new Uint8Array(0), db), (error) => error instanceof ProductImageError && error.status === 400);
  const big = new Uint8Array(4 * 1024 * 1024 + 1); big.set([0xff, 0xd8, 0xff]);
  await assert.rejects(addProductImage('111', 'p-bad', big, db), (error) => error instanceof ProductImageError && error.status === 400);
  assert.deepEqual(await listProductImages('111', 'p-bad', db), []);
});

test('other products and other pages are isolated', async () => {
  await ready; const db = wrap(full);
  const mine = await addProductImage('111', 'p-iso', jpeg(5), db);
  assert.deepEqual(await listProductImages('111', 'p-other', db), []);
  assert.deepEqual(await listProductImages('222', 'p-iso', db), []);
  assert.equal(await readProductImage('222', mine.id, db), null);
  assert.equal(await deleteProductImage('222', mine.id, db), false);
  assert.equal((await listProductImages('111', 'p-iso', db)).length, 1);
});

test('delete removes the image and returns false for an unknown id', async () => {
  await ready; const db = wrap(full);
  const image = await addProductImage('111', 'p-del', jpeg(6), db);
  assert.equal(await deleteProductImage('111', image.id, db), true);
  assert.equal(await readProductImage('111', image.id, db), null);
  assert.equal(await deleteProductImage('111', 'no-such-id', db), false);
});

test('product ids with colons like shopee:1:2:3 work', async () => {
  await ready; const db = wrap(full);
  const image = await addProductImage('111', 'shopee:1:2:3', jpeg(7), db);
  assert.deepEqual((await listProductImages('111', 'shopee:1:2:3', db)).map((item) => item.id), [image.id]);
});

const candidates = [
  { productId: 'p1', name: 'Áo thun Đen Basic', sku: 'AT-01', imageIds: ['a', 'b'] },
  { productId: 'p2', name: 'Đầm hoa', sku: 'DM-02', imageIds: ['c'] },
];

test('keepNamedProducts keeps only picked products that the reply names (case ignored, accents kept)', () => {
  const kept = (picked, reply) => keepNamedProducts(picked, candidates, reply).map((item) => item.productId);
  assert.deepEqual(kept(['p1', 'p2', 'zzz'], 'Mẫu ÁO THUN ĐEN BASIC còn size M ạ'), ['p1'], 'unknown ids and products the reply does not name are dropped');
  assert.deepEqual(kept(['p2'], 'Đầm hoa này xinh lắm'), ['p2']);
  assert.deepEqual(kept(['p2'], 'Mã dm-02 nhé'), ['p2'], 'the SKU also counts');
  assert.deepEqual(kept(['p1', 'p2'], 'Còn hàng ạ'), []);
  assert.deepEqual(kept(['p2', 'p2', 'p1'], 'đầm hoa và áo thun đen basic'), ['p2', 'p1'], 'picked order, no duplicates');
});

test('keepNamedProducts matches whole words only, keeps accents for names and ignores tiny SKUs', () => {
  const pool = [
    { productId: 'q', name: 'Quần', sku: 'Q-77', imageIds: ['q1'] },
    { productId: 'd', name: 'Đầm', sku: 'M', imageIds: ['d1'] },
    { productId: 's', name: 'Áo sơ mi', sku: 'AT-01', imageIds: ['s1'] },
  ];
  const kept = (picked, reply) => keepNamedProducts(picked, pool, reply).map((item) => item.productId);
  assert.deepEqual(kept(['q'], 'Dạ em quan tâm hỗ trợ bạn ạ'), [], 'Quần is not "quan tâm"');
  assert.deepEqual(kept(['d'], 'Shop đảm bảo hàng chuẩn, size M còn ạ'), [], 'Đầm is not "đảm bảo", and a one-letter SKU never counts');
  assert.deepEqual(kept(['s'], 'Mã AT-012 còn hàng'), [], 'a SKU must not match inside a longer code');
  assert.deepEqual(kept(['q'], 'Dạ mẫu Quần này đang có ạ'), ['q']);
  assert.deepEqual(kept(['s'], 'Mã at-01 bên mình còn ạ'), ['s'], 'SKU matches by whole word, any case');
});

test('photoImageIds takes the first image of each product before any second image', () => {
  assert.deepEqual(photoImageIds([{ imageIds: ['a', 'b'] }, { imageIds: ['c'] }]), ['a', 'c', 'b']);
  assert.deepEqual(photoImageIds([{ imageIds: ['a', 'b'] }, { imageIds: ['c'] }], 2), ['a', 'c']);
  assert.deepEqual(photoImageIds([]), []);
});

test('readPhotoCandidates offers unsent images first and still offers the sent ones again', async () => {
  await ready; const db = wrap(full);
  const products = [{ id: 'p-c1', name: 'A', sku: 'A' }, { id: 'p-c2', name: 'B', sku: 'B' }, { id: 'p-c3', name: 'C', sku: 'C' }];
  const one = await addProductImage('111', 'p-c1', jpeg(1), db), two = await addProductImage('111', 'p-c1', jpeg(2), db);
  const solo = await addProductImage('111', 'p-c2', jpeg(3), db);
  assert.deepEqual(await readPhotoCandidates('111', '900', products, db), [
    { productId: 'p-c1', name: 'A', sku: 'A', imageIds: [one.id, two.id] }, { productId: 'p-c2', name: 'B', sku: 'B', imageIds: [solo.id] }], 'p-c3 has no image');
  const sent = (id, status, psid = '900') => db.query("INSERT INTO messenger_outbound_requests(page_id,request_id,psid,text,status,created_at) VALUES('111',$1,$2,$3,$4,1)",
    [crypto.randomUUID(), psid, '[ảnh] ' + id, status]);
  await sent(one.id, 'sent'); await sent(solo.id, 'unknown'); await sent(two.id, 'failed'); await sent(two.id, 'sent', '901');
  assert.deepEqual(await readPhotoCandidates('111', '900', products, db), [{ productId: 'p-c1', name: 'A', sku: 'A', imageIds: [two.id, one.id] }, { productId: 'p-c2', name: 'B', sku: 'B', imageIds: [solo.id] }],
    'unsent images come first, sent and unknown ones follow so they can be sent again; failed ones and other customers do not count as sent');
  await sent(two.id, 'sending');
  assert.deepEqual(await readPhotoCandidates('111', '900', products, db), [{ productId: 'p-c1', name: 'A', sku: 'A', imageIds: [one.id, two.id] }, { productId: 'p-c2', name: 'B', sku: 'B', imageIds: [solo.id] }], 'in-flight or cut-off sends count as sent, so they keep their place at the end');
});

test('before migration 027 readPhotoCandidates returns [] instead of failing', async () => {
  assert.deepEqual(await readPhotoCandidates('111', '900', [{ id: 'p', name: 'A', sku: 'A' }], wrap(bare)), []);
});

const UUID = '11111111-1111-4111-8111-111111111111', IMAGE_ID = '22222222-2222-4222-8222-222222222222';
const json = (body) => new Request('http://localhost/api/messenger/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const multipart = (fields, file) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  if (file) form.append('file', file);
  return new Request('http://localhost/api/messenger/send', { method: 'POST', body: form });
};
const rejects = (promise, status) => assert.rejects(promise, (error) => error.status === status);

test('parseSendRequest reads text, product image and device file requests', async () => {
  assert.deepEqual(await parseSendRequest(json({ psid: '222', text: '  Chào  ', requestId: UUID })), { kind: 'text', psid: '222', requestId: UUID, text: 'Chào' });
  assert.deepEqual(await parseSendRequest(json({ psid: '222', imageId: IMAGE_ID, requestId: UUID })), { kind: 'product', psid: '222', requestId: UUID, imageId: IMAGE_ID });
  const file = await parseSendRequest(multipart({ psid: '222', requestId: UUID }, new File([jpeg(3)], 'a.jpg', { type: 'image/jpeg' })));
  assert.equal(file.kind, 'file'); assert.equal(file.mime, 'image/jpeg'); assert.deepEqual([...file.data], [...jpeg(3)]);
});

test('parseSendRequest rejects malformed requests with 400 and oversized ones with 413', async () => {
  await rejects(parseSendRequest(json({ psid: '222', text: '   ', requestId: UUID })), 400);
  await rejects(parseSendRequest(json({ psid: '222', text: 'a', imageId: IMAGE_ID, requestId: UUID })), 400);
  await rejects(parseSendRequest(json({ psid: '222', requestId: UUID })), 400);
  await rejects(parseSendRequest(json({ psid: 'abc', text: 'a', requestId: UUID })), 400);
  await rejects(parseSendRequest(json({ psid: '222', text: 'a', requestId: 'not-a-uuid' })), 400);
  await rejects(parseSendRequest(json({ psid: '222', imageId: 'x/../y', requestId: UUID })), 400);
  await rejects(parseSendRequest(json({ psid: '222', text: 'a'.repeat(17000), requestId: UUID })), 413);
  await rejects(parseSendRequest(multipart({ psid: '222', requestId: UUID }, new File(['<html>'], 'a.jpg', { type: 'image/jpeg' }))), 400);
  await rejects(parseSendRequest(multipart({ psid: '222', requestId: UUID })), 400);
  await rejects(parseSendRequest(multipart({ psid: '222', requestId: 'nope' }, new File([jpeg(1)], 'a.jpg'))), 400);
  const big = new Uint8Array(4 * 1024 * 1024 + 1); big.set([0xff, 0xd8, 0xff]);
  await rejects(parseSendRequest(multipart({ psid: '222', requestId: UUID }, new File([big], 'a.jpg'))), 413);
});
