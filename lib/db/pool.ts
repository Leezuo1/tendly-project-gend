import { Pool } from 'pg';
import { attachDatabasePool } from '@vercel/functions';

/** Pool Postgres nhỏ dùng chung giới hạn; caller tự kiểm tra DATABASE_URL và giữ singleton. */
export function createPool(options: { label: string; connectionTimeoutMillis: number }): Pool {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3, connectionTimeoutMillis: options.connectionTimeoutMillis, idleTimeoutMillis: 5000,
    statement_timeout: 8000,
  });
  // Prevent an unhandled idle-client error without logging connection strings.
  pool.on('error', () => console.error(`${options.label} database idle connection failed.`));
  if (process.env.VERCEL) attachDatabasePool(pool);
  return pool;
}
