import { AppSecurityError, loginApp, logoutApp, readAppSession, readSecurityJson, securityErrorResponse, sessionCookie } from '@/lib/services/appSecurity';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
function failure(error: unknown) {
  return error instanceof AppSecurityError ? securityErrorResponse(error)
    : Response.json({ error: 'Chưa kết nối được hệ thống bảo mật. Vui lòng kiểm tra cấu hình và migration.' }, { status: 503, headers });
}
export async function GET(request: Request) {
  try { return Response.json(await readAppSession(request), { headers }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const body = await readSecurityJson(request);
    if (typeof body?.username !== 'string' || typeof body?.password !== 'string') {
      throw new AppSecurityError('Vui lòng nhập tài khoản và mật khẩu.', 400, 'INVALID_LOGIN');
    }
    const { token, role } = await loginApp(request, body.username.trim(), body.password);
    return Response.json({ authenticated: true, role }, { headers: { ...headers, 'Set-Cookie': sessionCookie(request, token) } });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
  try {
    await logoutApp(request);
    return Response.json({ loggedOut: true }, { headers: { ...headers, 'Set-Cookie': sessionCookie(request) } });
  } catch (error) { return failure(error); }
}
