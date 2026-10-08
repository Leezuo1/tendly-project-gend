import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { newDb, DataType } from 'pg-mem';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file) {
  const loaded = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(require, loaded, loaded.exports);
  return loaded.exports;
}

function fixture() {
  // pg-mem skips planning constraints on the second CREATE IF NOT EXISTS.
  const db = newDb({ noAstCoverageCheck: true });
  db.public.registerFunction({ name: 'greatest', args: [DataType.integer, DataType.integer],
    returns: DataType.integer, implementation: (a, b) => Math.max(a, b) });
  const migration = readFileSync('db/migrations/001-messenger.sql', 'utf8');
  db.public.none(migration);
  db.public.none(migration); // Applying the initial schema again must preserve data.
  const { Pool } = db.adapters.createPg();
  return { db, pool: new Pool() };
}
const message = (messageId, extra = {}) => ({
  pageId: '111', psid: '222', messageId, direction: 'in', timestamp: 100,
  text: "Shop's áo 😊", attachments: [{ type: 'image', url: 'https://example.com/img.jpg' }], ...extra,
});

test('Postgres schema and real parameterized writer preserve text, attachment, dedup and timestamps', async () => {
  const { db, pool } = fixture();
  const { savePostgresMessages } = load('lib/services/messengerPostgres.ts');
  try {
    assert.deepEqual(await savePostgresMessages([message('m1'), message('m1')], pool), { inserted: 1, duplicates: 1 });
    assert.deepEqual(await savePostgresMessages([message('m1')], pool), { inserted: 0, duplicates: 1 });
    await savePostgresMessages([
      message('reply', { direction: 'out', timestamp: 300 }),
      message('late', { timestamp: 50 }), message('another', { psid: '333' }),
    ], pool);
    const customer = db.public.one(`SELECT * FROM messenger_conversations WHERE id='["111","222"]'`);
    assert.equal(Number(customer.last_message_at), 300);
    assert.equal(Number(customer.last_in_at), 100);
    assert.equal(Number(customer.last_out_at), 300);
    const saved = db.public.one("SELECT * FROM messenger_messages WHERE message_id='m1'");
    assert.equal(saved.text, "Shop's áo 😊");
    assert.equal(saved.attachments_json[0].type, 'image');
    assert.equal(db.public.many('SELECT * FROM messenger_customers').length, 2);
    assert.equal(db.public.many('SELECT * FROM messenger_messages').length, 4);
  } finally { await pool.end(); }
});

test('Postgres error rolls back the batch and releases client; commit happens only after all writes', async () => {
  const { savePostgresMessages } = load('lib/services/messengerPostgres.ts');
  const queries = [];
  let released = 0;
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.startsWith('INSERT INTO messenger_messages')) throw new Error('database unavailable');
      return { rowCount: 0 };
    }, release() { released++; },
  };
  await assert.rejects(savePostgresMessages([message('m1')], { connect: async () => client }));
  assert.equal(queries[0], 'BEGIN');
  assert.equal(queries.at(-1), 'ROLLBACK');
  assert.equal(queries.includes('COMMIT'), false);
  assert.equal(released, 1);
});

test('storage requires DATABASE_URL both locally and on Vercel', () => {
  const original = { DATABASE_URL: process.env.DATABASE_URL, VERCEL: process.env.VERCEL };
  const { requireMessengerDatabase } = load('lib/services/messengerStorage.ts');
  try {
    delete process.env.DATABASE_URL; delete process.env.VERCEL;
    assert.throws(() => requireMessengerDatabase(), /DATABASE_URL/);
    process.env.VERCEL = '1';
    assert.throws(() => requireMessengerDatabase(), /DATABASE_URL/);
    process.env.DATABASE_URL = 'postgresql://test-only';
    assert.doesNotThrow(() => requireMessengerDatabase());
    delete process.env.VERCEL;
    assert.doesNotThrow(() => requireMessengerDatabase());
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
