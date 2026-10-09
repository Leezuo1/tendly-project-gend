'use client';

import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMockDbVersion } from '@/lib/hooks/useMockDbVersion';
import { POST_CHANNELS, POST_GOALS, POST_TONES } from '@/lib/services/aiPost';
import { snapshot } from '@/lib/services/api';
import { getDashboardKey, postsClient, PostsApiError, prepareUploadImage, setDashboardKey } from '@/lib/services/postsClient';
import type { GeneratedPostDraft, MarketingPost, PostChannel, PostDraft, PostGoal, PostImageSource, PostTone } from '@/lib/types/posts';
import { formatMoney, normalize } from '@/lib/utils/format';
import { PostImageField, SavedPostImage, type ImageBusy } from './PostImageField';

interface PostComposerTabProps {
  onToast: (msg: string) => void;
}

const BRAND_STORAGE = 'tendly.brandVoice';
const MAX_PRODUCTS = 5;
const TIKTOK_LIMIT = 150;

/** Ảnh của bản nháp chưa lưu: giữ blob trên trình duyệt, chỉ gửi lên server khi bấm lưu/đăng. */
type DraftImage = { blob: Blob; url: string; source: PostImageSource };
type EditableDraft = GeneratedPostDraft & { key: string; saving?: boolean; image?: DraftImage; imageBusy?: ImageBusy };

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'lỗi không rõ');
const releaseImage = (d: EditableDraft) => d.image && URL.revokeObjectURL(d.image.url);

const titleLabel = (channel: PostChannel) => (channel === 'email' ? 'Tiêu đề email' : channel === 'tiktok' ? 'Tên ý tưởng video' : 'Tiêu đề (nội bộ)');
const ideaLabel = (channel: PostChannel) => (channel === 'tiktok' ? '🎬 Kịch bản video' : '📸 Gợi ý hình ảnh');
const parseTags = (value: string) => value.split(/[\s,]+/).filter(Boolean).map((t) => (t.startsWith('#') ? t : `#${t}`));
const fullText = (post: Pick<PostDraft, 'title' | 'content' | 'hashtags'>, channel: PostChannel) =>
  [channel === 'email' && post.title ? `Tiêu đề: ${post.title}` : '', post.content, post.hashtags.join(' ')].filter(Boolean).join('\n\n');
const dateTime = (ts: number) => new Date(ts).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

