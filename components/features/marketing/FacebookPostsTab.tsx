'use client';

import { useState } from 'react';
import Image from 'next/image';
import { CustomerAvatar } from '@/components/features/inbox/CustomerAvatar';
import { useMarketingData } from '@/lib/hooks/useMarketingData';
import { facebookFeedClient as client } from '@/lib/services/facebookFeedClient';
import type { FacebookFeedPage, FacebookFeedPost, FacebookPostComment, FacebookPostCommentsPage } from '@/lib/types/facebookFeed';
import { formatNumber, initials } from '@/lib/utils/format';
import { MarketingDataNotice } from './MarketingDataNotice';

const dateTime = (timestamp: number) => new Date(timestamp).toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
});
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Không tải được dữ liệu Facebook.';
const count = (value: number | null) => value === null ? '—' : formatNumber(value);

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

function FacebookPostCard({ post }: { post: FacebookFeedPost }) {
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

  return <details className="card fp-post" onToggle={(event) => {
    if (event.currentTarget.open && !comments && !loading && !error) void loadComments();
  }}>
    <summary className="fp-summary">
      <span className="fp-thumbnail" aria-hidden="true">{post.imageUrl
        ? <Image unoptimized src={post.imageUrl} alt="" width={64} height={64} onError={(e) => { e.currentTarget.hidden = true; }} /> : 'f'}</span>
      <span className="fp-overview"><strong className="fp-title">{title}</strong>
        <span className="fp-date">Facebook · {dateTime(post.createdAt)}</span>
        <span className="fp-stats"><span>{count(post.reactions)} cảm xúc</span><span>{count(post.comments)} bình luận</span><span>{count(post.shares)} chia sẻ</span></span>
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
  </details>;
}

export function FacebookPostsTab() {
  const { data, loading, error, reload } = useMarketingData(client.list);
  const [more, setMore] = useState<FacebookFeedPage>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string>();
  const refresh = () => { setMore(undefined); setMoreError(undefined); reload(); };
  const posts = [...new Map([...(data?.posts ?? []), ...(more?.posts ?? [])].map((post) => [post.id, post])).values()];
  const after = more ? more.after : data?.after;
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
    <div className="fp-heading"><div><h2>Bài đăng trên Fanpage</h2><p className="fp-muted">Bấm mũi tên để xem nội dung và bình luận của từng bài.</p></div>
      <button type="button" className="btn btn-outline btn-sm" disabled={loading || loadingMore} onClick={refresh}>Làm mới bài đăng</button></div>
    {loading && <p role="status" className="fp-muted">Đang tải bài đăng từ Facebook…</p>}
    {!loading && data && !posts.length && <div className="card pc-empty">Chưa có bài đăng Facebook để hiển thị.</div>}
    {posts.map((post) => <FacebookPostCard key={post.id} post={post} />)}
    {moreError && <p role="alert" className="fp-error">{moreError}</p>}
    {data && <div className="fp-footer"><span className="fp-muted">Đã tải {posts.length} bài đăng</span>
      {after && <button type="button" className="btn btn-outline btn-sm" disabled={loading || loadingMore} onClick={loadMore}>
        {loadingMore ? 'Đang tải thêm…' : moreError ? 'Thử tải lại bài đăng' : 'Xem thêm bài đăng'}</button>}</div>}
  </section>;
}
