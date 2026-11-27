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
const { saveCustomerNeeds, saveAiCustomerNeeds, refreshCustomerNeeds, inboundNeedsHash } = load('lib/services/customerNeeds.ts');
const wrap = (db) => ({ query: async (sql, values) => { const result = await db.query(sql, values); return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length }; } });
const pg = new PGlite();
const migration029 = readFileSync('db/migrations/029-customer-needs.sql', 'utf8');
const migration030 = readFileSync('db/migrations/030-customer-needs-ai.sql', 'utf8');
const ready = (async () => {
  await pg.exec(readFileSync('db/migrations/001-messenger.sql', 'utf8'));
  await pg.exec(readFileSync('db/migrations/004-conversation-memory.sql', 'utf8'));
  await pg.exec(readFileSync('db/migrations/005-conversation-view.sql', 'utf8'));
  await pg.exec(migration029);
  await pg.exec(migration030);
  await pg.exec("INSERT INTO messenger_customers(id,page_id,psid,created_at) VALUES ('c1','111','999',1)");
  await pg.exec("INSERT INTO messenger_conversations(id,customer_id,page_id,created_at) VALUES ('[\"111\",\"999\"]','c1','111',1)");
})();
after(async () => { await ready; await pg.close(); });
const db = wrap(pg);
const stored = async () => (await pg.query("SELECT needs, needs_source, needs_updated_at FROM messenger_customers WHERE id='c1'")).rows[0];

test('saves trimmed needs as staff and stamps the update time', async () => {
  await ready;
  const saved = await saveCustomerNeeds('111', '999', '  Cần áo size L  ', db);
  assert.equal(saved.needs, 'Cần áo size L');
  assert.equal(saved.needsSource, 'staff');
  assert.ok(saved.needsUpdatedAt > 0);
  assert.equal((await stored()).needs, 'Cần áo size L');
  assert.equal((await stored()).needs_source, 'staff');
});

test('an empty string clears the needs and resets needs_source so future messages can use AI again', async () => {
  await ready;
  const cleared = await saveCustomerNeeds('111', '999', '', db);
  assert.equal(cleared.needs, '');
  assert.equal(cleared.needsSource, '');
  assert.equal((await stored()).needs, '');
  assert.equal((await stored()).needs_source, '');
});

test('rejects non-strings and needs over 500 characters without writing', async () => {
  await ready;
  await saveCustomerNeeds('111', '999', 'giữ nguyên', db);
  for (const bad of ['x'.repeat(501), 123, null]) await assert.rejects(saveCustomerNeeds('111', '999', bad, db), { status: 400 });
  assert.equal((await stored()).needs, 'giữ nguyên');
  assert.equal((await saveCustomerNeeds('111', '999', 'y'.repeat(500), db)).needs.length, 500);
});

test('unknown customer is 404 and creates no row', async () => {
  await ready;
  await assert.rejects(saveCustomerNeeds('111', '000', 'a', db), { status: 404 });
  await assert.rejects(saveCustomerNeeds('222', '999', 'a', db), { status: 404 });
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM messenger_customers')).rows[0].n, 1);
});

test('AI auto-fills needs, caches by message hash, and never overwrites staff edits', async () => {
  await ready;
  await saveCustomerNeeds('111', '999', '', db);
  await pg.exec(`INSERT INTO messenger_messages(page_id,message_id,conversation_id,direction,sent_at,received_at,text,attachments_json)
    VALUES ('111','m1','["111","999"]','in',10,10,'Mình muốn tìm áo khoác gió size XL','[]')`);
  let calls = 0;
  const generate = async (options) => {
    calls++;
    return { model: 'test', result: options.parse(JSON.stringify({ needs: 'Tìm áo khoác gió size XL' })) };
  };
  const first = await refreshCustomerNeeds('111', '999', db, generate);
  assert.equal(first.needs, 'Tìm áo khoác gió size XL');
  assert.equal(first.needsSource, 'ai');
  assert.equal(calls, 1);
  // Lần gọi lại khi chưa có tin mới: không gọi Gemini.
  await refreshCustomerNeeds('111', '999', db, generate);
  assert.equal(calls, 1);
  // Tin nhắn mới từ khách cập nhật tiếp khi vẫn đang ở nguồn AI.
  await pg.exec(`INSERT INTO messenger_messages(page_id,message_id,conversation_id,direction,sent_at,received_at,text,attachments_json)
    VALUES ('111','m2','["111","999"]','in',20,20,'Giao về Quận 3 trước thứ 6 nhé','[]')`);
  const second = await refreshCustomerNeeds('111', '999', db, async (options) => {
    calls++;
    assert.equal(JSON.parse(options.user).existingNeeds, 'Tìm áo khoác gió size XL');
    return { model: 'test', result: options.parse(JSON.stringify({ needs: 'Áo khoác gió size XL, giao Q3 trước thứ 6' })) };
  });
  assert.equal(second.needs, 'Áo khoác gió size XL, giao Q3 trước thứ 6');
  assert.equal(calls, 2);
  // Nhân viên xóa trắng: không tự điền lại cho các tin nhắn cũ đã thấy.
  await saveCustomerNeeds('111', '999', '', db);
  await refreshCustomerNeeds('111', '999', db, generate);
  assert.equal(calls, 2);
  assert.equal((await stored()).needs, '');
  // Nhân viên ghi tay -> AI tuyệt đối không ghi đè kể cả khi có tin nhắn mới.
  await saveCustomerNeeds('111', '999', 'Khách VIP cần gọi trực tiếp', db);
  await pg.exec(`INSERT INTO messenger_messages(page_id,message_id,conversation_id,direction,sent_at,received_at,text,attachments_json)
    VALUES ('111','m3','["111","999"]','in',30,30,'Shop ơi trả lời giúp mình','[]')`);
  const kept = await refreshCustomerNeeds('111', '999', db, generate);
  assert.equal(kept.needs, 'Khách VIP cần gọi trực tiếp');
  assert.equal(kept.needsSource, 'staff');
  assert.equal(calls, 2);
  const hash = await inboundNeedsHash('111', '999', db);
  const blocked = await saveAiCustomerNeeds('111', '999', 'Ghi đè từ AI', hash, db);
  assert.equal(blocked.needs, 'Khách VIP cần gọi trực tiếp');
  assert.equal(blocked.needsSource, 'staff');
});

test('migrations 029 and 030 are idempotent and preserve existing manual needs as staff', async () => {
  await ready;
  await pg.exec(migration029);
  await pg.exec(migration030);
  await pg.exec("INSERT INTO messenger_customers(id,page_id,psid,created_at,needs,needs_source) VALUES ('c2','111','888',2,'Ghi chú cũ','')");
  await pg.exec(migration030);
  const row = (await pg.query("SELECT needs_source FROM messenger_customers WHERE id='c2'")).rows[0];
  assert.equal(row.needs_source, 'staff');
});
