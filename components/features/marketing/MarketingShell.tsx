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

const WORKFLOW: { key: MarketingTab; label: string }[] = [{ key: 'campaigns', label: 'Chiến dịch' }, { key: 'composer', label: 'Soạn nội dung' }, { key: 'approvals', label: 'Duyệt nội dung' }, { key: 'schedule', label: 'Lịch đăng' }, { key: 'performance', label: 'Hiệu quả' }];
const TABS: { key: MarketingTab; label: string }[] = [...WORKFLOW, { key: 'facebook-posts', label: 'Bài Facebook' }, { key: 'comments', label: 'Bình luận & private reply' }];
export function MarketingShell() {
  const [active, setActive] = useTabParam(TABS.map(item => item.key), 'campaigns');
  const params = useSearchParams();
  const [toast, setToast] = useState<string | null>(null);
  const notify = (message: string) => { setToast(message); setTimeout(() => setToast(null), 3200); };
  const navigate = (key: MarketingTab, postId?: string) => {
    if (document.querySelector('.mw-root [data-unsaved="true"]')) { notify('Lưu hoặc hủy thay đổi đang chỉnh trước khi chuyển mục.'); return; }
    setActive(key, postId ? { post: postId } : undefined);
  };
  const workflow = WORKFLOW.some(item => item.key === active);
  return <div className="marketing-root"><div className="shell"><Sidebar currentPath="marketing" onToast={notify} /><main className="main">
    <div className="page-head"><h1>Marketing</h1><p>Từ brief đúng đối tượng đến bài đã duyệt, lịch đăng và hội thoại với khách hàng.</p></div>
    <nav className="mw-main-nav" aria-label="Marketing">{TABS.map(item => <button key={item.key} type="button" aria-current={active === item.key ? 'page' : undefined} onClick={() => navigate(item.key)}>{item.label}</button>)}</nav>
    <div style={{ display: workflow ? 'block' : 'none' }}><MarketingWorkspace section={(workflow ? active : 'campaigns') as MarketingWorkflowSection} onNavigate={(section, postId) => navigate(section as MarketingTab, postId)} /></div>
    {!workflow && <div className="marketing-tab-content">
      {active === 'comments' && <FacebookCommentsTab key={params.get('post') || 'all'} initialPostId={params.get('post') ?? undefined} onToast={notify} />}
      {active === 'facebook-posts' && <FacebookPostsTab />}
    </div>}
  </main></div><Toast message={toast} /></div>;
}
