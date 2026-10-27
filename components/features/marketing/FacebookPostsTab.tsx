'use client';

import { useState } from 'react';
import Image from 'next/image';
import { CustomerAvatar } from '@/components/features/inbox/CustomerAvatar';
import { useMarketingData } from '@/lib/hooks/useMarketingData';
import { facebookFeedClient as client } from '@/lib/services/facebookFeedClient';
import type { FacebookFeedPage, FacebookFeedPost, FacebookPostComment, FacebookPostCommentsPage } from '@/lib/types/facebookFeed';
import { formatNumber, initials } from '@/lib/utils/format';
import { filterFacebookPosts } from '@/lib/utils/facebookPosts';
import { MarketingDataNotice } from './MarketingDataNotice';

const dateTime = (timestamp: number) => new Date(timestamp).toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
});
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Không tải được dữ liệu Facebook.';
const count = (value: number | null) => formatNumber(value ?? 0);

const iconPaths = {
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  comment: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3h2a8.5 8.5 0 0 1 8.5 8.5Z',
  share: 'm14 3 7 7-7 7v-4c-5 0-8 2-11 7 0-9 4-13 11-13V3Z',
  text: 'M6 3h9l4 4v14H6V3Zm9 0v5h4M9 12h7M9 16h5',
  external: 'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',
  refresh: 'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  sparkles: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
};
function PostIcon({ name }: { name: keyof typeof iconPaths }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[name]} /></svg>;
}

function CommentThread({ comment, postUrl }: { comment: FacebookPostComment; postUrl: string }) {
  return <li className="fp-comment">
    <CustomerAvatar name={comment.authorName} initials={initials(comment.authorName)} className="fp-avatar" />
    <div className="fp-comment-body">
      <div className="fp-bubble"><b>{comment.authorName}</b><p>{comment.message || '[Ảnh, video hoặc nhãn dán]'}</p></div>
      <div className="fp-comment-meta"><time dateTime={new Date(comment.createdAt).toISOString()}>{dateTime(comment.createdAt)}</time>
        {comment.likes !== null && comment.likes > 0 && <span>{count(comment.likes)} lượt thích</span>}</div>
      {comment.replies.length > 0 && <ul className="fp-replies">{comment.replies.map((reply) => <CommentThread key={reply.id} comment={reply} postUrl={postUrl} />)}</ul>}
      {comment.hasMoreReplies && <a className="fp-more-replies" href={postUrl} target="_blank" rel="noreferrer">Xem thêm phản hồi trên Facebook ↗</a>}
    </div>
  </li>;
}

