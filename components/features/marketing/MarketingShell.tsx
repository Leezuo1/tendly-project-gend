'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTabParam } from '@/lib/hooks/useTabParam';
import type { MarketingTab } from '@/lib/types/marketing';
import { Sidebar } from '@/components/features/dashboard/Sidebar';
import { FacebookCommentsTab } from './FacebookCommentsTab';
import { FacebookPostsTab } from './FacebookPostsTab';
import { MarketingWorkspace, type MarketingWorkflowSection } from './MarketingWorkspace';
import { Toast } from '@/components/shared/Toast';

// Giữ nguyên 7 khóa ?tab= để link cũ vẫn mở đúng chỗ; giao diện gom chúng thành 3 khu vực.
const TABS: MarketingTab[] = ['campaigns', 'composer', 'approvals', 'schedule', 'performance', 'facebook-posts', 'comments'];
const AREAS: { key: 'studio' | 'publish' | 'feedback'; label: string; tabs: MarketingTab[] }[] = [
  { key: 'studio', label: 'Studio nội dung', tabs: ['campaigns', 'composer', 'approvals'] },
  { key: 'publish', label: 'Lịch & xuất bản', tabs: ['schedule', 'facebook-posts'] },
  { key: 'feedback', label: 'Phản hồi & hiệu quả', tabs: ['comments', 'performance'] },
];
export function MarketingShell() {
  const [active, setActive] = useTabParam(TABS, 'campaigns');
  const params = useSearchParams();
  const [toast, setToast] = useState<string | null>(null);
  const notify = (message: string) => { setToast(message); setTimeout(() => setToast(null), 3200); };
  const navigate = (key: MarketingTab, postId?: string) => {
    if (document.querySelector('.mw-root [data-unsaved="true"]')) { notify('Lưu hoặc hủy thay đổi đang chỉnh trước khi chuyển mục.'); return; }
    setActive(key, postId ? { post: postId } : undefined);
  };
  const area = AREAS.find(item => item.tabs.includes(active))!;
  // MarketingWorkspace luôn được gắn để giữ nguyên bản nháp; mỗi khu vực chỉ dùng một phần của nó.
  const section: MarketingWorkflowSection = area.key === 'studio' ? active as MarketingWorkflowSection : area.key === 'publish' ? 'schedule' : 'performance';
  return <div className="marketing-root"><div className="shell"><Sidebar currentPath="marketing" onToast={notify} /><main className="main">
    <div className="page-head"><h1>Marketing</h1><p>Brief, bài viết, lịch đăng và phản hồi của khách trong một luồng.</p></div>
    <nav className="mw-main-nav" aria-label="Marketing">{AREAS.map(item => <button key={item.key} type="button" aria-current={item.key === area.key ? 'page' : undefined} onClick={() => item.key !== area.key && navigate(item.tabs[0])}>{item.label}</button>)}</nav>
    <div className="mw-area">
      {area.key === 'feedback' && <div className="mw-area-block"><FacebookCommentsTab key={params.get('post') || 'all'} initialPostId={params.get('post') ?? undefined} onToast={notify} /></div>}
      <div className="mw-area-block"><MarketingWorkspace section={section} onNavigate={(next, postId) => navigate(next as MarketingTab, postId)} /></div>
      {area.key === 'publish' && <div className="mw-area-block"><FacebookPostsTab /></div>}
    </div>
  </main></div><Toast message={toast} /></div>;
}
