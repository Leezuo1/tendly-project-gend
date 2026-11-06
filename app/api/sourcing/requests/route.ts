import { requireAppAccess, withAppAccess } from '@/lib/services/appSecurity';
import { InvalidMarketingRequest, readMarketingJson } from '@/lib/services/marketingApi';
import { prepareSourcingRequest, readSourcingSelection, runSourcingRequest, saveSourcingDecision, sourcingWorkspace } from '@/lib/services/sourcingWorkflow';
import { SourcingInputError } from '@/lib/services/sourcingSearch';
import { SourcingRunError } from '@/lib/services/sourcingRuns';
import { SourcingProviderError } from '@/lib/services/sourcingApify';
export const runtime = 'nodejs';
export const maxDuration = 60;
async function handle(request: Request) {
  const session = await requireAppAccess(request);
  const owner = JSON.stringify([session.role, session.userId || session.username]);
  try {
    if (request.method === 'GET') {
      const query = new URL(request.url).searchParams;
      if (query.has('run')) return Response.json({ item: await readSourcingSelection(owner, query.get('run'), query.get('item')) });
      return Response.json(await sourcingWorkspace(owner));
    }
    const body = await readMarketingJson(request);
    if (body.action === 'prepare') return Response.json({ id: await prepareSourcingRequest(owner, body.criteria, body.id, body.revision), ...await sourcingWorkspace(owner) });
    if (body.action === 'run') return Response.json({ run: await runSourcingRequest(owner, body.id, body.revision, body.confirmed) }, { status: 202 });
    if (body.action === 'decision') { await saveSourcingDecision(owner, body); return Response.json(await sourcingWorkspace(owner)); }
    throw new SourcingInputError('Thao tác không hợp lệ.');
  } catch (error) {
    if (error instanceof SourcingInputError || error instanceof InvalidMarketingRequest) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof SourcingRunError || error instanceof SourcingProviderError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
export const GET = withAppAccess(handle);
export const POST = withAppAccess(handle);
