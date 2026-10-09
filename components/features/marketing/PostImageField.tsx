'use client';

import React, { useEffect, useRef, useState } from 'react';
import { postsClient, prepareUploadImage } from '@/lib/services/postsClient';
import type { MarketingPost, PostImageSource } from '@/lib/types/posts';

export type ImageBusy = 'ai' | 'upload' | 'remove';

interface PostImageFieldProps {
  url: string | null;
  source: PostImageSource | null;
  busy?: ImageBusy;
  disabled?: boolean;
  onGenerate: () => void;
  onUpload: (file: File) => void;
  onRemove: () => void;
}

const SOURCE_LABEL: Record<PostImageSource, string> = { ai: '✨ Ảnh AI', upload: '📁 Ảnh của bạn' };

/** Khung ảnh kèm bài: xem trước + tạo ảnh AI / tải ảnh lên / bỏ ảnh. */
export function PostImageField({ url, source, busy, disabled, onGenerate, onUpload, onRemove }: PostImageFieldProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const locked = disabled || Boolean(busy);

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // chọn lại cùng file vẫn kích hoạt onChange
    if (file) onUpload(file);
  };

  return (
    <div className="pc-image">
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickFile} />
      {busy === 'ai' || busy === 'upload' ? (
        <div className="pc-image-empty">
          <span className="pc-spinner" /> {busy === 'ai' ? 'AI đang vẽ ảnh (khoảng 5–30 giây)...' : 'Đang xử lý ảnh...'}
        </div>
      ) : url ? (
        <div className="pc-image-preview">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh blob cục bộ, next/image không tối ưu được */}
          <img src={url} alt="Ảnh kèm bài viết" />
          {source && <span className="pc-image-badge">{SOURCE_LABEL[source]}</span>}
        </div>
      ) : (
        <div className="pc-image-empty">Chưa có ảnh — bài sẽ đăng dạng chữ</div>
      )}
      <div className="pc-image-actions">
        <button type="button" className="btn btn-outline btn-sm" disabled={locked} onClick={onGenerate}>
          {url ? '✨ Tạo lại ảnh AI' : '✨ Tạo ảnh AI'}
        </button>
        <button type="button" className="btn btn-outline btn-sm" disabled={locked} onClick={() => fileInput.current?.click()}>
          {url ? '📁 Đổi ảnh' : '📁 Tải ảnh lên'}
        </button>
        {url && (
          <>
            <a className="btn btn-outline btn-sm" href={url} download="tendly-anh-bai-viet.jpg">Tải về</a>
            <button type="button" className="btn btn-outline btn-sm pc-danger" disabled={locked} onClick={onRemove}>Bỏ ảnh</button>
          </>
        )}
      </div>
      {source === 'ai' && url && <span className="pc-hint">Ảnh AI miễn phí (Pollinations) có logo nhỏ ở góc.</span>}
    </div>
  );
}

/** Tải ảnh của bài đã lưu (API cần mã quản trị nên không dùng thẳng <img src>). */
function useSavedImageUrl(post: MarketingPost): string | null {
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null);
  const key = post.image ? `${post.id}:${post.image.updatedAt}` : null;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let url: string | null = null;
    postsClient.getImage(post.id)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setLoaded({ key, url });
      })
      .catch(() => { /* ảnh lỗi thì chỉ không hiện xem trước */ });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key, post.id]);

  return loaded && loaded.key === key ? loaded.url : null;
}

interface SavedPostImageProps {
  post: MarketingPost;
  editing: boolean;
  onChange: (post: MarketingPost) => void;
  onError: (error: unknown) => void;
}

/** Ảnh của bài đã lưu: chỉ xem; khi bấm "Sửa" bài nháp thì đổi/bỏ/tạo ảnh được (lưu ngay). */
export function SavedPostImage({ post, editing, onChange, onError }: SavedPostImageProps) {
  const url = useSavedImageUrl(post);
  const [busy, setBusy] = useState<ImageBusy | undefined>();

  const run = async (kind: ImageBusy, action: () => Promise<MarketingPost>) => {
    setBusy(kind);
    try {
      onChange(await action());
    } catch (e) {
      onError(e);
    } finally {
      setBusy(undefined);
    }
  };

  if (editing && post.status === 'draft') {
    return (
      <PostImageField
        url={url}
        source={post.image?.source ?? null}
        busy={busy}
        onGenerate={() => run('ai', async () =>
          postsClient.setImage(post.id, await postsClient.generateImage(post.imageIdea || post.content.slice(0, 300)), 'ai'))}
        onUpload={(file) => run('upload', async () => postsClient.setImage(post.id, await prepareUploadImage(file), 'upload'))}
        onRemove={() => run('remove', () => postsClient.removeImage(post.id))}
      />
    );
  }
  if (!post.image) return null;
  return (
    <div className="pc-image-preview pc-image-thumb">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- ảnh blob cục bộ, next/image không tối ưu được
        <img src={url} alt="Ảnh kèm bài viết" />
      ) : (
        <span className="pc-hint">Đang tải ảnh...</span>
      )}
    </div>
  );
}
