// Demo only: attaches labelled mock orders (is_mock=true) to a real PSID so the AI can be shown using purchase history.
// Usage: node scripts/seed-mock-orders.mjs <psid>      (remove: node scripts/seed-mock-orders.mjs <psid> --remove)
import { createRequire } from 'node:module';
import pg from 'pg';

createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd());
const [psid, flag] = process.argv.slice(2);
const pageId = process.env.PAGE_ID?.trim();
if (!/^\d{1,64}$/.test(psid ?? '') || !pageId || !process.env.DATABASE_URL?.trim()) {
  console.error('Usage: node scripts/seed-mock-orders.mjs <psid> [--remove]  (needs PAGE_ID and DATABASE_URL in .env.local)');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await pool.query('DELETE FROM messenger_orders WHERE page_id=$1 AND psid=$2 AND is_mock', [pageId, psid]);
  if (flag !== '--remove') {
    const day = 86_400_000, now = Date.now();
    const orders = [
      ['mock-1', [{ name: 'Áo thun cotton trắng', qty: 2 }], 398000, 'confirmed', now - 40 * day],
      ['mock-2', [{ name: 'Quần jeans slim', qty: 1 }, { name: 'Thắt lưng da', qty: 1 }], 650000, 'confirmed', now - 12 * day],
    ];
    for (const [n, [, items, total, status, at]] of orders.entries()) {
      // Short code: the bot may quote it to the customer, so it must not contain the full PSID or say "mock".
      await pool.query(`INSERT INTO messenger_orders(id,page_id,psid,items_json,total,status,is_mock,created_at,updated_at)
        VALUES($1,$2,$3,$4::jsonb,$5,$6,true,$7,$7)`, [`DH${psid.slice(-6)}-${n + 1}`, pageId, psid, JSON.stringify(items), total, status, at]);
    }
  }
  console.log(flag === '--remove' ? 'Removed mock orders.' : 'Seeded 2 mock confirmed orders.');
} finally { await pool.end(); }
