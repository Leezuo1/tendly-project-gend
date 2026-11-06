import { withAppAccess } from '@/lib/services/appSecurity';
import { buildPostPrompt, parsePostOutput, parsePostRequest, POST_RESPONSE_SCHEMA } from '@/lib/services/aiPost';
import { InvalidAiKnowledge, parseAiKnowledge } from '@/lib/services/aiKnowledge';
import { GeminiNotConfigured, GeminiUnavailable, generateGeminiJson } from '@/lib/services/gemini';
import { postsErrorResponse, readJson, requireDashboardKey } from '@/lib/services/postsApi';
import { reviewPostDrafts } from '@/lib/services/aiPostReview';
import { knowledgeReviewSources, reviewHash, selectReviewEvidence } from '@/lib/services/reviewEvidence';
import type { AiKnowledge } from '@/lib/types/ai';
import type { GeneratedPostDraft, PostGenerationRequest } from '@/lib/types/posts';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** AI viết bản nháp — không lưu gì, chủ shop xem/sửa rồi mới lưu hoặc đăng. */
export const POST = withAppAccess(async function POST(request: Request) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;

  let prompt;
  let expected;
  let knowledge: AiKnowledge;
  let postRequest: PostGenerationRequest;
  let originals: GeneratedPostDraft[] | undefined;
  try {
    const body = await readJson(request) as { request?: unknown; knowledge?: unknown; originals?: unknown };
    postRequest = parsePostRequest(body?.request);
    // Cấu hình hiện lưu ở mock DB trên trình duyệt (giống /api/chat): server kiểm tra lại trước khi dùng.
    knowledge = parseAiKnowledge(body?.knowledge);
    prompt = buildPostPrompt(postRequest, knowledge);
    expected = postRequest.variants;
    if (body.originals !== undefined) {
      if (!Array.isArray(body.originals) || body.originals.length !== expected) throw new InvalidAiKnowledge('Bản gốc cần Review không hợp lệ.');
      originals = parsePostOutput(JSON.stringify({ variants: body.originals }), expected);
    }
  } catch (error) {
    if (error instanceof InvalidAiKnowledge) return Response.json({ error: error.message }, { status: 400 });
    return postsErrorResponse(error);
  }

  try {
    const deadline = AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]);
    const { result, model } = originals ? { result: originals, model: 'retry-review' } : await generateGeminiJson({
      role: 'content', platform: postRequest.channel,
      system: prompt.system,
      user: prompt.user,
      schema: POST_RESPONSE_SCHEMA,
      temperature: 0.9,
      signal: AbortSignal.any([deadline, AbortSignal.timeout(20_000)]),
      parse: (output) => parsePostOutput(output, expected),
    });
    const scope = 'post-request';
    const catalog = knowledgeReviewSources(knowledge, scope, 'request-input', reviewHash(knowledge), null);
    catalog.push({ id: 'request:brief', kind: 'brief', origin: 'request-input', scope, version: reviewHash(postRequest), confirmedAt: null, validFrom: null, validUntil: null,
      data: { channel: postRequest.channel, goal: postRequest.goal, notes: postRequest.notes, tone: postRequest.tone, brandVoice: postRequest.brandVoice } });
    const evidence = selectReviewEvidence(result, catalog, scope, postRequest.productIds, reviewHash({ request: postRequest, knowledge }));
    const review = await reviewPostDrafts(result, evidence, postRequest.channel, model, deadline);
    return Response.json({ drafts: review.variants.flatMap(item => item.finalDraft ? [item.finalDraft] : []), model, review });
  } catch (error) {
    if (error instanceof GeminiNotConfigured) return Response.json({ error: error.message }, { status: 503 });
    if (error instanceof GeminiUnavailable) return Response.json({ error: error.message }, { status: 502 });
    throw error;
  }
});
