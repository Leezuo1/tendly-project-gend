/** Đăng bài lên Fanpage qua Graph API (POST /{page-id}/feed, cần quyền pages_manage_posts). */

const GRAPH_API_VERSION = 'v26.0';

export class FacebookNotConfigured extends Error {}
export class FacebookPublishFailed extends Error {}

export function facebookPublishConfigured(): boolean {
  return Boolean(process.env.PAGE_ACCESS_TOKEN?.trim() && /^\d{1,64}$/.test(process.env.PAGE_ID ?? ''));
}

export async function publishToFacebookPage(message: string): Promise<{ id: string; url: string }> {
  const token = process.env.PAGE_ACCESS_TOKEN?.trim();
  const pageId = process.env.PAGE_ID ?? '';
  if (!token || !/^\d{1,64}$/.test(pageId)) {
    throw new FacebookNotConfigured('Chưa cấu hình PAGE_ID và PAGE_ACCESS_TOKEN để đăng lên Fanpage.');
  }

  let res: Response;
  try {
    res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/feed`, {
      method: 'POST',
      // Token đi trong body (không đặt trên URL) để không lọt vào log truy cập.
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ message, access_token: token }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new FacebookPublishFailed('Không kết nối được Facebook. Vui lòng thử lại.');
  }

  const data = await res.json().catch(() => ({})) as { id?: unknown; error?: { message?: unknown } };
  if (!res.ok || typeof data.id !== 'string') {
    const reason = typeof data.error?.message === 'string' ? `: ${data.error.message.slice(0, 200)}` : '';
    throw new FacebookPublishFailed(`Facebook từ chối đăng bài${reason}`);
  }
  return { id: data.id, url: `https://www.facebook.com/${data.id}` };
}
