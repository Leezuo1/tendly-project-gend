import { parseJsonObject } from '@/lib/http/body';
import { errorJson, isMissingTable, mapError, rule } from '@/lib/http/errors';
import { InvalidAiKnowledge } from '@/lib/services/aiKnowledge';
import { GeminiNotConfigured, GeminiUnavailable } from '@/lib/services/gemini';
import { MessengerSendError } from '@/lib/services/messengerSend';
import { AppSecurityError, securityErrorResponse } from '@/lib/services/appSecurity';
import { MarketingWorkflowError } from '@/lib/services/marketingBrief';

export class MarketingNotConfigured extends Error {}
export class InvalidMarketingRequest extends Error {}

/** Các tab Marketing đọc dữ liệu Messenger thật của đúng Fanpage đang cấu hình. */
export function marketingPageId(): string {
  const pageId = process.env.PAGE_ID?.trim() ?? '';
  if (!/^\d{1,64}$/.test(pageId) || !process.env.DATABASE_URL?.trim()) {
    throw new MarketingNotConfigured('Cần cấu hình PAGE_ID và DATABASE_URL để xem dữ liệu khách thật.');
  }
  return pageId;
}

export function parsePsid(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{1,64}$/.test(value)) throw new InvalidMarketingRequest('Khách hàng không hợp lệ.');
  return value;
}

export async function readMarketingJson(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (raw.length > 600_000) throw new InvalidMarketingRequest('Yêu cầu quá lớn.');
  return parseJsonObject(raw, () => new InvalidMarketingRequest('Nội dung yêu cầu không phải JSON hợp lệ.'));
}

/** Đổi lỗi thành response, không đưa chi tiết lỗi database ra ngoài. */
const MARKETING_RULES = [
  rule(AppSecurityError, securityErrorResponse),
  rule(MarketingWorkflowError, e => errorJson(e.message, e.status)),
  rule(InvalidMarketingRequest, e => errorJson(e.message, 400)),
  rule(InvalidAiKnowledge, e => errorJson(e.message, 400)),
  rule(MarketingNotConfigured, e => errorJson(e.message, 503, { code: 'NO_CONFIG' })),
  rule(MessengerSendError, e => errorJson(e.message, e.status)),
  rule(GeminiNotConfigured, e => errorJson(e.message, 503)),
  rule(GeminiUnavailable, e => errorJson(e.message, 502)),
];

export function marketingErrorResponse(error: unknown): Response {
  const mapped = mapError(error, MARKETING_RULES);
  if (mapped) return mapped;
  if (isMissingTable(error)) return errorJson('Database chưa có đủ bảng. Chạy npm run db:migrate rồi thử lại.', 503, { code: 'NO_TABLE' });
  console.error('Marketing request failed.');
  return errorJson('Không đọc được dữ liệu. Vui lòng thử lại.', 503);
}
