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

test('a reply is held when it echoes masked data, or has a link or amount the shop never supplied', () => {
  const known = JSON.stringify({ faq: 'Phí ship 30.000đ. Xem https://shop.vn/doi-tra.' });
  assert.equal(unsupportedReplyReason('Ship 30k nhé, chi tiết tại https://shop.vn/doi-tra.', known), null);
  assert.equal(unsupportedReplyReason('Áo 221.000đ ạ', JSON.stringify([{ price: 221000 }])), null, 'catalog price (a bare JSON number) is allowed');
  assert.equal(unsupportedReplyReason('Flash sale còn 199k', JSON.stringify({ sources: [{ flashPrice: 199000, flashActive: true }] })), null, 'an amount that only appears in sources is allowed');
  assert.match(unsupportedReplyReason('Giảm còn 99k', known), /số tiền/);
  assert.match(unsupportedReplyReason('Mua tại https://evil.example/x', known), /đường dẫn/);
  assert.match(unsupportedReplyReason('Em gọi [SĐT] nhé', known), /che/);
  assert.equal(unsupportedReplyReason('Dạ shop mở cửa lúc 8 giờ ạ', known), null);
});
