// ============================================================
// DOMAIN TYPES — Marketing
// ============================================================

export type MarketingTab = 'queue' | 'segments' | 'performance' | 'composer';

/** Nhóm theo hoạt động nhắn tin (chưa có dữ liệu đơn hàng để tính RFM). */
export type ActivitySegment = 'new' | 'active' | 'quiet' | 'risk';

export interface MarketingCustomer {
  psid: string;
  name: string;
  avatarUrl: string | null;
  segment: ActivitySegment;
  firstContactAt: number;
  lastInAt: number | null;
  lastOutAt: number | null;
  inboundCount: number;
  lastInboundText: string;
  /** Tin cuối là của khách, shop chưa trả lời. */
  waitingReply: boolean;
  /** Còn nhắn được qua Messenger tới thời điểm này (luật 24 giờ); null = hết hạn. */
  canMessageUntil: number | null;
  askedProduct: boolean;
  complained: boolean;
  matchedProducts: string[];
}

export interface RemarketingDraft {
  message: string;
  reason: string;
}

export interface RemarketingSend {
  psid: string;
  name: string;
  text: string;
  sentAt: number;
  repliedAt: number | null;
}

export interface PublishedPostStats {
  id: string;
  title: string;
  content: string;
  publishedAt: number;
  url: string | null;
  hasImage: boolean;
  /** null khi Facebook chưa trả số liệu (lỗi quyền, bài đã xoá...). */
  reactions: number | null;
  comments: number | null;
  shares: number | null;
}

export interface MarketingPerformance {
  posts: { published: number; drafts: number; items: PublishedPostStats[]; insightsError: string | null };
  remarketing: { sent: number; replied: number; items: RemarketingSend[] };
}