function readBrandVoice() {
  try {
    return localStorage.getItem(BRAND_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function PostComposerTab({ onToast }: PostComposerTabProps) {
  // ---- form ----
  const [channel, setChannel] = useState<PostChannel>('facebook');
  const [goal, setGoal] = useState<PostGoal>('new-product');
  const [tone, setTone] = useState<PostTone>('friendly');
  const [productIds, setProductIds] = useState<string[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [brandVoice, setBrandVoice] = useState('');
  const [variants, setVariants] = useState(2);
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState<EditableDraft[]>([]);
  const [draftMeta, setDraftMeta] = useState<{ channel: PostChannel; goal: PostGoal; skus: string[] } | null>(null);
  const [error, setError] = useState('');

  // ---- bài đã lưu ----
  const [posts, setPosts] = useState<MarketingPost[] | null>(null);
  const [facebookReady, setFacebookReady] = useState(false);
  const [listError, setListError] = useState<PostsApiError | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; content: string; hashtags: string } | null>(null);

  // ---- mã quản trị ----
  // NEED_DASHBOARD_KEY: chưa nhập/nhập sai mã · NO_DASHBOARD_KEY: server production chưa đặt mã
  const [needKey, setNeedKey] = useState<'NEED_DASHBOARD_KEY' | 'NO_DASHBOARD_KEY' | null>(null);
  const [keyInput, setKeyInput] = useState('');

  // sản phẩm lấy từ Cấu hình AI (mock DB trên trình duyệt), đọc sau khi hydrate
  const dbVersion = useMockDbVersion();
  const products = useMemo(() => (dbVersion < 0 ? [] : snapshot.products()), [dbVersion]);
  const shownProducts = useMemo(() => {
    const q = normalize(productQuery);
    return products.filter((p) => !q || normalize(`${p.name} ${p.sku} ${p.category}`).includes(q)).slice(0, 12);
  }, [products, productQuery]);

  const handleError = useCallback((e: unknown, fallbackToast = true) => {
    if (e instanceof PostsApiError && (e.code === 'NEED_DASHBOARD_KEY' || e.code === 'NO_DASHBOARD_KEY')) {
      setNeedKey(e.code);
      return;
    }
    if (fallbackToast) onToast(e instanceof Error ? e.message : 'Đã có lỗi xảy ra, thử lại nhé');
  }, [onToast]);

  const loadPosts = useCallback(async () => {
    try {
      const data = await postsClient.list();
      setPosts(data.posts);
      setFacebookReady(data.facebookReady);
      setListError(null);
    } catch (e) {
      setPosts([]);
      if (e instanceof PostsApiError) setListError(e);
      handleError(e, false);
    }
  }, [handleError]);

  useEffect(() => {
    // localStorage chỉ có sau khi mount; đọc 1 lần rồi tải danh sách bài
    const saved = readBrandVoice();
    const timer = setTimeout(() => {
      if (saved) setBrandVoice(saved);
      void loadPosts();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPosts]);

  const toggleProduct = (id: string) => {
    setProductIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PRODUCTS) {
        onToast(`Chọn tối đa ${MAX_PRODUCTS} sản phẩm cho một bài`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const onGenerate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!productIds.length && !notes.trim()) {
      setError('Chọn ít nhất 1 sản phẩm hoặc ghi chú nội dung muốn viết.');
      return;
    }
    try {
      localStorage.setItem(BRAND_STORAGE, brandVoice);
    } catch {
      // không lưu được thì thôi
    }
    setGenerating(true);
    try {
      const { drafts: result } = await postsClient.generate({ channel, goal, tone, productIds, notes, brandVoice, variants });
      drafts.forEach(releaseImage);
      setDrafts(result.map((d, i) => ({ ...d, key: `${Date.now()}-${i}` })));
      setDraftMeta({
        channel, goal,
        skus: products.filter((p) => productIds.includes(p.id)).map((p) => p.sku),
      });
    } catch (err) {
      if (err instanceof PostsApiError && (err.code === 'NEED_DASHBOARD_KEY' || err.code === 'NO_DASHBOARD_KEY')) setNeedKey(err.code);
      else setError(err instanceof Error ? err.message : 'AI chưa viết được bài, thử lại nhé.');
    } finally {
      setGenerating(false);
    }
  };

  const updateDraft = (key: string, patch: Partial<EditableDraft>) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  /** Thay ảnh của bản nháp (hoặc bỏ ảnh khi image = undefined), giải phóng ảnh cũ khỏi bộ nhớ. */
  const replaceDraftImage = (key: string, image: DraftImage | undefined) => {
    const old = drafts.find((d) => d.key === key)?.image;
    if (old && old !== image) URL.revokeObjectURL(old.url);
    updateDraft(key, { image, imageBusy: undefined });
  };

  const loadDraftImage = async (draft: EditableDraft, kind: 'ai' | 'upload', getBlob: () => Promise<Blob>) => {
    updateDraft(draft.key, { imageBusy: kind });
    try {
      const blob = await getBlob();
      replaceDraftImage(draft.key, { blob, url: URL.createObjectURL(blob), source: kind });
    } catch (e) {
      updateDraft(draft.key, { imageBusy: undefined });
      handleError(e);
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      onToast('Đã sao chép nội dung');
    } catch {
      onToast('Trình duyệt không cho sao chép, bôi đen để copy nhé');
    }
  };

  /** Lưu bản nháp vào database; publish=true thì đăng luôn lên Fanpage. */
  const saveDraft = async (draft: EditableDraft, publish: boolean) => {
    if (!draftMeta) return;
    if (!draft.content.trim()) {
      onToast('Nội dung bài viết đang trống');
      return;
    }
    if (publish && !window.confirm(draft.image
      ? 'Đăng bài này kèm ảnh lên Fanpage thật ngay bây giờ?'
      : 'Đăng bài này lên Fanpage thật ngay bây giờ?')) return;
    updateDraft(draft.key, { saving: true });
    try {
      let post = await postsClient.create({
        channel: draftMeta.channel, goal: draftMeta.goal, productSkus: draftMeta.skus,
        title: draft.title, content: draft.content, hashtags: draft.hashtags, imageIdea: draft.imageIdea,
      });
      let imageSaved = true;
      if (draft.image) {
        try {
          post = await postsClient.setImage(post.id, draft.image.blob, draft.image.source);
        } catch (e) {
          // Không đăng bài thiếu ảnh ngoài ý muốn: giữ nháp để chủ shop gắn lại ảnh rồi đăng.
          imageSaved = false;
          onToast(`Đã lưu nháp nhưng chưa lưu được ảnh: ${errorText(e)}`);
        }
      }
      if (publish && imageSaved) {
        try {
          post = await postsClient.publish(post.id, 'page');
          onToast('Đã đăng bài lên Fanpage 🎉');
        } catch (e) {
          onToast(`Đã lưu nháp nhưng chưa đăng được: ${errorText(e)}`);
        }
      } else if (imageSaved) {
        onToast('Đã lưu bản nháp');
      }
      setPosts((prev) => [post, ...(prev ?? []).filter((p) => p.id !== post.id)]);
      setListError(null);
      releaseImage(draft);
      setDrafts((prev) => prev.filter((d) => d.key !== draft.key));
    } catch (e) {
      updateDraft(draft.key, { saving: false });
      handleError(e);
    }
  };

  const runOnPost = async (id: string, action: () => Promise<MarketingPost | void>, success: string) => {
    setBusyId(id);
    try {
      const result = await action();
      if (result) setPosts((prev) => (prev ?? []).map((p) => (p.id === id ? result : p)));
      else setPosts((prev) => (prev ?? []).filter((p) => p.id !== id));
      onToast(success);
    } catch (e) {
      handleError(e);
    } finally {
      setBusyId(null);
    }
  };

  const saveKey = (e: FormEvent) => {
    e.preventDefault();
    setDashboardKey(keyInput.trim());
    setKeyInput('');
    setNeedKey(null);
    void loadPosts();
  };

  const channelOf = draftMeta?.channel ?? channel;

  return (
    <div className="tab-panel active pc-root" id="tab-composer">
      {needKey && (
        <div className="card pc-key">
          <div>
            <h2>🔒 Cần mã quản trị</h2>
            {needKey === 'NO_DASHBOARD_KEY' ? (
              <p>
                Server chưa đặt biến môi trường <code>DASHBOARD_KEY</code> nên chức năng soạn &amp; đăng bài đang bị khoá.
                Thêm biến này trên Vercel (Settings → Environment Variables) rồi deploy lại.
              </p>
            ) : (
              <p>
                Chức năng soạn &amp; đăng bài được khoá bằng <code>DASHBOARD_KEY</code> (đặt trong biến môi trường của server)
                để người ngoài không đăng bài lên Fanpage của shop.{getDashboardKey() ? ' Mã đang lưu không đúng.' : ''}
              </p>
            )}
          </div>
          {needKey === 'NEED_DASHBOARD_KEY' && (
            <form onSubmit={saveKey} className="pc-key-form">
              <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="Nhập mã quản trị" />
              <button className="btn btn-primary btn-sm" disabled={!keyInput.trim()}>Lưu mã</button>
            </form>
          )}
        </div>
      )}

      <form className="card" onSubmit={onGenerate}>
        <div className="card-head">
          <h2>✨ Soạn bài với AI</h2>
          <span className="hint">AI viết dựa trên sản phẩm &amp; FAQ trong Cấu hình AI</span>
        </div>

        <div className="pc-grid">
          <div className="pc-field">
            <label>Kênh đăng</label>
            <div className="pc-chips">
              {(Object.keys(POST_CHANNELS) as PostChannel[]).map((c) => (
                <button type="button" key={c} className={`chip${channel === c ? ' selected' : ''}`} onClick={() => setChannel(c)}>
                  {POST_CHANNELS[c].label}
                </button>
              ))}
            </div>
            <span className="pc-hint">{POST_CHANNELS[channel].hint}</span>
          </div>

          <div className="pc-field">
            <label>Mục tiêu bài viết</label>
            <div className="pc-chips">
              {(Object.keys(POST_GOALS) as PostGoal[]).map((g) => (
                <button type="button" key={g} className={`chip pc-chip-sm${goal === g ? ' selected' : ''}`} onClick={() => setGoal(g)}>
                  {POST_GOALS[g]}
                </button>
              ))}
            </div>
          </div>

          <div className="pc-field pc-span">
            <label>
              Sản phẩm ({productIds.length}/{MAX_PRODUCTS})
            </label>
            <input
              className="pc-input"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder="Tìm theo tên, mã SKU, danh mục..."
            />
            <div className="pc-products">
              {shownProducts.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  className={`pc-product${productIds.includes(p.id) ? ' selected' : ''}${p.qty === 0 ? ' out' : ''}`}
                  onClick={() => toggleProduct(p.id)}
                  title={p.qty === 0 ? 'Hết hàng — AI sẽ không quảng bá như còn hàng' : undefined}
                >
                  <span className="pc-product-emoji">{p.emoji}</span>
                  <span className="pc-product-info">
                    <span className="pc-product-name">{p.name}</span>
                    <span className="pc-product-meta">{p.sku} · {formatMoney(p.price)} · {p.qty === 0 ? 'Hết hàng' : `Còn ${p.qty}`}</span>
                  </span>
                </button>
              ))}
              {dbVersion >= 0 && shownProducts.length === 0 && <span className="pc-hint">Không tìm thấy sản phẩm phù hợp</span>}
            </div>
          </div>

          <div className="pc-field">
            <label htmlFor="pc-tone">Giọng văn</label>
            <select id="pc-tone" className="pc-input" value={tone} onChange={(e) => setTone(e.target.value as PostTone)}>
              {(Object.keys(POST_TONES) as PostTone[]).map((t) => <option key={t} value={t}>{POST_TONES[t]}</option>)}
            </select>
          </div>

          <div className="pc-field">
            <label>Số phương án</label>
            <div className="pc-chips">
              {[1, 2, 3].map((n) => (
                <button type="button" key={n} className={`chip${variants === n ? ' selected' : ''}`} onClick={() => setVariants(n)}>{n}</button>
              ))}
            </div>
          </div>

          <div className="pc-field">
            <label htmlFor="pc-brand">Mô tả thương hiệu <span className="pc-optional">(tuỳ chọn, tự nhớ)</span></label>
            <textarea
              id="pc-brand"
              className="pc-input"
              rows={3}
              maxLength={500}
              value={brandVoice}
              onChange={(e) => setBrandVoice(e.target.value)}
              placeholder="VD: Tendly — thời trang basic cho nữ văn phòng 22–30 tuổi, xưng 'mình' gọi 'bạn', ít emoji"
            />
          </div>

          <div className="pc-field">
            <label htmlFor="pc-notes">Ghi chú cho AI <span className="pc-optional">(khuyến mãi, sự kiện...)</span></label>
            <textarea
              id="pc-notes"
              className="pc-input"
              rows={3}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VD: Giảm 15% cuối tuần với mã CUOITUAN15, freeship đơn từ 300k"
            />
          </div>
        </div>

        {error && <p className="pc-error">{error}</p>}
        <div className="pc-actions">
          <button type="submit" className="btn btn-primary" disabled={generating}>
            {generating ? <><span className="pc-spinner" /> AI đang viết...</> : '✨ Tạo bài với AI'}
          </button>
        </div>
      </form>

      {drafts.length > 0 && draftMeta && (
        <div className="card">
          <div className="card-head">
            <h2>Bản nháp AI vừa viết</h2>
            <span className="hint">{POST_CHANNELS[draftMeta.channel].label} · sửa thoải mái trước khi lưu/đăng</span>
          </div>
          <div className="pc-drafts">
            {drafts.map((d, i) => {
              const tooLong = draftMeta.channel === 'tiktok' && d.content.length > TIKTOK_LIMIT;
              return (
                <div key={d.key} className="pc-draft">
                  <div className="pc-draft-head">Phương án {i + 1}</div>
                  <label className="pc-mini-label">{titleLabel(draftMeta.channel)}</label>
                  <input className="pc-input" value={d.title} onChange={(e) => updateDraft(d.key, { title: e.target.value })} />
                  <label className="pc-mini-label">
                    Nội dung <span className={tooLong ? 'pc-count over' : 'pc-count'}>{d.content.length}{draftMeta.channel === 'tiktok' ? `/${TIKTOK_LIMIT}` : ''} ký tự</span>
                  </label>
                  <textarea className="pc-input" rows={8} value={d.content} onChange={(e) => updateDraft(d.key, { content: e.target.value })} />
                  <label className="pc-mini-label">Hashtag</label>
                  <input
                    className="pc-input"
                    value={d.hashtags.join(' ')}
                    onChange={(e) => updateDraft(d.key, { hashtags: parseTags(e.target.value) })}
                  />
                  {d.imageIdea && (
                    <div className="pc-idea"><b>{ideaLabel(draftMeta.channel)}:</b> {d.imageIdea}</div>
                  )}
                  <label className="pc-mini-label">Ảnh kèm bài</label>
                  <PostImageField
                    url={d.image?.url ?? null}
                    source={d.image?.source ?? null}
                    busy={d.imageBusy}
                    disabled={d.saving}
                    onGenerate={() => loadDraftImage(d, 'ai', () => postsClient.generateImage(d.imagePrompt || d.imageIdea || d.content.slice(0, 300)))}
                    onUpload={(file) => loadDraftImage(d, 'upload', () => prepareUploadImage(file))}
                    onRemove={() => replaceDraftImage(d.key, undefined)}
                  />
                  <details className="pc-prompt">
                    <summary>Sửa mô tả cho AI vẽ ảnh</summary>
                    <textarea
                      className="pc-input"
                      rows={3}
                      maxLength={600}
                      value={d.imagePrompt}
                      onChange={(e) => updateDraft(d.key, { imagePrompt: e.target.value })}
                      placeholder="Mô tả bằng tiếng Anh, VD: white cotton t-shirt on a wooden hanger, beige background"
                    />
                  </details>
                  <div className="pc-draft-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => copy(fullText(d, draftMeta.channel))}>Sao chép</button>
                    <button type="button" className="btn btn-outline btn-sm" disabled={d.saving || Boolean(d.imageBusy)} onClick={() => saveDraft(d, false)}>Lưu nháp</button>
                    {draftMeta.channel === 'facebook' && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={d.saving || Boolean(d.imageBusy) || !facebookReady}
                        title={facebookReady ? undefined : 'Chưa cấu hình PAGE_ID / PAGE_ACCESS_TOKEN trên server'}
                        onClick={() => saveDraft(d, true)}
                      >
                        Lưu &amp; đăng Fanpage
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>Bài đăng đã lưu</h2>
          <span className="hint">
            {posts ? `${posts.filter((p) => p.status === 'draft').length} nháp · ${posts.filter((p) => p.status === 'published').length} đã đăng` : 'Đang tải...'}
          </span>
        </div>

        {listError && listError.code !== 'NEED_DASHBOARD_KEY' && listError.code !== 'NO_DASHBOARD_KEY' && (
          <div className="pc-notice">
            <b>{listError.message}</b>
            {(listError.code === 'NO_DATABASE' || listError.code === 'NO_TABLE') && (
              <span> AI vẫn soạn bài được, nhưng muốn lưu &amp; đăng thì cần tạo Postgres, đặt <code>DATABASE_URL</code> rồi chạy <code>npm run db:migrate</code>.</span>
            )}
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void loadPosts()}>Thử lại</button>
          </div>
        )}
        {!facebookReady && posts && !listError && (
          <p className="pc-hint pc-fb-hint">Chưa cấu hình <code>PAGE_ID</code> + <code>PAGE_ACCESS_TOKEN</code> nên chưa đăng thẳng lên Fanpage được — vẫn lưu nháp và copy để đăng tay.</p>
        )}

        {posts?.length === 0 && !listError && <div className="pc-empty">Chưa có bài nào — tạo bài với AI ở trên rồi bấm &quot;Lưu nháp&quot;.</div>}

        {posts?.map((p) => {
          const busy = busyId === p.id;
          const isEditing = editing?.id === p.id;
          return (
            <div key={p.id} className="pc-post">
              <div className="pc-post-top">
                <span className={`pc-status ${p.status}`}>{p.status === 'draft' ? 'Nháp' : 'Đã đăng'}</span>
                <span className="pc-channel">{POST_CHANNELS[p.channel].label}</span>
                <span className="pc-goal">{POST_GOALS[p.goal]}</span>
                <span className="pc-time">
                  {p.status === 'published' && p.publishedAt ? `Đăng ${dateTime(p.publishedAt)}` : `Tạo ${dateTime(p.createdAt)}`}
                </span>
              </div>
              {p.title && <div className="pc-post-title">{p.title}</div>}
              <SavedPostImage
                post={p}
                editing={isEditing}
                onChange={(updated) => setPosts((prev) => (prev ?? []).map((x) => (x.id === updated.id ? updated : x)))}
                onError={handleError}
              />
              {isEditing ? (
                <>
                  <textarea className="pc-input" rows={6} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
                  <input className="pc-input" value={editing.hashtags} onChange={(e) => setEditing({ ...editing, hashtags: e.target.value })} />
                </>
              ) : (
                <div className="pc-post-content">
                  {p.content}
                  {p.hashtags.length > 0 && <div className="pc-tags">{p.hashtags.join(' ')}</div>}
                </div>
              )}
              <div className="pc-draft-actions">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => runOnPost(p.id, async () => {
                        const updated = await postsClient.update(p.id, { content: editing.content, hashtags: parseTags(editing.hashtags) });
                        setEditing(null);
                        return updated;
                      }, 'Đã cập nhật bài nháp')}
                    >
                      Lưu
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Huỷ</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => copy(fullText(p, p.channel))}>Sao chép</button>
                    {p.status === 'draft' && (
                      <>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing({ id: p.id, content: p.content, hashtags: p.hashtags.join(' ') })}>Sửa</button>
                        {p.channel === 'facebook' && facebookReady && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={busy}
                            onClick={() => window.confirm(p.image
                              ? 'Đăng bài này kèm ảnh lên Fanpage thật ngay bây giờ?'
                              : 'Đăng bài này lên Fanpage thật ngay bây giờ?') &&
                              runOnPost(p.id, () => postsClient.publish(p.id, 'page'), 'Đã đăng bài lên Fanpage 🎉')}
                          >
                            Đăng Fanpage
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={busy}
                          onClick={() => runOnPost(p.id, () => postsClient.publish(p.id, 'manual'), 'Đã đánh dấu là đã đăng')}
                        >
                          Đánh dấu đã đăng
                        </button>
                      </>
                    )}
                    {p.externalUrl && (
                      <a className="btn btn-outline btn-sm" href={p.externalUrl} target="_blank" rel="noreferrer">Xem trên Facebook ↗</a>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm pc-danger"
                      disabled={busy}
                      onClick={() => window.confirm(p.status === 'published'
                        ? 'Xoá bài khỏi Tendly? (Bài trên Fanpage vẫn giữ nguyên)'
                        : 'Xoá bản nháp này?') && runOnPost(p.id, () => postsClient.remove(p.id), 'Đã xoá bài viết')}
                    >
                      Xoá
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
