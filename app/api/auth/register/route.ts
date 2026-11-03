import { AppSecurityError, readSecurityJson, registerApp, securityErrorResponse, sessionCookie } from '@/lib/services/appSecurity';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const { token, role, needsSetup } = await registerApp(request, await readSecurityJson(request));
    return Response.json({ authenticated: true, role, needsSetup }, {
      status: 201, headers: { 'Cache-Control': 'no-store', 'Set-Cookie': sessionCookie(request, token) },
    });
  } catch (error) {
    return error instanceof AppSecurityError ? securityErrorResponse(error)
      : Response.json({ error: 'Chưa tạo được tài khoản. Vui lòng thử lại; nếu đã đăng ký, hãy đăng nhập.' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
