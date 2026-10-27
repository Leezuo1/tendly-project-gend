/**
 * Nguồn bình luận (adapter) của Livestream. Lõi (engine.ts) chỉ làm việc với IncomingComment,
 * nên thêm TikTok/Shopee Live sau này chỉ cần viết thêm một nguồn mới.
 */
import { graphRead } from '@/lib/services/facebookComments';
import type { LivePlatform, LiveSourceKind, LiveSourceOption } from '@/lib/types/live';
import type { LiveProduct } from '@/lib/services/live/classify';

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
  startedAt: number;
  products: LiveProduct[];
}

/** Nền tảng sẽ hỗ trợ — hiển thị "sắp ra mắt" khi pitch đa nền tảng. */
export const UPCOMING_PLATFORMS = ['tiktok', 'shopee'] as const;

// ---------------------------------------------------------------- demo

const DEMO_NAMES = [
  'Ngọc Anh', 'Thu Hà', 'Minh Thư', 'Lan Phương', 'Bảo Ngân', 'Khánh Linh', 'Hoài An', 'Thảo Vy', 'Gia Hân', 'Mỹ Duyên',
  'Quỳnh Như', 'Phương Uyên', 'Hải Yến', 'Diệu Linh', 'Tú Anh', 'Kim Chi', 'Thanh Trúc', 'Ánh Dương', 'Hồng Nhung', 'Bích Ngọc',
  'Yến Nhi', 'Cẩm Tú',
];

const pick = (list: string[], i: number, fallback = '') => list.length ? list[i % list.length] : fallback;

/**
 * Kịch bản phiên live demo (~3 phút): hỏi giá trùng lặp, chốt đơn, khách chốt 2 lần, mẫu chốt quá tồn kho,
 * phàn nàn, đổi trả, tư vấn size, spam. Dùng SKU/màu/size thật trong danh mục của phiên.
 */
export function demoScript(products: LiveProduct[]): { at: number; author: number; text: string }[] {
  const inStock = products.filter((p) => p.qty > 0);
  const a = inStock[0] ?? products[0];
  if (!a) return [];
  // B = mẫu ít hàng nhất để thấy cảnh báo "sắp hết" / "hết hàng"
  const b = [...inStock].filter((p) => p.sku !== a.sku).sort((x, y) => x.qty - y.qty)[0] ?? a;
  const c = inStock.find((p) => p.sku !== a.sku && p.sku !== b.sku) ?? a;
  const col = (p: LiveProduct, i: number) => pick(p.colors, i);
  const sz = (p: LiveProduct, i: number) => pick(p.sizes, i, 'M');
  const bOrders = Math.min(Math.max(b.qty + 2, 3), 7);

  const lines: [number, number, string][] = [
    [0, 0, 'Chào shop 👋'], [3, 1, 'giá bn shop'], [5, 2, 'xin giá'], [6, 3, 'ib giá'], [8, 4, 'giá sao ạ'],
    [10, 5, '1'], [12, 6, `chốt ${sz(a, 1)} ${col(a, 0)}`], [14, 7, 'đẹp quá 😍😍'], [16, 8, `${sz(a, 2)} ${col(a, 1)}`],
    [18, 9, '45kg mặc size gì vậy shop'], [20, 10, 'còn size L không'], [22, 11, 'x2 ' + col(a, 0)],
    [24, 12, `cho xem mẫu ${b.sku}`], [26, 13, `lên mẫu ${b.sku} đi shop`], [27, 14, 'giá bn'], [29, 15, `xem ${b.sku} với`],
    [31, 16, 'ship hn bao lâu shop'], [33, 1, `chốt ${sz(a, 0)} ${col(a, 1)}`], [35, 17, 'có COD không'],
    [37, 18, `ib giá ${b.sku}`], [39, 19, `còn ${b.sku} không shop`], [41, 20, 'cao 1m6 nặng 52kg lấy size nào'],
    [44, 21, 'chất vải có nóng không shop'], [47, 6, `lấy thêm 1 cái ${col(a, 2) || col(a, 0)} size ${sz(a, 3) || sz(a, 1)}`],
    [50, 2, '@Lan vào xem nè'], [53, 3, `ib giá ${c.sku}`], [56, 4, `cho xem ${c.sku}`],
    [60, 0, 'đơn hôm trước giao chậm quá, hàng bị lỗi đường may'], [63, 7, 'đổi size được không shop'],
    [66, 9, 'giặt máy được không'], [70, 11, 'xin giá'], [72, 12, 'giá bn ạ'],
  ];
  // Từ giây 80 shop chuyển sang mẫu B → nhiều người chốt B vượt tồn kho
  for (let i = 0; i < bOrders; i++) lines.push([80 + i * 4, (13 + i) % DEMO_NAMES.length, `chốt ${b.sku} ${sz(b, i)} ${col(b, i)}`.trim()]);
  lines.push(
    [112, 5, `giá ${b.sku} bn`], [115, 8, `còn ${b.sku} size ${sz(b, 1)} không`], [118, 14, '😍😍😍'],
    [122, 16, `chốt ${c.sku} ${sz(c, 1)}`], [126, 18, `lấy ${c.sku} ${col(c, 0)} ${sz(c, 0)}`], [130, 20, 'ship sài gòn mấy ngày'],
    [134, 1, 'shop ơi mẫu này có size XXL không'], [138, 10, `cho xem lại ${a.sku}`], [142, 19, `xem ${c.sku}`],
    [146, 21, 'hàng đẹp lắm shop ơi'], [150, 2, 'giá bn'], [155, 15, `chốt ${a.sku} ${sz(a, 1)} ${col(a, 0)}`],
    [160, 17, 'cho mình hỏi có freeship không'], [165, 3, 'xin giá'], [170, 12, 'đổi màu được không ạ'],
  );
  return lines.sort((x, y) => x[0] - y[0]).map(([at, author, text]) => ({ at, author, text }));
}

/** Mẫu shop nên lên sóng lúc bắt đầu demo (để "1", "chốt M trắng" có mẫu để gán). */
export function demoFirstSku(products: LiveProduct[]): string | null {
  return (products.find((p) => p.qty > 0) ?? products[0])?.sku ?? null;
}

function demoComments(session: SourceSession, now: number): IncomingComment[] {
  const elapsed = (now - session.startedAt) / 1000;
  return demoScript(session.products)
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => line.at <= elapsed)
    .map(({ line, i }) => ({
      commentId: `demo-${i}`, authorId: `demo-u${line.author}`, authorName: DEMO_NAMES[line.author % DEMO_NAMES.length],
      text: line.text, createdAt: session.startedAt + line.at * 1000,
    }));
}

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

/** ID bài đăng (pageId_xxx) của nguồn — luồng bình luận Fanpage dùng để bỏ qua bình luận của phiên live. */
export async function facebookSourcePostId(pageId: string, kind: LiveSourceKind, sourceId: string): Promise<string | null> {
  if (kind === 'post') return sourceId;
  const live = await graphRead(sourceId, 'video{id}');
  const videoId = (live.video as Record<string, unknown> | undefined)?.id;
  return typeof videoId === 'string' && /^\d{1,64}$/.test(videoId) ? `${pageId}_${videoId}` : null;
}

export async function listNewComments(session: SourceSession, now: number, signal?: AbortSignal): Promise<IncomingComment[]> {
  if (session.platform === 'demo') return demoComments(session, now);
  return facebookComments(session, signal);
}
