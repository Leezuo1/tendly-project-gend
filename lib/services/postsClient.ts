'use client';

import { currentAiKnowledge } from '@/lib/services/aiChat';
import type { MarketingPost, NewMarketingPost, PostDraft, PostGenerationRequest } from '@/lib/types/posts';

const KEY_STORAGE = 'tendly.dashboardKey';

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

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const key = getDashboardKey();
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
    });
  } catch {
    throw new PostsApiError('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new PostsApiError(data.error || 'Đã có lỗi xảy ra, thử lại nhé.', data.code, res.status);
  return data as T;
}

export const postsClient = {
  generate: (request: PostGenerationRequest) =>
    call<{ drafts: PostDraft[]; model: string }>('/api/posts/generate', {
      method: 'POST',
      // Đọc lại Cấu hình AI mỗi lần tạo để dùng đúng giá/tồn kho/FAQ vừa lưu.
      body: JSON.stringify({ request, knowledge: currentAiKnowledge() }),
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
};
