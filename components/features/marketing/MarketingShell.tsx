'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTabParam } from '@/lib/hooks/useTabParam';
import type { MarketingTab } from '@/lib/types/marketing';
import { Sidebar } from '@/components/features/dashboard/Sidebar';
import { ApprovalQueueTab } from './ApprovalQueueTab';
import { CustomerSegmentsTab } from './CustomerSegmentsTab';
import { PostComposerTab } from './PostComposerTab';
import { FacebookCommentsTab } from './FacebookCommentsTab';
import { FacebookPostsTab } from './FacebookPostsTab';
import { MarketingWorkspace, type MarketingWorkflowSection } from './MarketingWorkspace';
import { Toast } from '@/components/shared/Toast';

const MAIN: { key: MarketingTab; label: string }[] = [{ key: 'campaigns', label: 'Chiến dịch' }, { key: 'composer', label: 'Soạn nội dung' }, { key: 'approvals', label: 'Duyệt nội dung' }, { key: 'schedule', label: 'Lịch đăng' }, { key: 'performance', label: 'Hiệu quả' }];
const TOOLS: { key: MarketingTab; label: string }[] = [{ key: 'profiles', label: 'Hồ sơ kênh' }, { key: 'facebook-posts', label: 'Bài Facebook' }, { key: 'comments', label: 'Bình luận & private reply' }, { key: 'queue', label: 'Duyệt tin remarketing' }, { key: 'segments', label: 'Nhóm khách' }, { key: 'legacy-composer', label: 'Bài viết trước đây' }];
const ALL = [...MAIN, ...TOOLS];
export function MarketingShell() {
  const [active, setActive] = useTabParam(ALL.map(item => item.key), 'campaigns');
  const params = useSearchParams();
  const [toast, setToast] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const notify = (message: string) => { setToast(message); setTimeout(() => setToast(null), 3200); };
  const navigate = (key: MarketingTab, postId?: string) => {
    if (document.querySelector('.mw-root [data-unsaved="true"]')) { notify('Lưu hoặc hủy thay đổi đang chỉnh trước khi chuyển mục.'); return; }
    setActive(key, postId ? { post: postId } : undefined);
  };
  const workflow = MAIN.some(item => item.key === active) || active === 'profiles';
  return <div className="marketing-root"><div className="shell"><Sidebar currentPath="marketing" onToast={notify} /><main className="main">
    <div className="page-head"><h1>Marketing</h1><p>Từ brief đúng đối tượng đến bài đã duyệt, lịch đăng và hội thoại với khách hàng.</p></div>
    <nav className="mw-main-nav" aria-label="Marketing">{MAIN.map(item => <button key={item.key} type="button" aria-current={active === item.key ? 'page' : undefined} onClick={() => navigate(item.key)}>{item.label}</button>)}</nav>
    <details className="mw-tool-nav" open={active === 'profiles' || !workflow}><summary>Hồ sơ kênh, Fanpage & chăm sóc khách</summary><nav aria-label="Công cụ Marketing">{TOOLS.map(item => <button type="button" key={item.key} aria-current={active === item.key ? 'page' : undefined} onClick={() => navigate(item.key)}>{item.label}{item.key === 'queue' && queueCount !== null ? ` · ${queueCount}` : ''}</button>)}</nav></details>
    <div style={{ display: workflow ? 'block' : 'none' }}><MarketingWorkspace section={(workflow ? active : 'campaigns') as MarketingWorkflowSection} onNavigate={(section, postId) => navigate(section as MarketingTab, postId)} /></div>
    <div className="marketing-tab-content" style={{ display: workflow ? 'none' : 'block' }}>
      <div style={{ display: active === 'queue' ? 'block' : 'none' }}><ApprovalQueueTab onToast={notify} onCountChange={setQueueCount} /></div>
      {active === 'segments' && <CustomerSegmentsTab />}
      {active === 'comments' && <FacebookCommentsTab key={params.get('post') || 'all'} initialPostId={params.get('post') ?? undefined} onToast={notify} />}
      {active === 'facebook-posts' && <FacebookPostsTab />}
      {active === 'legacy-composer' && <PostComposerTab archiveOnly onToast={notify} />}
    </div>
  </main></div><Toast message={toast} /></div>;
}
