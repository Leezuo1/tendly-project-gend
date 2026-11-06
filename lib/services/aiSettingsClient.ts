'use client';

import { dashboardRequest } from '@/lib/services/postsClient';
import { readAiConfiguration, type AiConfiguration, type AiPlatform } from '@/lib/services/aiConfiguration';

export interface PageAiProfile { pageId: string; platform: AiPlatform; revision: number; configuration: AiConfiguration }

/** Cấu hình AI của shop cho một Page (lưu trên server). Lần đầu chưa lưu server thì lấy bản cũ trong trình duyệt làm nháp. */
export async function readPageAiProfile(pageId: string | null, owner: string): Promise<PageAiProfile> {
  if (!pageId) throw new Error('Tài khoản chưa gắn Page nào để cấu hình AI.');
  const page: PageAiProfile = await (await dashboardRequest(`/api/ai-settings?pageId=${encodeURIComponent(pageId)}`)).json();
  if (page.revision) return page;
  try { return { ...page, configuration: readAiConfiguration(owner) }; } catch { return page; }
}

export async function savePageAiProfile(page: PageAiProfile, configuration: AiConfiguration): Promise<PageAiProfile> {
  return (await dashboardRequest('/api/ai-settings', { method: 'PUT', body: JSON.stringify({ pageId: page.pageId, revision: page.revision, configuration }) })).json();
}
