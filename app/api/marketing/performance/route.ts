import { facebookPublishConfigured, fetchPostEngagement } from '@/lib/services/facebookPage';
import { marketingErrorResponse, marketingPageId } from '@/lib/services/marketingApi';
import { readRemarketingSends } from '@/lib/services/marketingInsights';
import { requireDashboardKey } from '@/lib/services/postsApi';
import { listPosts } from '@/lib/services/postsPostgres';
import type { MarketingPerformance } from '@/lib/types/marketing';

export const runtime = 'nodejs';
export const maxDuration = 30;

const STATS_LIMIT = 25;

/** Số liệu thật: tương tác của bài đã đăng Fanpage + tỉ lệ khách nhắn lại sau tin remarketing. */
export async function GET(request: Request) {
  const denied = requireDashboardKey(request);
  if (denied) return denied;
  try {
    const pageId = marketingPageId();
    const [posts, sends] = await Promise.all([listPosts(), readRemarketingSends(pageId)]);
    const onPage = posts.filter((p) => p.status === 'published' && p.externalId).slice(0, STATS_LIMIT);

    let insightsError: string | null = null;
    let stats = new Map<string, { reactions: number; comments: number; shares: number }>();
    if (onPage.length && facebookPublishConfigured()) {
      const result = await fetchPostEngagement(onPage.map((p) => p.externalId as string));
      stats = result.stats;
      if (result.missingPermission) {
        insightsError = `PAGE_ACCESS_TOKEN thiếu quyền ${result.missingPermission} nên chưa đọc được lượt cảm xúc/bình luận. Tạo lại token có thêm quyền này rồi cập nhật trên Vercel.`;
      } else if (result.failed) {
        insightsError = `Facebook chưa trả số liệu cho ${result.failed} bài (có thể bài đã bị xoá trên Fanpage).`;
      }
    } else if (onPage.length) {
      insightsError = 'Chưa cấu hình PAGE_ACCESS_TOKEN nên chưa đọc được tương tác trên Fanpage.';
    }

    const body: MarketingPerformance = {
      posts: {
        published: posts.filter((p) => p.status === 'published' && p.channel === 'facebook').length,
        drafts: posts.filter((p) => p.status === 'draft').length,
        insightsError,
        items: onPage.map((p) => {
          const s = stats.get(p.externalId as string);
          return {
            id: p.id, title: p.title, content: p.content.slice(0, 300), publishedAt: p.publishedAt ?? p.updatedAt,
            url: p.externalUrl, hasImage: Boolean(p.image),
            reactions: s?.reactions ?? null, comments: s?.comments ?? null, shares: s?.shares ?? null,
          };
        }),
      },
      remarketing: { sent: sends.length, replied: sends.filter((s) => s.repliedAt !== null).length, items: sends.slice(0, 50) },
    };
    return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return marketingErrorResponse(error);
  }
}
