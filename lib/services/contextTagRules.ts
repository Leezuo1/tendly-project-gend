// Logic nhãn ngữ cảnh không phụ thuộc trình duyệt: dùng chung cho Cài đặt, Inbox và máy chủ (lưu cùng danh mục shop).
import type { ContextTagRule } from '@/lib/types/contextTags';
import type { ConversationTag, StaffLabels } from '@/lib/types/inbox';
import { normalize } from '@/lib/utils/format';

export const DEFAULT_CONTEXT_TAG_RULES: ContextTagRule[] = [
  { id: 'buy', label: 'Muốn đặt hàng', keywords: ['chốt đơn', 'đặt hàng', 'mua ngay', 'lấy cho mình'], type: 'positive', enabled: true },
  { id: 'delivery', label: 'Hỏi giao hàng', keywords: ['giao hàng', 'phí ship', 'bao giờ nhận', 'vận chuyển'], type: 'neutral', enabled: true },
  { id: 'returns', label: 'Đổi trả', keywords: ['đổi trả', 'hoàn tiền', 'hàng lỗi', 'sai mẫu'], type: 'risk', enabled: true },
  { id: 'product', label: 'Tư vấn sản phẩm', keywords: ['chất liệu', 'chọn size', 'kích thước', 'còn màu'], type: 'neutral', enabled: true },
];
export const CONTEXT_TAG_COLORS = { positive: 'Xanh lá', neutral: 'Trung tính', risk: 'Cam', high: 'Đỏ', vip: 'Tím', loop: 'Xanh dương' } as const;

const words = (text: string) => normalize(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');

/** Nhãn không có từ khóa là hợp lệ: chỉ người hoặc AI dán, quy tắc không bao giờ tự dán. */
export function validateContextTagRule(rule: ContextTagRule): ContextTagRule {
  const label = rule.label.trim();
  const keywords = [...new Set(rule.keywords.map(word => word.trim()).filter(Boolean))];
  if (!rule.id || rule.id.length > 100 || !label || label.length > 50) throw new Error('Tên thẻ cần từ 1 đến 50 ký tự.');
  if (keywords.length > 20 || keywords.some(word => word.length > 100)) throw new Error('Tối đa 20 từ khóa, mỗi từ khóa tối đa 100 ký tự.');
  if (keywords.some(word => !words(word)) || !Object.hasOwn(CONTEXT_TAG_COLORS, rule.type) || typeof rule.enabled !== 'boolean') throw new Error('Quy tắc gắn thẻ không hợp lệ.');
  if (rule.context !== undefined && typeof rule.context !== 'string') throw new Error('Ngữ cảnh không hợp lệ.');
  const context = rule.context?.trim();
  if (context && context.length > 500) throw new Error('Ngữ cảnh tối đa 500 ký tự.');
  return { id: rule.id, label, keywords, type: rule.type, enabled: rule.enabled, ...(context ? { context } : {}) };
}

export function validateContextTagRules(rules: unknown): ContextTagRule[] {
  if (!Array.isArray(rules)) throw new Error('Quy tắc gắn thẻ không hợp lệ.');
  if (rules.length > 50) throw new Error('Tối đa 50 quy tắc gắn thẻ.');
  const valid = rules.map(rule => {
    if (!rule || typeof rule !== 'object' || typeof rule.id !== 'string' || typeof rule.label !== 'string' || !Array.isArray(rule.keywords)
      || rule.keywords.some((word: unknown) => typeof word !== 'string')) throw new Error('Quy tắc gắn thẻ không hợp lệ.');
    return validateContextTagRule(rule as ContextTagRule);
  });
  if (new Set(valid.map(rule => rule.id)).size !== valid.length || new Set(valid.map(rule => normalize(rule.label))).size !== valid.length) throw new Error('Tên thẻ đã tồn tại.');
  return valid;
}

/** Văn bản có chứa nguyên cụm này không (không phân biệt hoa thường, dấu, dấu câu; khớp cả từ). */
export function mentionsPhrase(text: string, phrase: string): boolean {
  const wanted = words(phrase);
  return !!wanted && ` ${words(text)} `.includes(` ${wanted} `);
}

export function matchContextTags(text: string, rules: ContextTagRule[]): ConversationTag[] {
  const content = ` ${words(text)} `;
  const labels = new Set<string>();
  return rules.filter(rule => rule.enabled && rule.keywords.some(word => {
    const keyword = words(word);
    return keyword && content.includes(` ${keyword} `);
  })).filter(rule => {
    const label = normalize(rule.label);
    if (labels.has(label)) return false;
    labels.add(label); return true;
  }).map(rule => ({ id: rule.id, label: rule.label, type: rule.type, source: 'rule', kind: 'context' }));
}

export type StaffLabelAction = { type: 'add' | 'removeStaff' | 'hideRule'; id: string };

/**
 * Nhãn của hội thoại sau MỘT thao tác của nhân viên; máy chủ áp thao tác lên bản đang lưu (không ghi đè cả trạng thái từ máy khách),
 * luôn bỏ id đã bị xóa khỏi bộ nhãn và bỏ qua thao tác với id ngoài bộ nhãn.
 * Gỡ nhãn nhân viên dán cũng ẩn nó, để nhãn khớp từ khóa hay do AI chọn không hiện lại ngay.
 */
export function nextStaffLabels(current: StaffLabels | undefined, action: StaffLabelAction, rules: ContextTagRule[]): StaffLabels {
  const known = (id: string) => rules.some(rule => rule.id === id);
  const added = (current?.added ?? []).filter(known), hidden = (current?.hidden ?? []).filter(known);
  if (!known(action.id)) return { added, hidden };
  const withId = (list: string[]) => list.includes(action.id) ? list : [...list, action.id];
  if (action.type === 'add') return { added: withId(added), hidden: hidden.filter(id => id !== action.id) };
  if (action.type === 'removeStaff') return { added: added.filter(id => id !== action.id), hidden: withId(hidden) };
  return { added, hidden: withId(hidden) };
}
