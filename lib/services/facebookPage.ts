/**
 * Đăng bài lên Fanpage qua Graph API (cần quyền pages_manage_posts):
 * không ảnh → POST /{page-id}/feed · có ảnh → POST /{page-id}/photos (ảnh + caption thành một bài trên tường).
 */
import type { PostImageMime } from '@/lib/types/posts';

const GRAPH_API_VERSION = 'v26.0';

export class FacebookNotConfigured extends Error {}
export class FacebookPublishFailed extends Error {}

export function facebookPublishConfigured(): boolean {
  return Boolean(process.env.PAGE_ACCESS_TOKEN?.trim() && /^\d{1,64}$/.test(process.env.PAGE_ID?.trim() ?? ''));
}

export async function publishToFacebookPage(
  message: string, image?: { data: Uint8Array; mime: PostImageMime },
): Promise<{ id: string; url: string }> {
  const token = process.env.PAGE_ACCESS_TOKEN?.trim();
  const pageId = process.env.PAGE_ID?.trim() ?? '';
  if (!token || !/^\d{1,64}$/.test(pageId)) {
    throw new FacebookNotConfigured('Chưa cấu hình PAGE_ID và PAGE_ACCESS_TOKEN để đăng lên Fanpage.');
  }

  // Token đi trong body (không đặt trên URL) để không lọt vào log truy cập.
  let body: URLSearchParams | FormData;
  if (image) {
    body = new FormData();
    body.set('message', message);
    body.set('access_token', token);
    body.set('source', new Blob([new Uint8Array(image.data)], { type: image.mime }), `tendly.${image.mime.split('/')[1]}`);
  } else {
    body = new URLSearchParams({ message, access_token: token });
  }

  let res: Response;
  try {
    res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/${image ? 'photos' : 'feed'}`, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(image ? 45_000 : 20_000),
    });
  } catch {
    throw new FacebookPublishFailed('Không kết nối được Facebook. Vui lòng thử lại.');
  }

  // /photos trả { id: <ảnh>, post_id: <bài trên tường> }; /feed chỉ trả { id: <bài> }.
  const data = await res.json().catch(() => ({})) as { id?: unknown; post_id?: unknown; error?: { message?: unknown } };
  const postId = typeof data.post_id === 'string' ? data.post_id : data.id;
  if (!res.ok || typeof postId !== 'string') {
    const reason = typeof data.error?.message === 'string' ? `: ${data.error.message.slice(0, 200)}` : '';
    throw new FacebookPublishFailed(`Facebook từ chối đăng bài${reason}`);
  }
  return { id: postId, url: `https://www.facebook.com/${postId}` };
}
