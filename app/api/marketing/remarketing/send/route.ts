import { InvalidMarketingRequest, marketingErrorResponse, marketingPageId, parsePsid, readMarketingJson } from '@/lib/services/marketingApi';
import { REMARKETING_PREFIX } from '@/lib/services/marketingInsights';
import { sendMessengerMessage } from '@/lib/services/messengerSend';
import { requireDashboardKey } from '@/lib/services/postsApi';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Gửi tin remarketing đã duyệt qua Messenger. Dùng chung luồng gửi của Hộp thoại (kiểm tra 24 giờ,
 * chống gửi trùng theo requestId); request_id có tiền tố rmk- để tab Hiệu suất đếm được.
 */
export async function POST(request: Request) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    marketingPageId();
    const body = await readMarketingJson(request);
    const psid = parsePsid(body.psid);
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text || Array.from(text).length > 2000) throw new InvalidMarketingRequest('Tin nhắn phải từ 1 đến 2.000 ký tự.');
    if (typeof body.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.requestId)) {
      throw new InvalidMarketingRequest('Thiếu mã yêu cầu gửi.');
    }
    const result = await sendMessengerMessage({ psid, text, requestId: `${REMARKETING_PREFIX}${body.requestId}` });
    return Response.json({ sentAt: result.message.timestamp }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return marketingErrorResponse(error);
  }
}
