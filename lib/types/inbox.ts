// ============================================================
// DOMAIN TYPES — Hộp thoại (Inbox & Omni-channel Chat)
// ============================================================

import type { AiMessageAnalysis } from './ai';
import type { MessengerAttachment } from './messenger';
import type { ConversationMemoryEntry } from './conversationMemory';
import type { CareSourceContext } from './customerCare';

/** Ảnh trong khay trên ô soạn: ảnh sản phẩm do AI gợi ý hoặc file nhân viên chọn từ máy. */
export type DraftImage = { key: string } & ({ kind: 'product'; imageId: string } | { kind: 'file'; file: File; previewUrl: string });

export interface FailedImage { imageId: string; status: 'failed' | 'unknown' }

export type InboxFilter = 'all' | 'urgent' | 'unreplied';

export type Channel = 'facebook' | 'zalo';

export type TagType = 'high' | 'vip' | 'risk' | 'loop' | 'positive' | 'neutral';

export interface ConversationTag {
  /** id nhãn trong bộ nhãn ngữ cảnh của shop (chỉ nhãn ngữ cảnh). */
  id?: string;
  label: string;
  type: TagType;
  source?: 'ai' | 'rule' | 'staff';
  kind?: 'emotion' | 'priority' | 'context';
}

/** Nhãn nhân viên dán (`added`) và nhãn tự động nhân viên đã gỡ (`hidden`) của một hội thoại, theo id nhãn. */
export interface StaffLabels {
  added: string[];
  hidden: string[];
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
  sourceFingerprint?: string;
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
  avatarUrl?: string;
  messengerId?: string;
  identityStatus?: 'pending' | 'ready' | 'unavailable';
  name: string;
  since: string;
  tags: ConversationTag[];
  channel: string;
  orderCount: string;
  shippingArea: string;
  totalSpent?: string;
  /** Nhu cầu khách hàng (nhân viên ghi hoặc AI tự điền, chỉ khách Messenger). */
  needs?: string;
  needsSource?: '' | 'ai' | 'staff';
  timeline: TimelineEvent[];
}

export interface Conversation {
  sourceContext?: CareSourceContext;
  autoReply?: boolean;
  aiUpdatedAt?: number;
  waitingConfirmation?: boolean;
  memory?: ConversationMemoryEntry[];
  personalitySummary?: string;
  messenger?: { pageId: string; psid: string; hasOlder: boolean; viewStartAt?: number };
  /** Nhãn nhân viên dán/gỡ, lấy từ máy chủ; không trộn vào `tags` (tags được dựng lại sau mỗi lần phân tích). */
  staffLabels?: StaffLabels;
  /** Ảnh sản phẩm gửi lỗi hoặc chưa rõ kết quả trong 24 giờ qua (từ máy chủ); hiện thanh "Ảnh chưa gửi" kèm nút gửi lại. */
  failedImages?: FailedImage[];
  id: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  channel: Channel;
  time: string;
  preview: string;
  tags: ConversationTag[];
  isUrgent?: boolean;
  isUnreplied?: boolean;
  hasNewMessage?: boolean;
  unreadMessageIds?: string[];
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
