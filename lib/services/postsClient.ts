'use client';

import { currentAiKnowledge } from '@/lib/services/aiChat';
import type { GeneratedPostDraft, MarketingPost, NewMarketingPost, PostDraft, PostGenerationRequest, PostImageSource } from '@/lib/types/posts';

const KEY_STORAGE = 'tendly.dashboardKey';
/** Ảnh chủ shop tải lên được thu nhỏ trước khi gửi (Vercel giới hạn body ~4,5MB). */
const UPLOAD_MAX_SIDE = 2048;

export class PostsApiError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number) {
    super(message);
  }
}

/** Mã quản trị (DASHBOARD_KEY) chỉ lưu trên trình duyệt của chủ shop. */
export function getDashboardKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function setDashboardKey(key: string) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    // trình duyệt chặn localStorage: phải nhập lại mỗi lần
  }
}

/** fetch kèm mã quản trị; lỗi HTTP thành PostsApiError (dùng chung cho các API Marketing). */
export async function dashboardRequest(url: string, init: RequestInit = {}): Promise<Response> {
  const key = getDashboardKey();
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new PostsApiError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new PostsApiError(data.error || 'Đã có lỗi xảy ra, thử lại nhé.', data.code, res.status);
  }
  return res;
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await dashboardRequest(url, init);
  if (res.status === 204) return undefined as T;
  return await res.json() as T;
}

/** Đọc ảnh chủ shop chọn, thu nhỏ cạnh dài về tối đa 2048px và nén JPEG. */
export async function prepareUploadImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new PostsApiError('File đã chọn không phải ảnh.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new PostsApiError('Trình duyệt không đọc được ảnh này (HEIC?). Chọn ảnh JPG hoặc PNG nhé.');
  }
  const scale = Math.min(1, UPLOAD_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PostsApiError('Trình duyệt không xử lý được ảnh.');
  ctx.fillStyle = '#fff'; // ảnh PNG trong suốt → nền trắng khi đổi sang JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  if (!blob) throw new PostsApiError('Không nén được ảnh, thử ảnh khác nhé.');
  return blob;
}

export const postsClient = {
  generate: (req: PostGenerationRequest) =>
    call<{ drafts: GeneratedPostDraft[]; model: string }>('/api/posts/generate', {
      method: 'POST',
      // Đọc lại Cấu hình AI mỗi lần tạo để dùng đúng giá/tồn kho/FAQ vừa lưu.
      body: JSON.stringify({ request: req, knowledge: currentAiKnowledge() }),
    }),
  list: () => call<{ posts: MarketingPost[]; facebookReady: boolean }>('/api/posts'),
  create: (post: NewMarketingPost) =>
    call<{ post: MarketingPost }>('/api/posts', { method: 'POST', body: JSON.stringify(post) }).then((r) => r.post),
  update: (id: string, patch: Partial<PostDraft>) =>
    call<{ post: MarketingPost }>(`/api/posts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) })
      .then((r) => r.post),
  remove: (id: string) => call<void>(`/api/posts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  publish: (id: string, mode: 'page' | 'manual') =>
    call<{ post: MarketingPost }>(`/api/posts/${encodeURIComponent(id)}/publish`, { method: 'POST', body: JSON.stringify({ mode }) })
      .then((r) => r.post),

  /** AI vẽ ảnh từ mô tả, trả ảnh để xem trước (chưa lưu). */
  generateImage: (prompt: string) =>
    dashboardRequest('/api/posts/generate-image', { method: 'POST', body: JSON.stringify({ prompt }) }).then((r) => r.blob()),
  getImage: (id: string) => dashboardRequest(`/api/posts/${encodeURIComponent(id)}/image`).then((r) => r.blob()),
  setImage: (id: string, image: Blob, source: PostImageSource) =>
    call<{ post: MarketingPost }>(`/api/posts/${encodeURIComponent(id)}/image`, {
      method: 'PUT', body: image, headers: { 'Content-Type': image.type || 'application/octet-stream', 'X-Image-Source': source },
    }).then((r) => r.post),
  removeImage: (id: string) =>
    call<{ post: MarketingPost }>(`/api/posts/${encodeURIComponent(id)}/image`, { method: 'DELETE' }).then((r) => r.post),
};
