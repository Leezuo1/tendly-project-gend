import { errorJson, mapError, rule } from '@/lib/http/errors';
import { FacebookCommentError } from '@/lib/services/facebookComments';
import { InvalidMarketingRequest, marketingErrorResponse } from '@/lib/services/marketingApi';
import { LiveError } from '@/lib/services/live/engine';
import { LivePreparationError } from '@/lib/services/live/preparation';

const NO_STORE = { 'Cache-Control': 'no-store' };

export const liveJson = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

const LIVE_RULES = [
  rule(LivePreparationError, e => errorJson(e.message, 400, { noStore: true })),
  rule(LiveError, e => errorJson(e.message, e.status, { code: e.code, noStore: true })),
  rule(FacebookCommentError, e => errorJson(e.message, e.status, { noStore: true })),
];

export const liveErrorResponse = (error: unknown): Response => mapError(error, LIVE_RULES) ?? marketingErrorResponse(error);

export function parseSessionId(value: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new InvalidMarketingRequest('Phiên live không hợp lệ.');
  return value;
}

export function parseGroupKey(value: string): string {
  const key = decodeURIComponent(value);
  if (!/^[a-z_]{2,20}:[^\s]{1,200}$/.test(key)) throw new InvalidMarketingRequest('Nhóm bình luận không hợp lệ.');
  return key;
}
