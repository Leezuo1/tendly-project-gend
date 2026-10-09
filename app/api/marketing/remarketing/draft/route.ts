import { parseAiKnowledge } from '@/lib/services/aiKnowledge';
import { buildRemarketingPrompt, parseRemarketingOutput, REMARKETING_RESPONSE_SCHEMA } from '@/lib/services/aiRemarketing';
import { generateGeminiJson } from '@/lib/services/gemini';
import { InvalidMarketingRequest, marketingErrorResponse, marketingPageId, parsePsid, readMarketingJson } from '@/lib/services/marketingApi';
import { readConversationForDraft } from '@/lib/services/marketingInsights';
import { requireDashboardKey } from '@/lib/services/postsApi';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** AI soạn tin nhắn lại cho một khách — chỉ trả bản nháp, chủ shop duyệt rồi mới gửi. */
export async function POST(request: Request) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const pageId = marketingPageId();
    const body = await readMarketingJson(request);
    const psid = parsePsid(body.psid);
    const knowledge = parseAiKnowledge(body.knowledge);
    const conversation = await readConversationForDraft(pageId, psid);
    if (!conversation || !conversation.messages.length) throw new InvalidMarketingRequest('Không tìm thấy hội thoại của khách này.');
    const prompt = buildRemarketingPrompt(conversation, knowledge);
    const { result } = await generateGeminiJson({
      system: prompt.system, user: prompt.user, schema: REMARKETING_RESPONSE_SCHEMA,
      temperature: 0.7, maxOutputTokens: 1024, parse: parseRemarketingOutput,
    });
    return Response.json({ draft: result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return marketingErrorResponse(error);
  }
}
