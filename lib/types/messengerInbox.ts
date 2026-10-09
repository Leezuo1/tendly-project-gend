import type { MessengerMessage } from './messenger';
import type { ConversationMemoryEntry } from './conversationMemory';

export interface MessengerCustomerProfile {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  status: 'pending' | 'ready' | 'unavailable';
  refreshedAt: number | null;
  retryAfter: number | null;
}

export interface MessengerThread {
  memory?: ConversationMemoryEntry[];
  id: string;
  psid: string;
  pageId: string;
  createdAt: number;
  lastInAt: number | null;
  lastOutAt: number | null;
  messages: MessengerMessage[];
  hasOlder: boolean;
  customer?: MessengerCustomerProfile;
}
export interface MessengerInboxSnapshot {
  conversations: MessengerThread[];
  hasMore: boolean;
}
