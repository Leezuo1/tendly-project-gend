import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync('lib/services/replyGuard.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const loaded = { exports: {} };
new Function('module', 'exports', code)(loaded, loaded.exports);
const { vndAmounts, unsupportedReplyReason } = loaded.exports;

test('amounts are read in the ways Vietnamese shops write them', () => {
  assert.deepEqual(vndAmounts('Giá 259k, ship 30.000đ, combo 1,5 triệu, lẻ 199.000 đồng, 2tr'), [259000, 30000, 1500000, 199000, 2000000]);
  assert.deepEqual(vndAmounts('Size M, 2 màu, mở lúc 8 giờ'), []);
});

test('a reply is held when it has a link or amount the shop never supplied', () => {
  const known = JSON.stringify({ faq: 'Phí ship 30.000đ. Xem https://shop.vn/doi-tra.' });
  assert.equal(unsupportedReplyReason('Ship 30k nhé, chi tiết tại https://shop.vn/doi-tra.', known), null);
  assert.equal(unsupportedReplyReason('Áo 221.000đ ạ', JSON.stringify([{ price: 221000 }])), null, 'catalog price (a bare JSON number) is allowed');
  assert.equal(unsupportedReplyReason('Flash sale còn 199k', JSON.stringify({ sources: [{ flashPrice: 199000, flashActive: true }] })), null, 'an amount that only appears in sources is allowed');
  assert.match(unsupportedReplyReason('Giảm còn 99k', known), /số tiền/);
  assert.match(unsupportedReplyReason('Giảm còn 99.000đ', JSON.stringify({ fingerprint: '990001ab' })), /số tiền/, 'digits inside ids do not allow an amount');
  assert.match(unsupportedReplyReason('Mua tại https://evil.example/x', known), /đường dẫn/);
  assert.equal(unsupportedReplyReason('Dạ shop mở cửa lúc 8 giờ ạ', known), null);
});

test('with photos in the message, a long digit run (account, ID or phone number) the shop never supplied holds the reply', () => {
  const known = JSON.stringify({ shop: { phone: '0912345678' }, faq: 'Mã đơn 20240101.' });
  const withPhotos = { longNumbers: true };
  assert.match(unsupportedReplyReason('STK của bạn là 0123456789, CCCD 079123456789.', known, withPhotos), /dãy số/);
  assert.match(unsupportedReplyReason('Số tài khoản 0123 456 789 0 ạ', known, withPhotos), /dãy số/, 'spaces between digits do not hide it');
  assert.match(unsupportedReplyReason('Số 0123.456.7890', known, withPhotos), /dãy số/);
  assert.equal(unsupportedReplyReason('Gọi shop số 0912345678 nhé.', known, withPhotos), null, 'the shop\'s own number is fine');
  assert.equal(unsupportedReplyReason('Gọi shop số 0912 345 678 nhé.', known, withPhotos), null, 'spaced form of the shop\'s own number is fine');
  assert.equal(unsupportedReplyReason('Mã đơn của bạn là 20240101.', known, withPhotos), null);
  assert.equal(unsupportedReplyReason('Giá 1.500.000đ ạ', JSON.stringify([{ price: 1500000 }]), withPhotos), null, 'ordinary prices are not long numbers');
  assert.equal(unsupportedReplyReason('Size 38, màu 02, còn 15 cái ạ', known, withPhotos), null);
  assert.equal(unsupportedReplyReason('STK của bạn là 0123456789.', known), null, 'text-only messages keep the old rules');
  assert.equal(unsupportedReplyReason('Còn size 38 39 40 41 ạ', known, withPhotos), null, 'a list of short numbers is not one long number');
  assert.equal(unsupportedReplyReason('Size 36, 37, 38, 39, 40, 41 đều còn', known, withPhotos), null);
});