function FacebookPostCard({ post, onCompose }: { post: FacebookFeedPost; onCompose: (post: FacebookFeedPost) => void }) {
  const [comments, setComments] = useState<FacebookPostCommentsPage>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const title = post.message.trim().split('\n')[0] || 'Bài đăng có ảnh hoặc video';
  const loadComments = async (after?: string) => {
    if (loading) return;
    setLoading(true); setError(undefined);
    try {
      const result = await client.comments(post.id, after);
      setComments((prev) => ({ ...result, comments: after && prev
        ? [...new Map([...prev.comments, ...result.comments].map((c) => [c.id, c])).values()] : result.comments }));
    } catch (e) { setError(errorText(e)); }
    finally { setLoading(false); }
  };

  return <article className="card fp-post"><details className="fp-details" onToggle={(event) => {
    if (event.currentTarget.open && !comments && !loading && !error) void loadComments();
  }}>
    <summary className="fp-summary">
      <span className="fp-thumbnail" aria-hidden="true">{post.imageUrl
        ? <Image unoptimized src={post.imageUrl} alt="" width={56} height={56} onError={(e) => { e.currentTarget.hidden = true; }} /> : <PostIcon name="text" />}</span>
      <span className="fp-overview"><strong className="fp-title">{title}</strong>
        <time className="fp-date" dateTime={new Date(post.createdAt).toISOString()}>{dateTime(post.createdAt)}</time>
        <span className="fp-stats">{([
          ['heart', 'Cảm xúc', post.reactions], ['comment', 'Bình luận', post.comments], ['share', 'Chia sẻ', post.shares],
        ] as const).map(([icon, label, value]) => <span key={icon} className={!value ? 'fp-stat-muted' : ''}
          aria-label={`${label}: ${value === null ? 'chưa có dữ liệu' : value}`} title={`${label}: ${value === null ? 'chưa có dữ liệu' : value}`}>
          <PostIcon name={icon} />{count(value)}</span>)}</span>
      </span>
      <svg className="fp-chevron" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </summary>
    <div className="fp-expanded">
      <div className="fp-post-content">
        <div className="fp-content-head"><span className="fp-page-label">Bài đăng Facebook</span><a href={post.url} target="_blank" rel="noreferrer">Mở trên Facebook ↗</a></div>
        <p className="fp-message">{post.message || 'Bài đăng này không có nội dung văn bản.'}</p>
        {post.imageUrl && <Image className="fp-image" unoptimized src={post.imageUrl} alt="Ảnh trong bài đăng Facebook" width={960} height={640}
          onError={(e) => { e.currentTarget.hidden = true; }} />}
      </div>
      <section className="fp-comments" aria-label={`Bình luận của bài ${post.id}`}>
        <div className="fp-comments-head"><h3>Bình luận</h3>
          <button type="button" className="btn btn-outline btn-sm" disabled={loading} onClick={() => loadComments()}>Làm mới bình luận</button></div>
        {comments && comments.comments.length === 0 && <p className="fp-muted">Chưa có bình luận hiển thị cho bài này.</p>}
        {comments && <ul className="fp-comment-list">{comments.comments.map((comment) => <CommentThread key={comment.id} comment={comment} postUrl={post.url} />)}</ul>}
        {error && <div role="alert" className="fp-error"><p>{error}</p><button type="button" className="btn btn-outline btn-sm" disabled={loading}
          onClick={() => loadComments(comments?.after ?? undefined)}>Thử lại</button></div>}
        {loading && <p role="status" className="fp-muted">Đang tải bình luận…</p>}
        {comments?.after && !error && <button type="button" className="btn btn-outline btn-sm" disabled={loading}
          onClick={() => loadComments(comments.after!)}>Xem thêm bình luận</button>}
      </section>
    </div>
  </details><div className="fp-quick-actions">
    <button type="button" className="btn btn-outline btn-sm fp-compose" onClick={() => onCompose(post)} title={`Soạn bài AI từ: ${title}`}>
      <PostIcon name="sparkles" /><span>Soạn từ bài này</span></button>
    <a className="fp-external" href={post.url} target="_blank" rel="noreferrer" aria-label={`Mở trên Facebook: ${title}`} title="Mở trên Facebook"><PostIcon name="external" /></a>
  </div></article>;
}

