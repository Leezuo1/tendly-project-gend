import { liveErrorResponse, liveJson, parseGroupKey, parseSessionId } from '@/lib/services/live/api';
import { approveGroup } from '@/lib/services/live/reply';
import { InvalidMarketingRequest, marketingPageId, readMarketingJson } from '@/lib/services/marketingApi';
import { requireDashboardKey } from '@/lib/services/postsApi';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Duyệt câu trả lời của nhóm { text, revision } và nhắn riêng cho tối đa 15 khách mỗi lần gọi.
 * Kết quả có `remaining` > 0 thì gọi lại (với `revision` mới trả về) để gửi tiếp.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; key: string }> }) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const { id, key } = await params;
    const body = await readMarketingJson(request);
    if (typeof body.text !== 'string' || typeof body.revision !== 'number' || !Number.isInteger(body.revision)) {
      throw new InvalidMarketingRequest('Cần nội dung trả lời và revision của nhóm.');
    }
    return liveJson(await approveGroup(marketingPageId(), parseSessionId(id), parseGroupKey(key), body.text, body.revision));
  } catch (error) {
    return liveErrorResponse(error);
  }
}
