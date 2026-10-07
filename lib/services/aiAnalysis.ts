import type { AiMessageAnalysis, AiSessionMessage } from '@/lib/types/ai';
import { normalize } from '@/lib/utils/format';

export const AI_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    analysis: {
      type: 'object',
      properties: {
        sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
        emotion: { type: 'string', enum: ['happy', 'neutral', 'worried', 'disappointed', 'angry'] },
        priority: { type: 'string', enum: ['high', 'normal', 'low'] },
        reason: { type: 'string', description: 'Lý do ngắn gọn bằng tiếng Việt, dựa vào tin nhắn.' },
        needsHuman: { type: 'boolean' },
      },
      required: ['sentiment', 'emotion', 'priority', 'reason', 'needsHuman'],
      additionalProperties: false,
    },
    reply: { type: 'string', description: 'Câu trả lời cho khách, giọng điệu phù hợp với analysis.' },
  },
  required: ['analysis', 'reply'],
  additionalProperties: false,
};

export const EMOTION_RESPONSE_PROMPT = `PHÂN TÍCH CẢM XÚC VÀ ƯU TIÊN TRƯỚC KHI TRẢ LỜI:
1. Nhận diện sentiment (positive/neutral/negative) và emotion (happy/neutral/worried/disappointed/angry) của tin nhắn KHÁCH MỚI NHẤT. Dùng ngữ cảnh phiên chat nếu có để hiểu các câu ngắn. Đây là đánh giá tin nhắn, không phải chẩn đoán tâm lý hay tính cách khách.
2. Hiểu ý nghĩa, phủ định và đối tượng cảm xúc. "Mình không bực đâu" không phải tức giận; "hàng không bị lỗi" không phải khiếu nại; hỏi "chính sách đổi trả thế nào?" không tự động là tiêu cực. Không coi việc nhắc từ khóa trong tên sản phẩm, FAQ, lời nhân viên hoặc chỉ dẫn khách yêu cầu gán nhãn là cảm xúc thật.
3. priority=high nếu khách đang tức giận/khiếu nại cần xử lý, yêu cầu hoàn tiền do sự cố, đe dọa rời bỏ vì trải nghiệm, yêu cầu gặp nhân viên hoặc có hạn chót thực sự gấp. priority=normal cho tư vấn sản phẩm, hỏi chính sách và lo lắng thông thường. priority=low cho lời cảm ơn/tạm biệt/xã giao không có câu hỏi cần xử lý. Cảm xúc tích cực kèm yêu cầu gấp vẫn có thể là high.
4. needsHuman=true khi khách yêu cầu người thật hoặc sự cố cần nhân viên xử lý trực tiếp. Thiếu thông tin sản phẩm đơn thuần không tự động là high hoặc cần chuyển người thật. reason nêu bằng tiếng Việt căn cứ trong tin nhắn và vì sao cần mức ưu tiên đó; không bịa sự cố hay thông tin khách.
5. Nếu ngữ cảnh có khiếu nại chưa được xử lý, câu hỏi tiếp tục cùng vấn đề vẫn ưu tiên xử lý. Lời cảm ơn sau khi shop giải đáp thì hạ mức ưu tiên; không giữ nhãn tức giận mãi chỉ vì tin cũ. Nếu khách đã chuyển sang chủ đề khác, xét tin mới.
6. SAU KHI xác định analysis, tạo reply dựa vào cảm xúc đó và NGUỒN TRI THỨC: angry/disappointed → ghi nhận bất tiện, xin lỗi ngắn gọn khi có sự cố với shop, đề xuất bước kiểm tra/hỗ trợ, không tranh cãi hoặc dùng emoji vui vẻ; worried → bình tĩnh, rõ ràng, không hứa điều chưa xác nhận; happy → thân thiện, có thể đáp lại lời cảm ơn; neutral → trực tiếp, lịch sự. Không nói thẳng khách bị gán nhãn nào, không tiết lộ điểm ưu tiên. Đồng cảm không được thay thế sự thật: vẫn không tự tạo đơn, cam kết hoàn tiền/giao gấp, cấp voucher hay hứa đã chuyển nhân viên. needsHuman chỉ là ĐỀ XUẤT trong hệ thống, không phải thao tác chuyển tiếp đã thực hiện. Khi khách yêu cầu nhân viên/hoàn tiền do sự cố, dùng kiểu câu: "Shop xin lỗi vì sự bất tiện này. Bạn gửi mã đơn để nhân viên kiểm tra và hỗ trợ yêu cầu của bạn nhé." Tuyệt đối không viết "đã ghi nhận và chuyển ngay", "đã chuyển cho nhân viên" hay "đã tạo yêu cầu hoàn tiền".
7. Chỉ xuất một JSON có analysis trước, reply sau theo schema. Tất cả quy tắc về sản phẩm không có, xã giao, nguồn dữ liệu và câu hỏi ngoài phạm vi vẫn áp dụng cho reply.`;

