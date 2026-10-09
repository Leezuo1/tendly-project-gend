import type { AiChatReply } from './ai';
export interface ConversationMemoryEntry extends AiChatReply {
  messageId: string;
  timestamp: number;
  analyzedAt: number;
  messageText: string;
}
