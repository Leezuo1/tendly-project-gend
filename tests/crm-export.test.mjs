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
const { readCrmCustomers, parseCrmLimit } = load('lib/services/crmExport.ts');
const route = load('app/api/crm/customers/route.ts');
const wrap = (db) => ({ query: async (sql, values) => { const result = await db.query(sql, values); return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length }; } });
const pg = new PGlite();
const ready = (async () => {
  for (const file of ['001-messenger', '003-messenger-profiles', '004-conversation-memory', '005-conversation-view', '023-messenger-orders', '029-customer-needs']) {
    await pg.exec(readFileSync(`db/migrations/${file}.sql`, 'utf8'));
  }
  await pg.exec(`INSERT INTO messenger_customers(id,page_id,psid,created_at,display_name,needs,needs_updated_at) VALUES
    ('c1','111','100',1,'An','Cần áo size L',9), ('c2','111','200',2,'Bình','',NULL), ('c3','111','300',3,NULL,'',NULL), ('c4','222','400',4,'Khác','',NULL);
    INSERT INTO messenger_conversations(id,customer_id,page_id,created_at,last_message_at,hidden_at) VALUES
    ('v1','c1','111',1,50,NULL), ('v2','c2','111',2,60,5), ('v3','c3','111',3,NULL,NULL), ('v4','c4','222',4,70,NULL);
    INSERT INTO messenger_orders(id,page_id,psid,items_json,total,status,is_mock,created_at,updated_at) VALUES
    ('o1','111','100','[]',200000,'confirmed',true,10,10), ('o2','111','100','[]',300000,'confirmed',false,20,20),
    ('o3','111','100','[]',999,'cancelled',false,30,30), ('o4','111','300','[]',50000,'confirmed',false,40,40)`);
})();
after(async () => { await ready; await pg.close(); });
const db = wrap(pg);

test('exports visible customers of the Page with needs and confirmed-order totals, mock orders flagged', async () => {
  await ready;
  const { customers } = await readCrmCustomers('111', { limit: 50 }, db);
  assert.deepEqual(customers.map((c) => c.id), ['100', '300'], 'hidden conversation and other Page are left out');
  const an = customers[0];
  assert.equal(an.name, 'An');
  assert.equal(an.needs, 'Cần áo size L');
  assert.equal(an.needsUpdatedAt, 9);
  assert.deepEqual(an.orders, { confirmedCount: 2, confirmedTotalVnd: 500000, lastConfirmedAt: 20, includesMock: true });
  assert.equal(customers[1].orders.includesMock, false);
  assert.equal(customers[1].name, null);
  assert.equal(customers[1].lastMessageAt, null);
});

test('customer with no orders gets zeros', async () => {
  await ready;
  await pg.exec("INSERT INTO messenger_customers(id,page_id,psid,created_at) VALUES ('c5','111','500',5); INSERT INTO messenger_conversations(id,customer_id,page_id,created_at) VALUES ('v5','c5','111',5)");
  const last = (await readCrmCustomers('111', { limit: 50 }, db)).customers.at(-1);
  assert.deepEqual([last.id, last.orders], ['500', { confirmedCount: 0, confirmedTotalVnd: 0, lastConfirmedAt: null, includesMock: false }]);
  assert.equal(last.needs, '');
  await pg.exec("DELETE FROM messenger_conversations WHERE id='v5'; DELETE FROM messenger_customers WHERE id='c5'");
});

test('keyset pagination has no duplicates and ends with a null cursor', async () => {
  await ready;
  const first = await readCrmCustomers('111', { limit: 1 }, db);
  assert.deepEqual([first.customers.map((c) => c.id), first.nextCursor], [['100'], '100']);
  const second = await readCrmCustomers('111', { limit: 1, after: first.nextCursor }, db);
  assert.deepEqual([second.customers.map((c) => c.id), second.nextCursor], [['300'], null]);
});

test('limit is clamped to 1..100 with default 50', () => {
  assert.deepEqual(['0', '1000', 'abc', null, '7'].map(parseCrmLimit), [1, 100, 50, 50, 7]);
});

test('route refuses a missing, wrong or unset API key and a missing Page', async () => {
  const get = (auth) => route.GET(new Request('http://localhost/api/crm/customers', { headers: auth ? { authorization: auth } : {} }));
  const saved = { key: process.env.CRM_API_KEY, page: process.env.PAGE_ID };
  try {
    process.env.CRM_API_KEY = 'secret-key'; process.env.PAGE_ID = '111';
    assert.equal((await get()).status, 401);
    assert.equal((await get('Bearer wrong')).status, 401);
    assert.equal((await get('secret-key')).status, 401, 'Bearer prefix is required');
    delete process.env.CRM_API_KEY;
    for (const auth of ['Bearer ', 'Bearer undefined', 'Bearer ']) assert.equal((await get(auth)).status, 401, 'no key configured must not mean open');
    process.env.CRM_API_KEY = 'secret-key'; process.env.PAGE_ID = '';
    assert.equal((await get('Bearer secret-key')).status, 503);
  } finally {
    for (const [name, value] of [['CRM_API_KEY', saved.key], ['PAGE_ID', saved.page]]) value === undefined ? delete process.env[name] : (process.env[name] = value);
  }
});
