import { InvalidAiKnowledge } from '@/lib/services/aiKnowledge';
import { GeminiNotConfigured, GeminiUnavailable } from '@/lib/services/gemini';
import { MessengerSendError } from '@/lib/services/messengerSend';

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
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not an object');
    return data;
  } catch {
    throw new InvalidMarketingRequest('Nội dung yêu cầu không phải JSON hợp lệ.');
  }
}

/** Đổi lỗi thành response, không đưa chi tiết lỗi database ra ngoài. */
export function marketingErrorResponse(error: unknown): Response {
  if (error instanceof InvalidMarketingRequest || error instanceof InvalidAiKnowledge) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof MarketingNotConfigured) return Response.json({ error: error.message, code: 'NO_CONFIG' }, { status: 503 });
  if (error instanceof MessengerSendError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof GeminiNotConfigured) return Response.json({ error: error.message }, { status: 503 });
  if (error instanceof GeminiUnavailable) return Response.json({ error: error.message }, { status: 502 });
  if ((error as { code?: unknown })?.code === '42P01') {
    return Response.json({ error: 'Database chưa có đủ bảng. Chạy npm run db:migrate rồi thử lại.', code: 'NO_TABLE' }, { status: 503 });
  }
  console.error('Marketing request failed.');
  return Response.json({ error: 'Không đọc được dữ liệu. Vui lòng thử lại.' }, { status: 503 });
}
