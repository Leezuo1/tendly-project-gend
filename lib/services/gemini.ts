/** Gọi Gemini generateContent với kết quả JSON có cấu trúc (cùng cách gọi với app/api/chat). */
import { globalAiSystemPrompt } from '@/lib/services/aiGlobalSettings';
import type { AiRoleId } from '@/lib/services/aiConfiguration';

export const GEMINI_CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
];

export class GeminiNotConfigured extends Error {}
export class GeminiUnavailable extends Error {}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
}

interface GenerateJsonOptions<T> {
  /** 'sourcing' do dev đặt prompt cố định, không đi qua cấu hình admin/shop. */
  role: AiRoleId | 'sourcing';
  platform?: string;
  pageId?: string;
  /** false khi nơi gọi đã tự nhúng hồ sơ shop (bản đã duyệt của campaign, hồ sơ AI Chat). */
  includeShop?: boolean;
  signal?: AbortSignal;
  system: string;
  user: string;
  schema: object;
  /** Ảnh gửi kèm lời nhắc (base64); không có thì yêu cầu chỉ gồm chữ như trước. */
  images?: { mimeType: string; data: string }[];
  temperature?: number;
  maxOutputTokens?: number;
  /** Thời gian tối đa cho MỖI lần gọi một model (mặc định 40 s). Đặt ngắn hơn `signal` tổng để model bị treo không ăn hết ngân sách, model kế tiếp vẫn kịp trả lời. */
  attemptTimeoutMs?: number;
  /** Kiểm tra output; ném lỗi để thử model tiếp theo. */
  parse: (output: string) => T;
}

export async function generateGeminiJson<T>(options: GenerateJsonOptions<T>): Promise<{ result: T; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiNotConfigured('Chưa cấu hình GEMINI_API_KEY trên máy chủ.');
  const system = options.role === 'sourcing' ? options.system
    : `${await globalAiSystemPrompt(options.role, options.platform, options.pageId, options.includeShop)}\n\n${options.system}`;
  const base = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : GEMINI_CANDIDATE_MODELS;
  // Marketing/content and Smart Sourcing may use their own model; a bad id falls back to the usual list.
  const contentModel = options.role === 'content' || options.role === 'sourcing' ? process.env.GEMINI_CONTENT_MODEL : undefined;
  const models = contentModel ? [...new Set([contentModel, ...base])] : base;

  for (const model of models) {
    if (options.signal?.aborted) break;
    const started = Date.now();
    let usage: GeminiResponse['usageMetadata'];
    // One line per attempt: which role/model, how it ended, how long, tokens billed (for credit pricing). Never the prompt or the answer, which may hold customer data.
    const log = (outcome: string) => console.info(JSON.stringify({
      ai: options.role, platform: options.platform, model, outcome, ms: Date.now() - started,
      tokens: usage && { in: usage.promptTokenCount, out: usage.candidatesTokenCount, think: usage.thoughtsTokenCount },
    }));
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(options.attemptTimeoutMs ?? 40_000)]) : AbortSignal.timeout(options.attemptTimeoutMs ?? 40_000),
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: options.user },
              ...(options.images ?? []).map((image) => ({ inline_data: { mime_type: image.mimeType, data: image.data } }))] }],
            generationConfig: {
              temperature: options.temperature ?? 0.8,
              topP: 0.95,
              maxOutputTokens: options.maxOutputTokens ?? 4096,
              responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: options.schema } },
            },
          }),
        },
      );
      if (!res.ok) { log(`http_${res.status}`); continue; }
      const data = await res.json() as GeminiResponse;
      usage = data.usageMetadata;
      const output = data.candidates?.[0]?.content?.parts
        ?.filter((part) => !part.thought && typeof part.text === 'string')
        .map((part) => part.text).join('\n').trim();
      if (!output) { log('empty'); continue; }
      const result = options.parse(output);
      log('ok');
      return { result, model };
    } catch (error) {
      // Lỗi mạng, quá thời gian hoặc output sai định dạng: thử model tiếp theo.
      log(`error_${error instanceof Error ? error.name : 'unknown'}`);
    }
  }
  throw new GeminiUnavailable('Không thể kết nối đến Gemini API. Vui lòng thử lại sau giây lát.');
}
