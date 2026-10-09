// ============================================================
// DOMAIN TYPES — Hộp thoại (Inbox & Omni-channel Chat)
// ============================================================

import type { AiMessageAnalysis } from './ai';
import type { MessengerAttachment } from './messenger';

export type InboxFilter = 'all' | 'urgent' | 'unreplied';

export type Channel = 'facebook' | 'zalo';

export type TagType = 'high' | 'vip' | 'risk' | 'loop' | 'positive' | 'neutral';

export interface ConversationTag {
  label: string;
  type: TagType;
  source?: 'ai';
  kind?: 'emotion' | 'priority';
}

export interface ChatMessage {
  id: string;
  sender: 'in' | 'out';
  text: string;
  time: string;
  isAiReply?: boolean;
  aiSource?: string;
  isDivider?: boolean;
  timestamp?: number;
  attachments?: MessengerAttachment[];
}

export interface AISuggestion {
  label: string;
  source: string;
  text: string;
}

export interface TimelineEvent {
  id: string;
  text: string;
  time: string;
}

export interface CustomerProfile {
  avatar: string;
  name: string;
  since: string;
  tags: ConversationTag[];
  channel: string;
  orderCount: string;
  shippingArea: string;
  totalSpent?: string;
  timeline: TimelineEvent[];
}

export interface Conversation {
  messenger?: { pageId: string; psid: string; hasOlder: boolean };
  id: string;
  name: string;
  avatar: string;
  channel: Channel;
  time: string;
  preview: string;
  tags: ConversationTag[];
  isUrgent?: boolean;
  isUnreplied?: boolean;
  threadWho: {
    name: string;
    sub: string;
    badgeTag?: ConversationTag;
  };
  messages: ChatMessage[];
  aiSuggestion?: AISuggestion;
  analysis?: AiMessageAnalysis & { messageId: string };
  aiStatus?: 'analyzing' | 'ready' | 'error';
  aiError?: string;
  pendingSince?: number;
  profile: CustomerProfile;
}
