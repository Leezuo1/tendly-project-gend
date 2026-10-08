/** Gọi Gemini generateContent với kết quả JSON có cấu trúc (cùng cách gọi với app/api/chat). */

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
}

interface GenerateJsonOptions<T> {
  system: string;
  user: string;
  schema: object;
  temperature?: number;
  maxOutputTokens?: number;
  /** Kiểm tra output; ném lỗi để thử model tiếp theo. */
  parse: (output: string) => T;
}

export async function generateGeminiJson<T>(options: GenerateJsonOptions<T>): Promise<{ result: T; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiNotConfigured('Chưa cấu hình GEMINI_API_KEY trên máy chủ.');
  const models = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : GEMINI_CANDIDATE_MODELS;

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: AbortSignal.timeout(40_000),
          body: JSON.stringify({
            system_instruction: { parts: [{ text: options.system }] },
            contents: [{ role: 'user', parts: [{ text: options.user }] }],
            generationConfig: {
              temperature: options.temperature ?? 0.8,
              topP: 0.95,
              maxOutputTokens: options.maxOutputTokens ?? 4096,
              responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: options.schema } },
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
      return { result: options.parse(output), model };
    } catch {
      // Lỗi mạng, quá thời gian hoặc output sai định dạng: thử model tiếp theo.
    }
  }
  throw new GeminiUnavailable('Không thể kết nối đến Gemini API. Vui lòng thử lại sau giây lát.');
}
