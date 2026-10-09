import type { MessengerMessage } from './messenger';

export interface MessengerThread {
  id: string;
  psid: string;
  pageId: string;
  createdAt: number;
  lastInAt: number | null;
  lastOutAt: number | null;
  messages: MessengerMessage[];
  hasOlder: boolean;
}
export interface MessengerInboxSnapshot {
  conversations: MessengerThread[];
  hasMore: boolean;
}
