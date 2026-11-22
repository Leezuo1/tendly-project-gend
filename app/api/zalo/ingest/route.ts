import { getMessengerPool } from '@/lib/services/messengerPostgres';
import { hasZaloSecret } from '@/lib/services/zaloOutbox';
import { InvalidZaloPayload, parseZaloIngest, saveZaloMessages } from '@/lib/services/zaloMessages';

export const runtime = 'nodejs';
const MAX_BODY = 1_000_000;

/** Worker zca-js (scripts/run-zalo-listener.mjs) đẩy tin Zalo về đây; xác thực bằng ZALO_INGEST_SECRET như lịch Marketing. */
export async function POST(request: Request) {
  if (!hasZaloSecret(request)) return Response.json({ error: 'Không được phép đồng bộ Zalo.' }, { status: 401 });
  if (!process.env.DATABASE_URL?.trim()) return Response.json({ error: 'Cần cấu hình DATABASE_URL.' }, { status: 503 });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return Response.json({ error: 'Dữ liệu quá lớn.' }, { status: 413 });
  let ingest;
  try { ingest = parseZaloIngest(JSON.parse(raw)); }
  catch (error) { return Response.json({ error: error instanceof InvalidZaloPayload ? error.message : 'Dữ liệu Zalo không hợp lệ.' }, { status: 400 }); }
  try { return Response.json(await saveZaloMessages(ingest, getMessengerPool())); }
  catch { return Response.json({ error: 'Không lưu được tin Zalo.' }, { status: 503 }); }
}
