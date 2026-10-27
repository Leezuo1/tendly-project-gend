/**
 * Nguồn bình luận (adapter) của Livestream. Lõi (engine.ts) chỉ làm việc với IncomingComment,
 * nên thêm TikTok/Shopee Live sau này chỉ cần viết thêm một nguồn mới.
 */
import { graphRead } from '@/lib/services/facebookComments';
import type { LivePlatform, LiveSourceKind, LiveSourceOption } from '@/lib/types/live';

export interface IncomingComment {
  commentId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: number;
}

export interface SourceSession {
  id: string;
  platform: LivePlatform;
  sourceKind: LiveSourceKind | null;
  sourceId: string | null;
}

/** Nền tảng sẽ hỗ trợ — hiển thị "sắp ra mắt" khi pitch đa nền tảng. */
export const UPCOMING_PLATFORMS = ['tiktok', 'shopee'] as const;

// ---------------------------------------------------------------- facebook

const graphTime = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? Date.parse(v) : null);

/** 100 bình luận mới nhất của video Live / bài đăng; lõi bỏ qua bình luận đã lưu. */
async function facebookComments(session: SourceSession, signal?: AbortSignal): Promise<IncomingComment[]> {
  if (!session.sourceId) return [];
  const params: Record<string, string> = { filter: 'stream', order: 'reverse_chronological', limit: '100' };
  if (session.sourceKind === 'live_video') params.live_filter = 'no_filter';
  const data = await graphRead(`${session.sourceId}/comments`, 'id,message,created_time,from{id,name}', signal, params);
  const rows = Array.isArray(data.data) ? data.data as Record<string, unknown>[] : [];
  return rows.flatMap((row) => {
    const from = (row.from ?? {}) as Record<string, unknown>;
    const createdAt = graphTime(row.created_time);
    if (typeof row.id !== 'string' || !/^[\d_]{1,130}$/.test(row.id) || typeof row.message !== 'string' || !createdAt) return [];
    return [{
      commentId: row.id,
      // Meta có thể ẩn người bình luận; khi đó mỗi bình luận coi như một khách riêng
      authorId: typeof from.id === 'string' && /^\d{1,64}$/.test(from.id) ? from.id : `c:${row.id}`,
      authorName: typeof from.name === 'string' ? from.name.slice(0, 200) : '',
      text: row.message.slice(0, 2000),
      createdAt,
    }];
  });
}

/** Video Live và bài đăng gần đây của Fanpage để chọn làm nguồn bình luận. */
export async function listFacebookSources(pageId: string, signal?: AbortSignal): Promise<LiveSourceOption[]> {
  const [lives, posts] = await Promise.all([
    graphRead(`${pageId}/live_videos`, 'id,title,status,creation_time', signal, { limit: '10' }).catch(() => ({ data: [] })),
    graphRead(`${pageId}/published_posts`, 'id,message,created_time', signal, { limit: '10' }),
  ]);
  const list = (v: unknown) => (Array.isArray(v) ? v as Record<string, unknown>[] : []);
  return [
    ...list(lives.data).filter((r) => typeof r.id === 'string').map((r) => ({
      id: r.id as string, kind: 'live_video' as const, title: typeof r.title === 'string' && r.title ? r.title : 'Video Live',
      status: typeof r.status === 'string' ? r.status : null, createdAt: graphTime(r.creation_time),
    })),
    ...list(posts.data).filter((r) => typeof r.id === 'string').map((r) => ({
      id: r.id as string, kind: 'post' as const,
      title: typeof r.message === 'string' && r.message.trim() ? r.message.trim().slice(0, 80) : 'Bài đăng không có chữ',
      status: null, createdAt: graphTime(r.created_time),
    })),
  ];
}

/**
 * Video đang LIVE của Trang, bắt đầu sau lúc tạo phiên (cho lệch 10 phút) — để phiên tạo trước tự gắn vào stream
 * ngay khi người bán bật live trên Facebook. Không có thì trả null.
 */
export async function findLiveVideo(pageId: string, since: number, signal?: AbortSignal): Promise<{ id: string; postId: string | null } | null> {
  const data = await graphRead(`${pageId}/live_videos`, 'id,status,creation_time,video{id}', signal,
    { broadcast_status: '["LIVE"]', limit: '5' });
  const rows = Array.isArray(data.data) ? data.data as Record<string, unknown>[] : [];
  const live = rows
    .filter((r) => typeof r.id === 'string' && /^\d{1,64}$/.test(r.id) && r.status === 'LIVE'
      && (graphTime(r.creation_time) ?? 0) >= since - 10 * 60_000)
    .sort((a, b) => (graphTime(b.creation_time) ?? 0) - (graphTime(a.creation_time) ?? 0))[0];
  if (!live) return null;
  const videoId = (live.video as Record<string, unknown> | undefined)?.id;
  return { id: live.id as string, postId: typeof videoId === 'string' && /^\d{1,64}$/.test(videoId) ? `${pageId}_${videoId}` : null };
}

/** ID bài đăng (pageId_xxx) của nguồn — luồng bình luận Fanpage dùng để bỏ qua bình luận của phiên live. */
export async function facebookSourcePostId(pageId: string, kind: LiveSourceKind, sourceId: string): Promise<string | null> {
  if (kind === 'post') return sourceId;
  const live = await graphRead(sourceId, 'video{id}');
  const videoId = (live.video as Record<string, unknown> | undefined)?.id;
  return typeof videoId === 'string' && /^\d{1,64}$/.test(videoId) ? `${pageId}_${videoId}` : null;
}

export async function listNewComments(session: SourceSession, signal?: AbortSignal): Promise<IncomingComment[]> {
  return facebookComments(session, signal);
}