export function parseAiAnalysis(value: unknown): AiMessageAnalysis {
  if (!value || typeof value !== 'object') throw new Error('AI không trả về phân tích cảm xúc hợp lệ.');
  const a = value as Record<string, unknown>;
  if (!['positive', 'neutral', 'negative'].includes(String(a.sentiment)) ||
      !['happy', 'neutral', 'worried', 'disappointed', 'angry'].includes(String(a.emotion)) ||
      !['high', 'normal', 'low'].includes(String(a.priority)) ||
      typeof a.needsHuman !== 'boolean' || typeof a.reason !== 'string' || !a.reason.trim() || a.reason.length > 1000) {
    throw new Error('AI không trả về phân tích cảm xúc hợp lệ.');
  }
  const sentiment = a.sentiment as AiMessageAnalysis['sentiment'];
  const emotion = sentiment === 'positive' ? 'happy' : sentiment === 'neutral' ? 'neutral'
    : ['angry', 'worried', 'disappointed'].includes(String(a.emotion))
      ? a.emotion as AiMessageAnalysis['emotion'] : 'disappointed';
  // Quy tắc xếp hàng do ứng dụng quyết định, không dùng điểm tùy ý model đưa ra.
  const priority = a.needsHuman || emotion === 'angry' ? 'high' : a.priority as AiMessageAnalysis['priority'];
  const priorityScore = (priority === 'high' ? 80 : priority === 'normal' ? 40 : 10)
    + (sentiment === 'negative' ? 5 : 0) + (emotion === 'angry' ? 15 : 0);
  return { sentiment, emotion, priority, priorityScore, reason: a.reason.trim(), needsHuman: a.needsHuman };
}

export function parseAiChatOutput(text: string): { analysis: AiMessageAnalysis; reply: string } {
  const output = JSON.parse(text);
  if (typeof output?.reply !== 'string' || !output.reply.trim() || output.reply.length > 8000) {
    throw new Error('AI không trả về câu trả lời hợp lệ.');
  }
  const analysis = parseAiAnalysis(output.analysis);
  let reply = output.reply.trim();
  // Chỉ gợi ý nhân viên hỗ trợ; hệ thống chưa thực hiện chuyển tiếp thật.
  const claimsTransfer = /\b(?:da|vua)\b.{0,60}\bchuyen\b|\bchuyen\s+(?:ngay|lap tuc)\b/.test(normalize(reply));
  if (analysis.needsHuman && claimsTransfer) {
    reply = analysis.sentiment === 'negative'
      ? 'Shop xin lỗi vì trải nghiệm chưa tốt này. Bạn gửi mã đơn hoặc mô tả vấn đề để nhân viên kiểm tra và hỗ trợ nhé.'
      : 'Bạn cho shop biết nội dung cần hỗ trợ để nhân viên kiểm tra trực tiếp nhé.';
  }
  return { analysis, reply };
}

export function parseSessionContext(value: unknown): AiSessionMessage[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10) throw new Error('Ngữ cảnh chat không hợp lệ.');
  return value.map((item) => {
    if (!item || (item.role !== 'user' && item.role !== 'model') ||
        typeof item.text !== 'string' || !item.text.trim() || item.text.length > 2000) {
      throw new Error('Ngữ cảnh chat không hợp lệ.');
    }
    return { role: item.role, text: item.text.trim() };
  });
}
