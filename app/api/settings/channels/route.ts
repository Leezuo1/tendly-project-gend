import { inboxAccessError } from '@/lib/services/inboxAccess';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const denied = inboxAccessError(request);
  if (denied) return denied;
  const pageId = process.env.PAGE_ID?.trim();
  const token = process.env.PAGE_ACCESS_TOKEN?.trim();
  const version = process.env.META_GRAPH_VERSION?.trim();
  let pageName = '';
  let pageAvatarUrl = '';
  let pageAccessible = false;
  const configured = Boolean(pageId && /^\d{1,64}$/.test(pageId) && token && version && /^v\d+\.\d+$/.test(version));
  if (configured) {
    try {
      const response = await fetch(`https://graph.facebook.com/${version}/${pageId}?fields=id,name,picture.type(large)`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(5000),
      });
      const data = await response.json();
      pageAccessible = response.ok && data.id === pageId;
      if (pageAccessible && typeof data.name === 'string') pageName = data.name.trim();
      const picture = data.picture?.data;
      if (pageAccessible && picture?.is_silhouette !== true && typeof picture?.url === 'string') {
        try {
          const url = new URL(picture.url);
          if (url.protocol === 'https:' && !url.username && !url.password && !url.searchParams.has('access_token')
            && !url.searchParams.has('token') && !url.href.includes(token!)) pageAvatarUrl = url.href;
        } catch { /* Keep avatar empty when Meta has no usable picture. */ }
      }
    } catch { /* Return safe status, never expose Meta token or raw errors. */ }
  }
  return Response.json({ configured, pageAccessible, pageName, pageAvatarUrl, databaseConfigured: Boolean(process.env.DATABASE_URL) },
    { headers: { 'Cache-Control': 'no-store' } });
}
