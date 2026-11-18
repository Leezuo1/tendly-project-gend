import type { EmailTrigger, Faq, Product, ProductSource, Shop } from './admin';
import type { CareSourceContext } from './customerCare';

/** Dữ liệu đã lưu ở FAQ & sản phẩm, không bao gồm hồ sơ hoặc lịch sử khách hàng. */
export interface AiKnowledge {
  shop: Pick<Shop, 'name' | 'email' | 'phone'>;
  productSource: Pick<ProductSource, 'name' | 'connected' | 'lastSyncedAt'>;
  products: Omit<Product, 'emoji'>[];
  faqs: Faq[];
  emailTriggers: EmailTrigger[];
}

export interface AiChatReply {
  sourceContext?: CareSourceContext;
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
  canAutoReply?: boolean;
  communicationStyle?: string;
  /** id nhãn ngữ cảnh AI chọn từ bộ nhãn của shop (tối đa 3). */
  labels?: string[];
  /** Loại của từng ảnh khách gửi (model điền, theo thứ tự ảnh). */
  imageKinds?: ImageKind[];
  /** Do mã tính, không lấy từ model: tin gửi khách là mẫu cố định vì ảnh cần nhân viên (handoff) hoặc không liên quan (decline). */
  imageOutcome?: 'handoff' | 'decline';
  /** Mã sản phẩm model chọn để gửi ảnh (chỉ dùng nội bộ trong generateCareReply, không lưu). */
  photoProductIds?: string[];
  /** Do mã tính, không lấy từ model: ảnh sản phẩm (tối đa 3) tự gửi/gợi ý kèm câu trả lời. */
  photoImageIds?: string[];
}

export const IMAGE_KINDS = ['product', 'defect', 'receipt', 'other_support', 'unrelated'] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

/** Ngữ cảnh đang có trong phiên hiện tại; không lưu thêm lịch sử vào database. */
export interface AiSessionMessage {
  role: 'user' | 'model';
  text: string;
}
