import { getMessengerPool } from '@/lib/services/messengerPostgres';
import { hasZaloSecret, pollZaloOutbox, type ZaloResult } from '@/lib/services/zaloOutbox';

export const runtime = 'nodejs';

/** Worker zca-js hỏi hàng đợi: báo kết quả tin đã gửi, nhận tin mới. Xác thực bằng ZALO_INGEST_SECRET. */
export async function POST(request: Request) {
  if (!hasZaloSecret(request)) return Response.json({ error: 'Không được phép.' }, { status: 401 });
  if (!process.env.DATABASE_URL?.trim()) return Response.json({ error: 'Cần cấu hình DATABASE_URL.' }, { status: 503 });
  let body: { ownId?: unknown; results?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 }); }
  const raw = Array.isArray(body.results) ? body.results.slice(0, 20) : [];
  const results: ZaloResult[] = raw.flatMap(r => r && typeof r.id === 'string' && typeof r.ok === 'boolean'
    ? [{ id: r.id, ok: r.ok, error: typeof r.error === 'string' ? r.error : undefined }] : []);
  if (typeof body.ownId !== 'string' || !/^\d{1,64}$/.test(body.ownId)) return Response.json({ error: 'Thiếu ownId Zalo.' }, { status: 400 });
  try { return Response.json({ jobs: await pollZaloOutbox(body.ownId, results, getMessengerPool()) }); }
  catch { return Response.json({ error: 'Không đọc được hàng đợi Zalo. Chạy npm run db:migrate.' }, { status: 503 }); }
}
