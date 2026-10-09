'use client';

import { currentAiKnowledge } from '@/lib/services/aiChat';
import { dashboardRequest } from '@/lib/services/postsClient';
import type { MarketingCustomer, MarketingPerformance, RemarketingDraft } from '@/lib/types/marketing';

const json = <T,>(res: Response) => res.json() as Promise<T>;
const post = (url: string, body: unknown) => dashboardRequest(url, { method: 'POST', body: JSON.stringify(body) });

export const marketingClient = {
  /** Gửi kèm Cấu hình AI (lưu trên trình duyệt) để server dò khách đã hỏi sản phẩm nào. */
  customers: () => post('/api/marketing/customers', { knowledge: currentAiKnowledge() })
    .then(json<{ customers: MarketingCustomer[]; now: number }>),
  draft: (psid: string) => post('/api/marketing/remarketing/draft', { psid, knowledge: currentAiKnowledge() })
    .then(json<{ draft: RemarketingDraft }>).then((r) => r.draft),
  send: (psid: string, text: string, requestId: string) => post('/api/marketing/remarketing/send', { psid, text, requestId })
    .then(json<{ sentAt: number }>),
  performance: () => dashboardRequest('/api/marketing/performance').then(json<MarketingPerformance>),
};