export function FacebookPostsTab({ onCompose }: { onCompose: (post: FacebookFeedPost) => void }) {
  const { data, loading, error, reload } = useMarketingData(client.list);
  const [more, setMore] = useState<FacebookFeedPage>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string>();
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState('all');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [sort, setSort] = useState('newest');
  const refresh = () => { setMore(undefined); setMoreError(undefined); reload(); };
  const posts = [...new Map([...(data?.posts ?? []), ...(more?.posts ?? [])].map((post) => [post.id, post])).values()];
  const after = more ? more.after : data?.after;
  const invalidRange = period === 'custom' && !!start && !!end && start > end;
  const shown = filterFacebookPosts(posts, { query, period, start, end, sort });
  const loadMore = async () => {
    if (!after || loadingMore) return;
    setLoadingMore(true); setMoreError(undefined);
    try {
      const result = await client.more(after);
      setMore((prev) => ({ ...result, posts: [...(prev?.posts ?? []), ...result.posts] }));
    } catch (e) { setMoreError(errorText(e)); }
    finally { setLoadingMore(false); }
  };

  if (error) return <MarketingDataNotice error={error} onRetry={refresh} />;
  return <section className="tab-panel active fp-root" aria-label="Bài đăng Facebook">
    <div className="fp-heading"><div><h2>Bài đăng trên Fanpage</h2><p className="fp-muted">Mở từng bài để xem nội dung và bình luận.</p></div>
      <button type="button" className="btn btn-outline btn-sm" disabled={loading || loadingMore} onClick={refresh}><PostIcon name="refresh" />Làm mới bài đăng</button></div>
    <div className="fp-toolbar">
      <label className="fp-search"><span className="fp-filter-label">Tìm bài đăng</span><span className="fp-search-input"><PostIcon name="search" /><input type="search" className="pc-input" placeholder="Tìm theo từ khóa, nội dung…" value={query} onChange={(e) => setQuery(e.target.value)} /></span></label>
      <label><span id="fp-period-label" className="fp-filter-label">Thời gian</span><select aria-labelledby="fp-period-label" className="pc-input" value={period} onChange={(e) => setPeriod(e.target.value)}>
        <option value="all">Tất cả thời gian</option><option value="today">Hôm nay</option><option value="week">7 ngày qua</option><option value="custom">Tùy chọn</option></select></label>
      <label><span id="fp-sort-label" className="fp-filter-label">Sắp xếp</span><select aria-labelledby="fp-sort-label" className="pc-input" value={sort} onChange={(e) => setSort(e.target.value)}>
        <option value="newest">Mới nhất</option><option value="comments">Nhiều bình luận nhất</option><option value="engagement">Tương tác cao nhất</option></select></label>
      {period === 'custom' && <div className="fp-date-range">
        <label><span className="fp-filter-label">Từ ngày</span><input type="date" className="pc-input" value={start} max={end || undefined} aria-invalid={invalidRange} aria-describedby={invalidRange ? 'fp-range-error' : undefined} onChange={(e) => setStart(e.target.value)} /></label>
        <label><span className="fp-filter-label">Đến ngày</span><input type="date" className="pc-input" value={end} min={start || undefined} aria-invalid={invalidRange} aria-describedby={invalidRange ? 'fp-range-error' : undefined} onChange={(e) => setEnd(e.target.value)} /></label>
      </div>}
    </div>
    {invalidRange && <p id="fp-range-error" role="alert" className="fp-error">Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.</p>}
    <div className="fp-results-info"><span role="status">{shown.length} / {posts.length} bài đã tải</span><span>Tìm kiếm và sắp xếp áp dụng cho các bài đã tải · Giờ Việt Nam</span></div>
    {(loading || loadingMore) && <div role="status" className="fp-loading"><span className="pc-spinner" />{loadingMore ? 'Đang tải thêm bài viết…' : 'Đang tải bài đăng từ Facebook…'}</div>}
    {!loading && data && !posts.length && <div className="card pc-empty">Chưa có bài đăng Facebook để hiển thị.</div>}
    {!loading && posts.length > 0 && !shown.length && !invalidRange && <div className="card pc-empty">Không có bài phù hợp trong các bài đã tải. Hãy đổi bộ lọc{after ? ' hoặc tải thêm bài viết' : ''}.</div>}
    <div className="fp-post-list" aria-busy={loading || loadingMore}>
      {shown.map((post) => <FacebookPostCard key={post.id} post={post} onCompose={onCompose} />)}
      {(loading || loadingMore) && <div className="fp-skeletons" aria-hidden="true">{[1, 2, 3].map((n) => <div className="fp-skeleton" key={n}><span /><div><i /><i /></div></div>)}</div>}
    </div>
    {moreError && <p role="alert" className="fp-error">{moreError}</p>}
    {data && <div className="fp-footer">
      {after && <button type="button" className="btn btn-outline btn-sm" disabled={loading || loadingMore} onClick={loadMore}>
        {loadingMore ? 'Đang tải thêm…' : moreError ? 'Thử tải lại bài đăng' : 'Tải thêm bài viết'}</button>}
      {!after && posts.length > 0 && <span className="fp-muted">Đã hiển thị hết bài viết trên Fanpage.</span>}</div>}
  </section>;
}
