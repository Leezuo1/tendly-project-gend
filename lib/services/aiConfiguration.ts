export const AI_SOURCES = {
  shop: 'Thông tin shop', products: 'Sản phẩm', faqs: 'FAQ & chính sách',
  campaign: 'Brief campaign', conversation: 'Ngữ cảnh hội thoại', market: 'Dữ liệu thị trường có nguồn', live: 'Bình luận & phiên live',
} as const;
export type AiSource = keyof typeof AI_SOURCES;
export const AI_MODES = { manual: 'Thủ công', assist: 'Gợi ý, có phê duyệt', auto: 'Tự động có điều kiện' } as const;
export type AiMode = keyof typeof AI_MODES;

export const AI_ROLES = [
  { id: 'content', label: 'AI soạn nội dung', description: 'Từ brief đến dàn ý và bài viết theo từng nền tảng.',
    goal: 'Lập trụ cột nội dung, heading và dàn ý từ brief đã duyệt; soạn bài phù hợp từng kênh.',
    tone: 'Rõ ràng, gần gũi, đúng giọng thương hiệu.',
    input: 'Mục tiêu campaign, tệp khách, sản phẩm, trụ cột và yêu cầu nội dung đã duyệt.',
    output: 'Kế hoạch, heading, dàn ý và bản nháp từng kênh; ghi rõ sản phẩm và CTA.',
    guard: 'Kế hoạch và bài viết phải được duyệt riêng. Không tự đặt ưu đãi hoặc tự đăng bài.',
    sources: ['shop', 'products', 'faqs', 'campaign'] },
  { id: 'chat', label: 'AI hội thoại', description: 'Tư vấn đúng sản phẩm, hiểu nhu cầu và hỏi lại khi thiếu dữ liệu.',
    goal: 'Giải đáp theo sản phẩm và FAQ; thu thập thông tin còn thiếu và nhận diện khi cần người xử lý.',
    tone: 'Thân thiện, ngắn gọn, tôn trọng cảm xúc của khách.',
    input: 'Tin nhắn mới, lịch sử hội thoại, sản phẩm đang hỏi và chính sách shop.',
    output: 'Câu trả lời đề xuất, nhãn nhu cầu, thông tin cần hỏi lại và lý do cần người xử lý.',
    guard: 'Không tự xác nhận thanh toán, hoàn tiền hoặc đơn hoàn tất. Mode hội thoại không được vượt công tắc Page.',
    sources: ['shop', 'products', 'faqs', 'conversation'] },
  { id: 'review', label: 'AI kiểm tra nội dung', description: 'Đối chiếu nội dung với brief, dữ liệu shop và quy tắc kênh.',
    goal: 'Phát hiện thông tin thiếu căn cứ, sai dữ kiện hoặc lệch brief trước khi shop phê duyệt.',
    tone: 'Khách quan, cụ thể, giải thích ngắn và đề xuất cách sửa.',
    input: 'Bản nháp, brief đã duyệt, dữ liệu sản phẩm và quy tắc nội dung của kênh.',
    output: 'Đạt / cần sửa / chặn; vị trí vấn đề, căn cứ đối chiếu và đề xuất chỉnh sửa.',
    guard: 'AI kiểm tra vẫn có thể sai; không thay quyền duyệt của shop hoặc kiểm tra quyền bằng backend.',
    sources: ['shop', 'products', 'faqs', 'campaign'] },
  { id: 'sourcing', label: 'AI Smart Sourcing', description: 'Giải thích tín hiệu sản phẩm và nguồn hàng từ dữ liệu có bằng chứng.',
    goal: 'Nhận diện sản phẩm liên quan và giải thích tín hiệu đáng xem xét từ dữ liệu đã thu thập.',
    tone: 'Có căn cứ, phân biệt điều đã biết với thông tin còn thiếu.',
    input: 'Ngành hàng, từ khóa, dữ liệu thu thập, URL nguồn và thời điểm thu thập.',
    output: 'Sản phẩm đáng chú ý, nguồn tham khảo, bằng chứng và dữ kiện cần shop xác minh.',
    guard: 'Một lần thu thập không chứng minh xu hướng tăng. Không tự xác minh nhà cung cấp hay đặt hàng.',
    sources: ['shop', 'products', 'market'] },
  { id: 'livestream', label: 'AI Livestream', description: 'Gom câu hỏi, hỗ trợ phản hồi và chuẩn bị đơn nháp trong phiên live.',
    goal: 'Hỗ trợ xử lý bình luận theo nhóm, tư vấn sản phẩm đang lên sóng và đề xuất đơn nháp.',
    tone: 'Nhanh, dễ đọc, rõ sản phẩm và những thông tin cần xác nhận.',
    input: 'Bình luận, sản phẩm đang lên sóng, danh mục phiên live và trạng thái tồn kho.',
    output: 'Nhóm câu hỏi, phản hồi đề xuất, đơn nháp và tổng kết phiên.',
    guard: 'Đơn nháp cần được xác nhận. Không coi giữ hàng là thanh toán; không hứa tồn từng size từ tồn tổng.',
    sources: ['shop', 'products', 'faqs', 'live'] },
] as const;
export type AiRoleId = typeof AI_ROLES[number]['id'];

