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
const { saveCustomerNeeds } = load('lib/services/customerNeeds.ts');
const wrap = (db) => ({ query: async (sql, values) => { const result = await db.query(sql, values); return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length }; } });
const pg = new PGlite();
const migration = readFileSync('db/migrations/029-customer-needs.sql', 'utf8');
const ready = (async () => {
  await pg.exec(readFileSync('db/migrations/001-messenger.sql', 'utf8'));
  await pg.exec(migration);
  await pg.exec("INSERT INTO messenger_customers(id,page_id,psid,created_at) VALUES ('c1','111','999',1)");
})();
after(async () => { await ready; await pg.close(); });
const db = wrap(pg);
const stored = async () => (await pg.query("SELECT needs, needs_updated_at FROM messenger_customers WHERE id='c1'")).rows[0];

test('saves trimmed needs and stamps the update time', async () => {
  await ready;
  const saved = await saveCustomerNeeds('111', '999', '  Cần áo size L  ', db);
  assert.equal(saved.needs, 'Cần áo size L');
  assert.ok(saved.needsUpdatedAt > 0);
  assert.equal((await stored()).needs, 'Cần áo size L');
});

test('an empty string clears the needs', async () => {
  await ready;
  assert.equal((await saveCustomerNeeds('111', '999', '', db)).needs, '');
  assert.equal((await stored()).needs, '');
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

test('migration 029 can run twice', async () => {
  await ready;
  await pg.exec(migration);
});
