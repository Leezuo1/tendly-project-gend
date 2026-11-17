import type { AiChatReply, AiSessionMessage, CustomerEmotion, ReplyPriority } from '@/lib/types/ai';
import type { ChatMessage, Conversation, ConversationTag } from '@/lib/types/inbox';

export const EMOTION_LABELS: Record<CustomerEmotion, string> = {
  happy: '😊 Tích cực', neutral: '😐 Trung lập', worried: '😟 Lo lắng',
  disappointed: '😞 Thất vọng', angry: '😠 Tức giận',
};

export const PRIORITY_LABELS: Record<ReplyPriority, string> = {
  high: 'Ưu tiên cao', normal: 'Ưu tiên bình thường', low: 'Ưu tiên thấp',
};

export function latestCustomerMessage(conversation: Conversation): ChatMessage | undefined {
  return [...conversation.messages].reverse().find((m) => m.sender === 'in' && !m.isDivider);
}

export function sessionContext(messages: ChatMessage[], latestMessageId?: string): AiSessionMessage[] {
  const end = latestMessageId ? messages.findIndex((m) => m.id === latestMessageId) : messages.length;
  return messages.slice(0, end < 0 ? messages.length : end)
    .filter((m) => !m.isDivider).slice(-10)
    .map((m) => ({ role: m.sender === 'in' ? 'user' : 'model', text: m.text.slice(0, 2000) }));
}

export function sortReplyQueue(conversations: Conversation[]): Conversation[] {
  const score = (c: Conversation) => c.analysis?.priorityScore ?? (c.isUrgent ? 80 : 40);
  return [...conversations].sort((a, b) => {
    const confirmation = Number(Boolean(b.isUnreplied && b.waitingConfirmation)) - Number(Boolean(a.isUnreplied && a.waitingConfirmation));
    if (confirmation) return confirmation;
    const unread = Number(Boolean(b.hasNewMessage)) - Number(Boolean(a.hasNewMessage));
    if (unread) return unread;
    if (a.hasNewMessage && b.hasNewMessage) {
      const recent = (latestCustomerMessage(b)?.timestamp ?? 0) - (latestCustomerMessage(a)?.timestamp ?? 0);
      if (recent) return recent;
    }
    const awaiting = Number(Boolean(b.isUnreplied)) - Number(Boolean(a.isUnreplied));
    if (awaiting) return awaiting;
    // Hội thoại đã trả lời không chen vào hàng chờ, không giữ điểm khẩn cấp cũ.
    if (!a.isUnreplied) return 0;
    return score(b) - score(a) || (a.pendingSince ?? 0) - (b.pendingSince ?? 0);
  });
}

export function automaticAnalysisCandidates(
  conversations: Conversation[], pending: Set<string>, attempted: Map<string, string>, capacity = 2,
): Conversation[] {
  return sortReplyQueue(conversations).filter((c) => {
    const message = latestCustomerMessage(c);
    return Boolean(c.messenger && c.isUnreplied && message
      && c.analysis?.messageId !== message.id
      && attempted.get(c.id) !== message.id && !pending.has(c.id));
  }).slice(0, Math.max(0, capacity - pending.size));
}

export function applyConversationAnalysis(conversation: Conversation, messageId: string, result: AiChatReply): Conversation {
  // Kết quả chậm không được ghi đè tin nhắn mới hoặc tạo lại đề xuất đã xử lý.
  if (latestCustomerMessage(conversation)?.id !== messageId || !conversation.isUnreplied) return conversation;
  if (result.sourceContext && conversation.sourceContext && result.sourceContext.fingerprint !== conversation.sourceContext.fingerprint) {
    return { ...conversation, aiSuggestion: undefined, aiStatus: 'error', aiError: 'Nguồn hoặc ưu đãi đã thay đổi. Tạo lại gợi ý trước khi gửi.' };
  }
  const a = result.analysis;
  // Cảm xúc chỉ dùng để xếp ưu tiên và chọn giọng trả lời; không hiện thành chip.
  const priorityTag: ConversationTag = {
    label: PRIORITY_LABELS[a.priority], type: a.priority === 'high' ? 'high' : 'neutral',
    source: 'ai', kind: 'priority',
  };
  return {
    ...conversation,
    waitingConfirmation: conversation.waitingConfirmation || a.canAutoReply === false,
    analysis: { ...a, messageId }, aiStatus: 'ready', aiError: undefined,
    isUrgent: a.priority === 'high',
    // Bỏ nhãn cảm xúc demo/cũ; giữ nhãn khách VIP trong danh sách.
    tags: [...conversation.tags.filter((t) => t.type === 'vip'), priorityTag],
    threadWho: { ...conversation.threadWho, badgeTag: undefined },
    profile: { ...conversation.profile,
      tags: conversation.profile.tags.filter((t) => t.type === 'vip' || (t.type === 'loop' && t.source !== 'ai')),
    },
    aiSuggestion: {
      sourceFingerprint: result.sourceContext?.fingerprint,
      label: '✨ AI đề xuất',
      source: result.sourceSummary, text: result.reply,
    },
  };
}

export function markConversationAnswered(conversation: Conversation, message: ChatMessage): Conversation {
  return {
    ...conversation, time: 'Vừa xong', preview: message.text,
    isUnreplied: false, isUrgent: false, aiSuggestion: undefined, waitingConfirmation: false,
    aiStatus: conversation.analysis ? 'ready' : undefined, aiError: undefined, pendingSince: undefined,
    tags: conversation.tags.filter((t) => t.kind !== 'priority'),
    messages: [...conversation.messages, message],
  };
}
