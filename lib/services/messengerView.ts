import type { Conversation, ChatMessage } from '@/lib/types/inbox';
import type { MessengerThread } from '@/lib/types/messengerInbox';
import type { MessengerMessage } from '@/lib/types/messenger';

const time = (timestamp: number) => new Date(timestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
export function messengerChatMessage(m: MessengerMessage): ChatMessage {
  return { id: m.messageId, sender: m.direction, text: m.text || '[Tệp đính kèm]',
    timestamp: m.timestamp, time: time(m.timestamp), attachments: m.attachments };
}

export function mergeMessengerThread(thread: MessengerThread, previous?: Conversation): Conversation {
  // Retain pages of history already loaded and successful sends not echoed yet.
  const byId = new Map((previous?.messages || []).map((m) => [m.id, m]));
  for (const m of thread.messages) byId.set(m.messageId, messengerChatMessage(m));
  const messages = [...byId.values()].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0) || a.id.localeCompare(b.id));
  const latest = messages.at(-1);
  const latestIn = [...messages].reverse().find((m) => m.sender === 'in');
  const latestOut = [...messages].reverse().find((m) => m.sender === 'out');
  const unanswered = latestIn !== undefined && (!latestOut || (latestIn.timestamp || 0) > (latestOut.timestamp || 0));
  const sameQuestion = previous?.analysis?.messageId === latestIn?.id;
  const name = `Khách ${thread.psid.slice(-6)}`;
  const base: Conversation = {
    id: thread.id, messenger: { pageId: thread.pageId, psid: thread.psid,
      hasOlder: previous?.messenger?.hasOlder === false && (previous.messages[0]?.timestamp || 0) < (thread.messages[0]?.timestamp || 0)
        ? false : thread.hasOlder },
    name, avatar: 'FB', channel: 'facebook', time: latest?.time || '', preview: latest?.text || '', tags: [],
    isUnreplied: unanswered, isUrgent: false, pendingSince: unanswered ? latestIn?.timestamp : undefined,
    threadWho: { name, sub: 'Messenger · Page đã kết nối' }, messages,
    profile: { name, avatar: 'FB', since: `Nhận tin từ ${time(thread.createdAt)}`, tags: [], channel: 'Messenger',
      orderCount: 'Chưa có dữ liệu', shippingArea: 'Chưa có dữ liệu', timeline: [] },
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
  return base;
}
