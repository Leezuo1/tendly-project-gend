import { buildPostPrompt, parsePostOutput, parsePostRequest, POST_RESPONSE_SCHEMA } from '@/lib/services/aiPost';
import { InvalidAiKnowledge, parseAiKnowledge } from '@/lib/services/aiKnowledge';
import { GeminiNotConfigured, GeminiUnavailable, generateGeminiJson } from '@/lib/services/gemini';
import { postsErrorResponse, readJson, requireDashboardKey } from '@/lib/services/postsApi';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** AI viết bản nháp — không lưu gì, chủ shop xem/sửa rồi mới lưu hoặc đăng. */
export async function POST(request: Request) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;

  let prompt;
  let expected;
  try {
    const body = await readJson(request) as { request?: unknown; knowledge?: unknown };
    const postRequest = parsePostRequest(body?.request);
    // Cấu hình hiện lưu ở mock DB trên trình duyệt (giống /api/chat): server kiểm tra lại trước khi dùng.
    prompt = buildPostPrompt(postRequest, parseAiKnowledge(body?.knowledge));
    expected = postRequest.variants;
  } catch (error) {
    if (error instanceof InvalidAiKnowledge) return Response.json({ error: error.message }, { status: 400 });
    return postsErrorResponse(error);
  }

  try {
    const { result, model } = await generateGeminiJson({
      system: prompt.system,
      user: prompt.user,
      schema: POST_RESPONSE_SCHEMA,
      temperature: 0.9,
      parse: (output) => parsePostOutput(output, expected),
    });
    return Response.json({ drafts: result, model });
  } catch (error) {
    if (error instanceof GeminiNotConfigured) return Response.json({ error: error.message }, { status: 503 });
    if (error instanceof GeminiUnavailable) return Response.json({ error: error.message }, { status: 502 });
    throw error;
  }
}
