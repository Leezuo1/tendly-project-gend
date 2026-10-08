import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import pg from 'pg';

const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL?.trim()) {
  console.error('Missing DATABASE_URL. Add the Postgres connection string to .env.local before migrating.');
  process.exitCode = 1;
} else {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL,
    max: 1, connectionTimeoutMillis: 10000, statement_timeout: 30000 });
  let client;
  try {
    const sql = await readFile(fileURLToPath(new URL('../db/migrations/001-messenger.sql', import.meta.url)), 'utf8');
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(727364101)");
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Messenger Postgres tables are ready. Existing data was preserved.');
  } catch {
    if (client) { try { await client.query('ROLLBACK'); } catch { /* connection unavailable */ } }
    console.error('Messenger migration failed. Check DATABASE_URL, network access and database permissions.');
    process.exitCode = 1;
  } finally { client?.release(); await pool.end(); }
}
