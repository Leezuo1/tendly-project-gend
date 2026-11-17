import type { ContextTagRule } from '@/lib/types/contextTags';
import type { Conversation, ConversationTag } from '@/lib/types/inbox';
import { DEFAULT_CONTEXT_TAG_RULES, matchContextTags, validateContextTagRules } from '@/lib/services/contextTagRules';
import { readDb, writeDb } from './mockDb';

export { CONTEXT_TAG_COLORS, DEFAULT_CONTEXT_TAG_RULES, matchContextTags, nextStaffLabels, validateContextTagRule, validateContextTagRules } from '@/lib/services/contextTagRules';

export function readContextTagRules(): ContextTagRule[] {
  return structuredClone(readDb().contextTagRules ?? DEFAULT_CONTEXT_TAG_RULES);
}
export function saveContextTagRules(rules: ContextTagRule[]) {
  const valid = validateContextTagRules(rules);
  writeDb(db => { db.contextTagRules = valid; });
}

/** Nhãn ngữ cảnh lúc hiển thị: nhân viên dán > AI chọn > từ khóa, mỗi nhãn một chip, bỏ nhãn tự động nhân viên đã gỡ. */
export function applyContextTags(conversation: Conversation, rules: ContextTagRule[]): Conversation {
  // Match the latest customer turn; older requests must not keep obsolete context tags.
  const latest = conversation.messages.findLast(message => message.sender === 'in' && !message.isDivider);
  const { added = [], hidden = [] } = conversation.staffLabels ?? {};
  const tag = (id: string, source: 'staff' | 'ai'): ConversationTag[] => rules.filter(rule => rule.id === id)
    .map(rule => ({ id, label: rule.label, type: rule.type, source, kind: 'context' }));
  const tags: ConversationTag[] = [];
  for (const item of [...added.flatMap(id => tag(id, 'staff')), ...(conversation.analysis?.labels ?? []).flatMap(id => tag(id, 'ai')), ...matchContextTags(latest?.text ?? '', rules)]) {
    if (tags.some(shown => shown.id === item.id) || (item.source !== 'staff' && hidden.includes(item.id!))) continue;
    tags.push(item);
  }
  const replace = (previous: ConversationTag[]) => [...previous.filter(item => item.kind !== 'context'), ...tags];
  return { ...conversation, tags: replace(conversation.tags), profile: { ...conversation.profile, tags: replace(conversation.profile.tags) } };
}
