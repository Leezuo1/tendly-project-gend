import { FacebookCommentError } from '@/lib/services/facebookComments';
import { InvalidMarketingRequest, marketingErrorResponse } from '@/lib/services/marketingApi';
import { LiveError } from '@/lib/services/live/engine';

const NO_STORE = { 'Cache-Control': 'no-store' };

export const liveJson = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

export function liveErrorResponse(error: unknown): Response {
  if (error instanceof LiveError) return liveJson({ error: error.message, ...(error.code ? { code: error.code } : {}) }, error.status);
  if (error instanceof FacebookCommentError) return liveJson({ error: error.message }, error.status);
  return marketingErrorResponse(error);
}

export function parseSessionId(value: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new InvalidMarketingRequest('Phiên live không hợp lệ.');
  return value;
}

export function parseGroupKey(value: string): string {
  const key = decodeURIComponent(value);
  if (!/^[a-z_]{2,20}:[^\s]{1,200}$/.test(key)) throw new InvalidMarketingRequest('Nhóm bình luận không hợp lệ.');
  return key;
}
