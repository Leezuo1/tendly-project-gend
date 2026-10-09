import type { Conversation, ChatMessage } from '@/lib/types/inbox';
import type { MessengerThread } from '@/lib/types/messengerInbox';
import type { MessengerMessage } from '@/lib/types/messenger';
import { applyConversationAnalysis } from '@/lib/services/inboxAi';

const time = (timestamp: number) => new Date(timestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
export function messengerChatMessage(m: MessengerMessage): ChatMessage {
  return { id: m.messageId, sender: m.direction, text: m.text || '[Tệp đính kèm]',
    timestamp: m.timestamp, time: time(m.timestamp), attachments: m.attachments };
}

export function mergeMessengerThread(thread: MessengerThread, previous?: Conversation): Conversation {
  // Retain pages of history already loaded and successful sends not echoed yet.
  const byId = new Map((previous?.messages || []).filter((m) => (m.timestamp || 0) > (thread.viewStartAt || 0)).map((m) => [m.id, m]));
  for (const m of thread.messages) byId.set(m.messageId, messengerChatMessage(m));
  const messages = [...byId.values()].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0) || a.id.localeCompare(b.id));
  const latest = messages.at(-1);
  const latestIn = [...messages].reverse().find((m) => m.sender === 'in');
  const latestOut = [...messages].reverse().find((m) => m.sender === 'out');
  const unanswered = latestIn !== undefined && (!latestOut || (latestIn.timestamp || 0) > (latestOut.timestamp || 0));
  const sameQuestion = previous?.analysis?.messageId === latestIn?.id;
  const previousIn = previous && [...previous.messages].reverse().find((m) => m.sender === 'in');
  // Only a newer customer message creates an unread marker; echoes and loaded history do not.
  const newIncoming = Boolean(latestIn && (!previous || (latestIn.id !== previousIn?.id
    && (latestIn.timestamp || 0) >= (previousIn?.timestamp || 0))));
  const previousIds = new Set(previous?.messages.map((m) => m.id));
  const unreadMessageIds = [...new Set([
    ...(previous?.unreadMessageIds || []),
    ...messages.filter((m) => m.sender === 'in' && !previousIds.has(m.id)
      && (previous
        ? (m.timestamp || 0) >= (previousIn?.timestamp || 0)
        : (m.timestamp || 0) > (latestOut?.timestamp || 0))).map((m) => m.id),
  ])];
  const name = thread.customer?.name || `Khách ${thread.psid.slice(-6)}`;
  const avatar = thread.customer?.name
    ? thread.customer.name.split(/\s+/).filter(Boolean).slice(-2).map((part) => Array.from(part)[0]).join('').toUpperCase()
    : 'FB';
  const avatarUrl = thread.customer?.avatarUrl || undefined;
  const base: Conversation = {
    memory: thread.memory || previous?.memory || [],
    personalitySummary: thread.personalitySummary || '',
    id: thread.id, messenger: { pageId: thread.pageId, psid: thread.psid, viewStartAt: thread.viewStartAt,
      hasOlder: previous?.messenger?.viewStartAt === thread.viewStartAt && previous?.messenger?.hasOlder === false && (previous.messages[0]?.timestamp || 0) < (thread.messages[0]?.timestamp || 0)
        ? false : thread.hasOlder },
    name, avatar, avatarUrl, channel: 'facebook', time: latest?.time || '', preview: latest?.text || '', tags: [],
    isUnreplied: unanswered, isUrgent: false, pendingSince: unanswered ? latestIn?.timestamp : undefined,
    hasNewMessage: newIncoming ? unanswered : previous?.hasNewMessage,
    unreadMessageIds,
    threadWho: { name, sub: 'Messenger · Page đã kết nối' }, messages,
    profile: { name, avatar, avatarUrl, messengerId: thread.psid, identityStatus: thread.customer?.status || 'pending',
      since: `Nhận tin từ ${time(thread.createdAt)}`, tags: [], channel: 'Messenger',
      orderCount: 'Chưa có dữ liệu', shippingArea: 'Chưa có dữ liệu', timeline: messages.slice(-3).reverse().map((m) => ({
        id: m.id, text: `${m.sender === 'in' ? 'Khách nhắn' : 'Shop trả lời'}: ${m.text.slice(0, 160)}${m.text.length > 160 ? '…' : ''}`, time: m.time,
      })) },
  };
  if (sameQuestion && previous) {
    base.analysis = previous.analysis;
    base.threadWho.badgeTag = previous.threadWho.badgeTag;
    base.profile.tags = previous.profile.tags;
    base.tags = previous.tags.filter((t) => unanswered || t.kind !== 'priority');
    base.isUrgent = unanswered && Boolean(previous.isUrgent);
    base.aiStatus = unanswered ? previous.aiStatus : 'ready';
    base.aiSuggestion = unanswered ? previous.aiSuggestion : undefined;
    base.aiError = unanswered ? previous.aiError : undefined;
  } else if (previous?.aiStatus && [...previous.messages].reverse().find((m) => m.sender === 'in')?.id === latestIn?.id && unanswered) {
    base.aiStatus = previous.aiStatus;
    base.aiError = previous.aiError;
  }
  const saved = base.memory?.find((m) => m.messageId === latestIn?.id);
  if (saved && !sameQuestion) {
    const restored = applyConversationAnalysis({ ...base, isUnreplied: true }, saved.messageId, saved);
    return unanswered ? restored : { ...restored, isUnreplied: false, isUrgent: false, aiSuggestion: undefined,
      tags: restored.tags.filter((t) => t.kind !== 'priority') };
  }
  return base;
}
