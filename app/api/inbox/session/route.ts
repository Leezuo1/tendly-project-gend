import { AppSecurityError, readAppSession, securityErrorResponse } from '@/lib/services/appSecurity';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const session = await readAppSession(request);
    return Response.json({ ready: session.canUse, error: session.canUse ? '' : 'Vui lòng đăng nhập bằng tài khoản có quyền sử dụng dữ liệu.' },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return error instanceof AppSecurityError ? securityErrorResponse(error)
      : Response.json({ error: 'Chưa đọc được phiên truy cập.' }, { status: 503 });
  }
}
