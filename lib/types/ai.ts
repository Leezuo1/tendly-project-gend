import type { EmailTrigger, Faq, Product, ProductSource, Shop } from './admin';

/** Dữ liệu đã lưu ở Cấu hình AI, không bao gồm hồ sơ hoặc lịch sử khách hàng. */
export interface AiKnowledge {
  shop: Pick<Shop, 'name' | 'email' | 'phone'>;
  productSource: Pick<ProductSource, 'name' | 'connected' | 'lastSyncedAt'>;
  products: Omit<Product, 'emoji'>[];
  faqs: Faq[];
  emailTriggers: EmailTrigger[];
}

export interface AiChatReply {
  reply: string;
  model: string;
  sourceSummary: string;
  analysis: AiMessageAnalysis;
}

export type CustomerSentiment = 'positive' | 'neutral' | 'negative';
export type CustomerEmotion = 'happy' | 'neutral' | 'worried' | 'disappointed' | 'angry';
export type ReplyPriority = 'high' | 'normal' | 'low';

export interface AiMessageAnalysis {
  sentiment: CustomerSentiment;
  emotion: CustomerEmotion;
  priority: ReplyPriority;
  priorityScore: number;
  reason: string;
  needsHuman: boolean;
}

/** Ngữ cảnh đang có trong phiên hiện tại; không lưu thêm lịch sử vào database. */
export interface AiSessionMessage {
  role: 'user' | 'model';
  text: string;
}
