import type { FacebookFeedPost } from '@/lib/types/facebookFeed';
import { normalize } from '@/lib/utils/format';

export function filterFacebookPosts(posts: FacebookFeedPost[], filters: {
  query: string;
  period: string;
  start: string;
  end: string;
  sort: string;
}, now = Date.now()) {
  const day = 86_400_000;
  // Use Vietnam calendar days regardless of the browser's timezone.
  const today = new Date(now + 7 * 3_600_000).toISOString().slice(0, 10);
  const midnight = Date.parse(`${today}T00:00:00+07:00`);
  let start = -Infinity;
  let end = Infinity;
  if (filters.period === 'today' || filters.period === 'week') {
    start = midnight - (filters.period === 'week' ? 6 * day : 0);
    end = midnight + day;
  } else if (filters.period === 'custom') {
    if (filters.start) start = Date.parse(`${filters.start}T00:00:00+07:00`);
    if (filters.end) end = Date.parse(`${filters.end}T00:00:00+07:00`) + day;
  }
  const query = normalize(filters.query);
  const engagement = (post: FacebookFeedPost) => (post.reactions ?? 0) + (post.comments ?? 0) + (post.shares ?? 0);
  return posts.filter((post) => post.createdAt >= start && post.createdAt < end &&
    (!query || normalize(post.message).includes(query))).sort((a, b) => {
    if (filters.sort === 'comments') return (b.comments ?? 0) - (a.comments ?? 0) || b.createdAt - a.createdAt;
    if (filters.sort === 'engagement') return engagement(b) - engagement(a) || b.createdAt - a.createdAt;
    return b.createdAt - a.createdAt;
  });
}
