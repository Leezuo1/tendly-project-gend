import { createHash, timingSafeEqual } from 'node:crypto';
import { marketingPageId, marketingErrorResponse } from '@/lib/services/marketingApi';
import { runMarketingSchedules } from '@/lib/services/marketingWorkspace';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const value = request.headers.get('authorization') ?? '';
  if (!secret || !timingSafeEqual(createHash('sha256').update(value).digest(), createHash('sha256').update(`Bearer ${secret}`).digest())) return Response.json({ error: 'Không được phép chạy lịch.' }, { status: 401 });
  try { return Response.json(await runMarketingSchedules(marketingPageId())); }
  catch (error) { return marketingErrorResponse(error); }
}
