import { NextResponse } from 'next/server';
import { buildAiSystemPrompt, InvalidAiKnowledge, knowledgeSummary, parseAiKnowledge } from '@/lib/services/aiKnowledge';
import { AI_RESPONSE_SCHEMA, EMOTION_RESPONSE_PROMPT, parseAiChatOutput, parseSessionContext } from '@/lib/services/aiAnalysis';

export const runtime = 'nodejs';

const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
];

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
}

export async function POST(request: Request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Nội dung yêu cầu không phải JSON hợp lệ.' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || typeof body.message !== 'string' ||
      !body.message.trim() || body.message.length > 8000) {
    return NextResponse.json({ error: 'Vui lòng gửi câu hỏi từ 1 đến 8.000 ký tự.' }, { status: 400 });
  }

  let knowledge;
  let sessionContext;
  try {
    // Cấu hình hiện lưu trong mock DB ở trình duyệt: yêu cầu dữ liệu đã lưu,
    // không tự dùng seed trên server vì sẽ bỏ qua chỉnh sửa của chủ shop.
    knowledge = parseAiKnowledge(body.knowledge);
    sessionContext = parseSessionContext(body.sessionContext);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof InvalidAiKnowledge ? error.message : 'Cấu hình AI hoặc ngữ cảnh chat không hợp lệ.',
    }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ.' }, { status: 503 });
  }

  // Chỉ server quyết định chỉ dẫn; không chấp nhận systemPrompt tùy ý từ khách.
  const systemInstruction = `${EMOTION_RESPONSE_PROMPT}\n\n${buildAiSystemPrompt(knowledge)}`;
  const models = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : CANDIDATE_MODELS;

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: AbortSignal.timeout(25_000),
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: 'user', parts: [{ text: JSON.stringify({
              sessionContext,
              latestCustomerMessage: body.message.trim(),
            }) }] }],
            generationConfig: {
              temperature: 0.1, topP: 0.8, maxOutputTokens: 1024,
              responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: AI_RESPONSE_SCHEMA } },
            },
          }),
        },
      );
      if (!res.ok) continue;

      const data = await res.json() as GeminiResponse;
      const output = data.candidates?.[0]?.content?.parts
        ?.filter((part) => !part.thought && typeof part.text === 'string')
        .map((part) => part.text).join('\n').trim();
      if (!output) continue;
      const { reply, analysis } = parseAiChatOutput(output);

      return NextResponse.json({
        success: true,
        reply,
        analysis,
        model,
        sourceSummary: knowledgeSummary(knowledge),
      });
    } catch {
      // Thử model tiếp theo khi model hiện tại lỗi hoặc quá thời gian chờ.
    }
  }

  return NextResponse.json({
    error: 'Không thể kết nối đến Gemini API. Vui lòng thử lại sau giây lát.',
  }, { status: 502 });
}
