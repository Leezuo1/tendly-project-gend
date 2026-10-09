import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import pg from 'pg';
import { getDefaultAutoSelectFamilyAttemptTimeout, setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';

const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());

// Remote regions can exceed Node's default 250 ms per-address TCP attempt.
if (!process.env.VERCEL) {
  setDefaultAutoSelectFamilyAttemptTimeout(Math.max(getDefaultAutoSelectFamilyAttemptTimeout(), 2000));
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error('Missing DATABASE_URL. Add the Postgres connection string to .env.local before migrating.');
  process.exitCode = 1;
} else {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL,
    max: 1, connectionTimeoutMillis: 20000, statement_timeout: 30000 });
  let client;
  let stage = 'reading migration files';
  try {
    // Áp dụng cả Messenger và Marketing theo thứ tự tên file.
    const directory = new URL('../db/migrations/', import.meta.url);
    const files = (await readdir(fileURLToPath(directory))).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
    stage = 'connecting to Postgres';
    client = await pool.connect();
    stage = 'starting migration transaction';
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(727364101)");
    for (const file of files) {
      stage = `applying ${file}`;
      await client.query(await readFile(new URL(file, directory), 'utf8'));
    }
    stage = 'committing migration';
    await client.query('COMMIT');
    console.log(`Postgres tables are ready (${files.join(', ')}). Existing data was preserved.`);
  } catch (error) {
    if (client) { try { await client.query('ROLLBACK'); } catch { /* connection unavailable */ } }
    console.error('Migration failed. Check DATABASE_URL, network access and database permissions.');
    const code = typeof error.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'UNKNOWN';
    console.error(`Stage: ${stage}. Error code: ${code}.`);
    process.exitCode = 1;
  } finally { client?.release(); await pool.end(); }
}