export interface AiProfile {
  name: string; enabled: boolean; goal: string; tone: string; input: string; output: string;
  instructions: string; mode: AiMode; sources: AiSource[];
}
export interface AiConfiguration {
  version: 1;
  profiles: Record<AiRoleId, AiProfile>;
  binding: { pageName: string; enabled: boolean; mode: AiMode };
  updatedAt: number | null;
}

export function defaultAiConfiguration(): AiConfiguration {
  const profiles = Object.fromEntries(AI_ROLES.map(role => [role.id, {
    name: role.label, enabled: false, goal: role.goal, tone: role.tone, input: role.input, output: role.output,
    instructions: '', mode: 'assist', sources: [...role.sources],
  }])) as AiConfiguration['profiles'];
  return { version: 1, profiles, binding: { pageName: '', enabled: false, mode: 'assist' }, updatedAt: null };
}

export function parseAiConfiguration(value: unknown): AiConfiguration {
  const object = (v: unknown): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Bản thiết lập AI không hợp lệ.');
    return v as Record<string, unknown>;
  };
  const text = (v: unknown, max: number, label: string, required = true) => {
    if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw new Error(`${label}: cần nhập nội dung, tối đa ${max} ký tự.`);
    return v.trim();
  };
  const boolean = (v: unknown) => {
    if (typeof v !== 'boolean') throw new Error('Trạng thái bật/tắt AI không hợp lệ.');
    return v;
  };
  const mode = (v: unknown, allowAuto: boolean): AiMode => {
    if (v !== 'manual' && v !== 'assist' && !(allowAuto && v === 'auto')) throw new Error('Chế độ hoạt động AI không hợp lệ.');
    return v;
  };
  const data = object(value);
  if (data.version !== 1) throw new Error('Phiên bản thiết lập AI chưa được hỗ trợ. Dữ liệu cũ vẫn được giữ.');
  if (data.updatedAt !== null && (typeof data.updatedAt !== 'number' || !Number.isSafeInteger(data.updatedAt) || data.updatedAt < 0)) throw new Error('Thời điểm lưu AI không hợp lệ.');
  const storedProfiles = object(data.profiles);
  const profiles = Object.fromEntries(AI_ROLES.map(role => {
    const p = object(storedProfiles[role.id]);
    if (!Array.isArray(p.sources) || p.sources.length > role.sources.length || p.sources.some(s => !(role.sources as readonly unknown[]).includes(s))) throw new Error(`${role.label}: nguồn tri thức không hợp lệ.`);
    return [role.id, {
      name: text(p.name, 100, `${role.label} — tên`), enabled: boolean(p.enabled),
      goal: text(p.goal, 1500, `${role.label} — mục tiêu`), tone: text(p.tone, 500, `${role.label} — văn phong`),
      input: text(p.input, 1500, `${role.label} — input`), output: text(p.output, 1500, `${role.label} — output`),
      instructions: text(p.instructions, 2000, `${role.label} — chỉ dẫn bổ sung`, false),
      mode: mode(p.mode, role.id === 'chat'), sources: [...new Set(p.sources)] as AiSource[],
    }];
  })) as AiConfiguration['profiles'];
  const binding = object(data.binding);
  const enabled = boolean(binding.enabled);
  return { version: 1, profiles, updatedAt: data.updatedAt as number | null,
    binding: { pageName: text(binding.pageName, 200, 'Tên Fanpage', enabled), enabled, mode: mode(binding.mode, true) } };
}

// shortcut: browser-only profiles, move to authenticated server storage before connecting automation.
export function readAiConfiguration(owner: string): AiConfiguration {
  if (!owner) throw new Error('Chưa xác định tài khoản lưu bản thiết lập.');
  const raw = localStorage.getItem(`tendly.ai-configuration.v1:${owner}`);
  return raw === null ? defaultAiConfiguration() : parseAiConfiguration(JSON.parse(raw));
}

export function saveAiConfiguration(value: AiConfiguration, owner: string): AiConfiguration {
  if (!owner) throw new Error('Chưa xác định tài khoản lưu bản thiết lập.');
  const parsed = parseAiConfiguration({ ...value, updatedAt: Date.now() });
  localStorage.setItem(`tendly.ai-configuration.v1:${owner}`, JSON.stringify(parsed));
  return parsed;
}
