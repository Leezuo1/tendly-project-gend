import { withAppAccess } from '@/lib/services/appSecurity';
import { inboxAccessError } from '@/lib/services/inboxAccess';
import { readCrmOverview } from '@/lib/services/crmOverview';

export const runtime = 'nodejs';
/** Tổng quan đơn hàng & khách hàng cho tab Tổng quan. ?range=7|30|90 (ngày). */
export const GET = withAppAccess(async function GET(request: Request) {
  const denied = inboxAccessError(request);
  if (denied) return denied;
  if (!process.env.PAGE_ID || !process.env.DATABASE_URL) {
    return Response.json({ error: 'Chưa cấu hình kết nối Messenger.' }, { status: 503 });
  }
  try {
    const range = Number(new URL(request.url).searchParams.get('range') ?? 30);
    return Response.json(await readCrmOverview(process.env.PAGE_ID, range), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Không tải được dữ liệu đơn hàng và khách hàng.' }, { status: 503 });
  }
});
