// ============================================================
// DOMAIN TYPES — Livestream ("Live Cockpit")
// Đây cũng là hợp đồng API cho dashboard: xem docs/livestream-api.md
// ============================================================

/** Nguồn bình luận. Lõi không phụ thuộc nền tảng; TikTok/Shopee sẽ là adapter mới. */
export type LivePlatform = 'facebook';
export type LiveSourceKind = 'live_video' | 'post';

export type LiveIntent =
  | 'order' | 'price' | 'size_advice' | 'stock' | 'view' | 'shipping'
  | 'return' | 'complaint' | 'question' | 'other';

export type LiveReplyStatus = 'none' | 'review' | 'sending' | 'sent' | 'unknown' | 'failed' | 'not_allowed';
export type LiveGroupStatus = 'review' | 'sending' | 'partial' | 'sent';
export type LiveOrderStatus = 'draft' | 'awaiting_info' | 'confirmed' | 'cancelled';

export interface LiveSession {
  id: string;
  platform: LivePlatform;
  sourceKind: LiveSourceKind | null;
  sourceId: string | null;
  title: string;
  status: 'live' | 'ended';
  onAirSku: string | null;
  startedAt: number;
  endedAt: number | null;
  /** Số lần gọi AI trong phiên — để thấy chi phí thấp vì phần lớn xử lý bằng luật. */
  aiCalls: number;
  /** Lúc stream thật sự bắt đầu; null khi phiên đã tạo nhưng người bán chưa bật live. */
  liveAt: number | null;
  /**
   * true = đang chờ người bán bật live. Tendly tự nhận video Live của Trang (dò ~10 giây/lần).
   */
  waiting: boolean;
}

export interface LiveComment {
  commentId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: number;
  intent: LiveIntent;
  sku: string | null;
  color: string | null;
  size: string | null;
  qty: number | null;
  groupKey: string | null;
  replyStatus: LiveReplyStatus;
}

/** Bình luận cùng ý định + cùng sản phẩm gom thành 1 nhóm, shop duyệt 1 câu trả lời cho cả nhóm. */
export interface LiveGroup {
  key: string;
  intent: LiveIntent;
  sku: string | null;
  productName: string | null;
  count: number;
  /** Số bình luận đang chờ duyệt gửi. */
  pending: number;
  sent: number;
  notAllowed: number;
  status: LiveGroupStatus;
  /** Câu trả lời mẫu; có thể chứa {ten_khach} {san_pham} {mau} {size} {so_luong} {gia} {con_lai}. */
  replyText: string;
  replySource: 'template' | 'ai' | 'ai_pending' | 'shop';
  /** Cần shop tự xử lý (khiếu nại, đổi trả, chưa xác định sản phẩm...). */
  needsHuman: boolean;
  revision: number;
  samples: string[];
  lastAt: number;
}

export interface LiveOrderItem {
  sku: string;
  name: string;
  color: string | null;
  size: string | null;
  qty: number;
  price: number;
  /** false = hết hàng lúc khách chốt, không giữ hàng cho món này. */
  stockOk: boolean;
}

export interface LiveOrder {
  id: string;
  customerId: string;
  customerName: string;
  items: LiveOrderItem[];
  total: number;
  status: LiveOrderStatus;
  commentCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface LiveQueueItem {
  sku: string;
  name: string;
  /** Số khách khác nhau hỏi/đòi xem/chốt mẫu này trong 10 phút gần nhất. */
  requests: number;
  viewRequests: number;
  orderRequests: number;
  remaining: number;
  recommendation: string;
}

export interface LiveStockItem {
  sku: string;
  name: string;
  stock: number;
  held: number;
  remaining: number;
  level: 'ok' | 'low' | 'out';
}

export interface LiveStats {
  comments: number;
  customers: number;
  orders: number;
  /** Doanh thu dự kiến: các món còn hàng trong đơn chưa huỷ. */
  revenue: number;
  questions: number;
  pendingReplies: number;
  sentReplies: number;
  aiCalls: number;
  /** Thời gian trung bình từ lúc khách bình luận đến lúc nhắn riêng thành công (giây). */
  avgResponseSec: number | null;
}

export interface LiveProductCount {
  sku: string;
  name: string;
  count: number;
}

export interface LiveAdvice {
  sku: string;
  name: string;
  action: 'restock' | 'keep' | 'reduce';
  reason: string;
}

export interface LiveSummary {
  totalComments: number;
  customers: number;
  orders: number;
  revenue: number;
  /** Tỉ lệ khách bình luận có chốt đơn (%). */
  conversionRate: number;
  topAsked: LiveProductCount[];
  /** count = số lượng sản phẩm được chốt. */
  topOrdered: LiveProductCount[];
  /** Hỏi nhiều nhưng không ai chốt — nên xem lại giá/mẫu. */
  askedNotOrdered: LiveProductCount[];
  /** Số bình luận theo từng phút (mốc đầu phút, ms). */
  timeline: { at: number; comments: number }[];
  peakAt: number | null;
  advice: LiveAdvice[];
  adviceSource: 'ai' | 'rule';
  highlights: string;
}

export interface LiveSnapshot {
  now: number;
  session: LiveSession;
  stats: LiveStats;
  onAir: { sku: string; name: string; price: number; remaining: number } | null;
  /** Hàng chờ "Lên sóng tiếp theo". */
  queue: LiveQueueItem[];
  stock: LiveStockItem[];
  groups: LiveGroup[];
  orders: LiveOrder[];
  /** 50 bình luận mới nhất. */
  recent: LiveComment[];
  /** Có khi phiên đã kết thúc. */
  summary: LiveSummary | null;
  /** Sản phẩm của phiên (để chọn mẫu đang lên sóng). */
  products: { sku: string; name: string; price: number; stock: number }[];
}

export interface LiveSessionListItem {
  id: string;
  title: string;
  platform: LivePlatform;
  status: 'live' | 'ended';
  startedAt: number;
  endedAt: number | null;
  comments: number;
  orders: number;
  revenue: number;
}

export interface LiveInsights {
  sessions: LiveSessionListItem[];
  monthly: {
    /** YYYY-MM theo giờ Việt Nam */
    month: string;
    sessions: number;
    comments: number;
    orders: number;
    revenue: number;
    topProducts: LiveProductCount[];
  }[];
}

export interface LiveSourceOption {
  id: string;
  kind: LiveSourceKind;
  title: string;
  status: string | null;
  createdAt: number | null;
}

export interface LiveSendResult {
  sent: number;
  failed: number;
  notAllowed: number;
  unknown: number;
  /** Còn bao nhiêu bình luận chờ gửi — gọi approve lần nữa để gửi tiếp. */
  remaining: number;
}
