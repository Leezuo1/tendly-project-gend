import { readSecurityJson, requireAppAccess } from '@/lib/services/appSecurity';
import { SourcingInputError } from '@/lib/services/sourcingSearch';
import { SourcingProviderError, type SourcingKind } from '@/lib/services/sourcingApify';
import { createSourcingRun, readSourcingRun, SourcingRunError } from '@/lib/services/sourcingRuns';

function sourcingError(error: unknown) {
  if (error instanceof SourcingInputError) return Response.json({ error: error.message }, { status: 400 });
  if (error instanceof SourcingProviderError || error instanceof SourcingRunError) {
    return Response.json({ error: error.message }, { status: error.status,
      ...(error.status === 429 ? { headers: { 'Retry-After': '60' } } : {}) });
  }
  throw error;
}

export async function startSourcingRequest(request: Request, kind: SourcingKind) {
  const session = await requireAppAccess(request);
  const input = await readSecurityJson(request);
  try {
    if (input.confirmed !== true) throw new SourcingInputError('Xác nhận truy vấn và giới hạn chi phí trước khi chạy.');
    const run = await createSourcingRun(JSON.stringify([session.role, session.userId || session.username]), kind, input);
    return Response.json(run, { status: 202 });
  } catch (error) { return sourcingError(error); }
}

export async function getSourcingRequest(request: Request, id: string) {
  const session = await requireAppAccess(request);
  try {
    return Response.json(await readSourcingRun(JSON.stringify([session.role, session.userId || session.username]), id));
  } catch (error) { return sourcingError(error); }
}
