import { createHash, timingSafeEqual } from 'node:crypto';
import { parseCrmLimit, readCrmCustomers } from '@/lib/services/crmExport';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };
const digest = (value: string) => createHash('sha256').update(value).digest();

// Hệ thống CRM của doanh nghiệp gọi bằng API key, không dùng phiên đăng nhập của app.
export async function GET(request: Request) {
  const key = process.env.CRM_API_KEY?.trim();
  if (!key || !timingSafeEqual(digest(request.headers.get('authorization') ?? ''), digest(`Bearer ${key}`))) {
    return Response.json({ error: 'Không được phép.' }, { status: 401, headers: noStore });
  }
  const pageId = process.env.PAGE_ID?.trim();
  if (!pageId || !process.env.DATABASE_URL) return Response.json({ error: 'Chưa cấu hình Messenger.' }, { status: 503, headers: noStore });
  const params = new URL(request.url).searchParams;
  try {
    return Response.json(await readCrmCustomers(pageId, { limit: parseCrmLimit(params.get('limit')), after: params.get('after') }), { headers: noStore });
  } catch { return Response.json({ error: 'Không đọc được danh sách khách. Kiểm tra database và chạy migration.' }, { status: 503, headers: noStore }); }
}
