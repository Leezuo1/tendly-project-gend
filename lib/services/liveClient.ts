'use client';

/**
 * Client cho API Livestream — dashboard (trong lúc live và tổng quan) chỉ cần dùng file này và useLiveSession.
 * Mọi request kèm mã quản trị (DASHBOARD_KEY) qua dashboardRequest.
 */
import { currentAiKnowledge } from '@/lib/services/aiChat';
import { dashboardRequest } from '@/lib/services/postsClient';
import type {
  LiveInsights, LiveOrderStatus, LiveSendResult, LiveSession, LiveSessionListItem, LiveSnapshot, LiveSourceKind, LiveSourceOption,
} from '@/lib/types/live';

const json = <T,>(res: Response) => res.json() as Promise<T>;
const post = (url: string, body: unknown = {}) => dashboardRequest(url, { method: 'POST', body: JSON.stringify(body) });
const session = (id: string) => `/api/live/sessions/${encodeURIComponent(id)}`;

export interface StartLiveInput {
  platform: 'demo' | 'facebook';
  sourceKind?: LiveSourceKind;
  sourceId?: string;
  title?: string;
}

export const liveClient = {
  /** Video Live / bài đăng của Fanpage để chọn nguồn, kèm nền tảng sắp hỗ trợ. */
  sources: () => dashboardRequest('/api/live/sources').then(json<{ sources: LiveSourceOption[]; upcoming: string[] }>),
  sessions: () => dashboardRequest('/api/live/sessions').then(json<{ sessions: LiveSessionListItem[] }>).then((r) => r.sessions),
  /** Gửi kèm Cấu hình AI (sản phẩm, giá, tồn kho, FAQ) làm danh mục cố định của phiên. */
  start: (input: StartLiveInput) => post('/api/live/sessions', { ...input, knowledge: currentAiKnowledge() })
    .then(json<{ session: LiveSession }>).then((r) => r.session),
  snapshot: (id: string) => dashboardRequest(session(id)).then(json<LiveSnapshot>),
  /** Kéo bình luận mới rồi trả snapshot — gọi định kỳ khi đang live (useLiveSession lo việc này). */
  sync: (id: string) => post(`${session(id)}/sync`).then(json<LiveSnapshot>),
  setOnAir: (id: string, sku: string | null) => post(`${session(id)}/on-air`, { sku }).then(json<LiveSnapshot>),
  /** Chỉ phiên demo: thêm bình luận gõ tay. */
  addComment: (id: string, authorName: string, text: string) => post(`${session(id)}/comments`, { authorName, text }).then(json<LiveSnapshot>),
  updateOrder: (id: string, orderId: string, status: LiveOrderStatus) =>
    dashboardRequest(`${session(id)}/orders/${encodeURIComponent(orderId)}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      .then(json<LiveSnapshot>),
  end: (id: string) => post(`${session(id)}/end`).then(json<LiveSnapshot>),
  insights: () => dashboardRequest('/api/live/insights').then(json<LiveInsights>),

  /**
   * Duyệt câu trả lời của nhóm và nhắn riêng cho cả nhóm. API gửi tối đa 15 tin/lần nên hàm tự gọi lại
   * tới khi hết (tối đa 20 lượt), trả tổng kết quả.
   */
  async approve(id: string, groupKey: string, text: string, revision: number): Promise<LiveSendResult> {
    const total: LiveSendResult = { sent: 0, failed: 0, notAllowed: 0, unknown: 0, remaining: 0 };
    let rev = revision;
    for (let round = 0; round < 20; round++) {
      const r = await post(`${session(id)}/groups/${encodeURIComponent(groupKey)}/approve`, { text, revision: rev })
        .then(json<LiveSendResult & { revision: number }>);
      total.sent += r.sent; total.failed += r.failed; total.notAllowed += r.notAllowed; total.unknown += r.unknown;
      total.remaining = r.remaining;
      rev = r.revision;
      if (!r.remaining || !(r.sent + r.failed + r.notAllowed + r.unknown)) break;
    }
    return total;
  },
};
