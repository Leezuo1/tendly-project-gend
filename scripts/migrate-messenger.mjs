import { readFile, readdir } from 'node:fs/promises';
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
    const directory = fileURLToPath(new URL('../db/migrations/', import.meta.url));
    const files = (await readdir(directory)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
    stage = 'connecting to Postgres';
    // Áp dụng mọi file trong db/migrations theo thứ tự tên (001-messenger, 002-marketing-posts...).
    const dir = fileURLToPath(new URL('../db/migrations/', import.meta.url));
    const files = (await readdir(dir)).filter((name) => name.endsWith('.sql')).sort();
    client = await pool.connect();
    stage = 'starting migration transaction';
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(727364101)");
    for (const filename of files) {
      stage = `applying ${filename}`;
      await client.query(await readFile(new URL(filename, new URL('../db/migrations/', import.meta.url)), 'utf8'));
    }
    stage = 'committing migration';
    await client.query('COMMIT');
    console.log('Messenger Postgres tables are ready. Existing data was preserved.');
  } catch (error) {
    if (client) { try { await client.query('ROLLBACK'); } catch { /* connection unavailable */ } }
    console.error('Messenger migration failed. Check DATABASE_URL, network access and database permissions.');
    const code = typeof error.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'UNKNOWN';
    console.error(`Stage: ${stage}. Error code: ${code}.`);
    for (const file of files) await client.query(await readFile(`${dir}${file}`, 'utf8'));
    await client.query('COMMIT');
    console.log(`Postgres tables are ready (${files.join(', ')}). Existing data was preserved.`);
  } catch {
    if (client) { try { await client.query('ROLLBACK'); } catch { /* connection unavailable */ } }
    console.error('Migration failed. Check DATABASE_URL, network access and database permissions.');
    process.exitCode = 1;
  } finally { client?.release(); await pool.end(); }
}
