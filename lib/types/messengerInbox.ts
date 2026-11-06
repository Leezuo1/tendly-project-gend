import type { MessengerMessage } from './messenger';
import type { ConversationMemoryEntry } from './conversationMemory';
import type { CareSourceContext } from './customerCare';

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
  sourceContext?: CareSourceContext;
  autoReply?: boolean;
  aiUpdatedAt?: number;
  waitingConfirmation?: boolean;
  viewStartAt?: number;
  personalitySummary?: string;
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
  aiEnabled?: boolean;
  conversations: MessengerThread[];
  hasMore: boolean;
}
