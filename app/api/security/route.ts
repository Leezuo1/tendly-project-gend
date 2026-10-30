import { AppSecurityError, changeProtection, readSecurityJson, securityErrorResponse } from '@/lib/services/appSecurity';

export const runtime = 'nodejs';
export async function PATCH(request: Request) {
  try {
    const body = await readSecurityJson(request);
    if (typeof body.enabled !== 'boolean' || typeof body.revision !== 'number' || !Number.isSafeInteger(body.revision) || body.revision < 1) {
      throw new AppSecurityError('Trạng thái bảo vệ không hợp lệ.', 400, 'INVALID_SECURITY');
    }
    return Response.json(await changeProtection(request, body.enabled, body.revision), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return error instanceof AppSecurityError ? securityErrorResponse(error)
      : Response.json({ error: 'Không lưu được trạng thái bảo vệ. Vui lòng thử lại.' }, { status: 503 });
  }
}
