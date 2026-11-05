import type { ContextTagRule } from '@/lib/types/contextTags';
import type { Conversation, ConversationTag } from '@/lib/types/inbox';
import { normalize } from '@/lib/utils/format';
import { readDb, writeDb } from './mockDb';

export const DEFAULT_CONTEXT_TAG_RULES: ContextTagRule[] = [
  { id: 'buy', label: 'Muốn đặt hàng', keywords: ['chốt đơn', 'đặt hàng', 'mua ngay', 'lấy cho mình'], type: 'positive', enabled: true },
  { id: 'delivery', label: 'Hỏi giao hàng', keywords: ['giao hàng', 'phí ship', 'bao giờ nhận', 'vận chuyển'], type: 'neutral', enabled: true },
  { id: 'returns', label: 'Đổi trả', keywords: ['đổi trả', 'hoàn tiền', 'hàng lỗi', 'sai mẫu'], type: 'risk', enabled: true },
  { id: 'product', label: 'Tư vấn sản phẩm', keywords: ['chất liệu', 'chọn size', 'kích thước', 'còn màu'], type: 'neutral', enabled: true },
];
export const CONTEXT_TAG_COLORS = { positive: 'Xanh lá', neutral: 'Trung tính', risk: 'Cam', high: 'Đỏ', vip: 'Tím', loop: 'Xanh dương' } as const;

export function validateContextTagRule(rule: ContextTagRule): ContextTagRule {
  const label = rule.label.trim();
  const keywords = [...new Set(rule.keywords.map(word => word.trim()).filter(Boolean))];
  if (!rule.id || rule.id.length > 100 || !label || label.length > 50) throw new Error('Tên thẻ cần từ 1 đến 50 ký tự.');
  if (!keywords.length || keywords.length > 20 || keywords.some(word => word.length > 100)) throw new Error('Nhập 1–20 từ khóa, mỗi từ khóa tối đa 100 ký tự.');
  if (keywords.some(word => !words(word)) || !Object.hasOwn(CONTEXT_TAG_COLORS, rule.type) || typeof rule.enabled !== 'boolean') throw new Error('Quy tắc gắn thẻ không hợp lệ.');
  return { ...rule, label, keywords };
}

const words = (text: string) => normalize(text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
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
  }).map(rule => ({ label: rule.label, type: rule.type, source: 'rule', kind: 'context' }));
}

export function readContextTagRules(): ContextTagRule[] {
  return structuredClone(readDb().contextTagRules ?? DEFAULT_CONTEXT_TAG_RULES);
}
export function saveContextTagRules(rules: ContextTagRule[]) {
  if (rules.length > 50) throw new Error('Tối đa 50 quy tắc gắn thẻ.');
  const valid = rules.map(validateContextTagRule);
  if (new Set(valid.map(rule => rule.id)).size !== valid.length || new Set(valid.map(rule => normalize(rule.label))).size !== valid.length) throw new Error('Tên thẻ đã tồn tại.');
  writeDb(db => { db.contextTagRules = valid; });
}

export function applyContextTags(conversation: Conversation, rules: ContextTagRule[]): Conversation {
  // Match the latest customer turn; older requests must not keep obsolete context tags.
  const latest = conversation.messages.findLast(message => message.sender === 'in' && !message.isDivider);
  const tags = matchContextTags(latest?.text ?? '', rules);
  const replace = (previous: ConversationTag[]) => [...previous.filter(tag => tag.source !== 'rule'), ...tags];
  return { ...conversation, tags: replace(conversation.tags), profile: { ...conversation.profile, tags: replace(conversation.profile.tags) } };
}
