'use client';

import React, { useState } from 'react';
import { MarketingTab } from '@/lib/types/marketing';
import { Sidebar } from '@/components/features/dashboard/Sidebar';
import { MobileSections } from '@/components/ui/MobileSections';
import { ApprovalQueueTab } from './ApprovalQueueTab';
import { CustomerSegmentsTab } from './CustomerSegmentsTab';
import { CampaignPerformanceTab } from './CampaignPerformanceTab';
import { PostComposerTab } from './PostComposerTab';
import { FacebookCommentsTab } from './FacebookCommentsTab';
import { FacebookPostsTab } from './FacebookPostsTab';
import { Toast } from '@/components/shared/Toast';

const TABS: { key: MarketingTab; label: string }[] = [
  { key: 'facebook-posts', label: 'Bài đăng Facebook' },
  { key: 'comments', label: 'Bình luận Facebook' },
  { key: 'queue', label: 'Hàng chờ duyệt' },
  { key: 'segments', label: 'Khách hàng theo nhóm' },
  { key: 'performance', label: 'Hiệu suất chiến dịch' },
  { key: 'composer', label: 'Soạn bài AI' },
];

export function MarketingShell() {
  const [activeTab, setActiveTab] = useState<MarketingTab>('queue');
  const [sectionOpen, setSectionOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const showToast = (msg: string) => { setToastMessage(msg); setTimeout(() => setToastMessage(null), 3200); };
  const openTab = (key: MarketingTab) => { setActiveTab(key); setSectionOpen(true); };
  const content = {
    queue: <ApprovalQueueTab onToast={showToast} onCountChange={setQueueCount} />,
    segments: <CustomerSegmentsTab />,
    performance: <CampaignPerformanceTab />,
    composer: <PostComposerTab onToast={showToast} />,
    comments: <FacebookCommentsTab onToast={showToast} />,
    'facebook-posts': <FacebookPostsTab />,
  };
  return <div className="marketing-root"><div className="shell">
    <Sidebar currentPath="marketing" onToast={showToast} />
    <main className="main">
      <div className="page-head"><h1>Marketing</h1><p>Nhắn lại khách bằng tin AI soạn theo đúng hội thoại, xem nhóm khách và hiệu quả bài đăng — từ dữ liệu Messenger &amp; Fanpage thật.</p></div>
      <MobileSections title="Marketing" activeKey={sectionOpen ? activeTab : null} onBack={() => setSectionOpen(false)} onSelect={key => openTab(key as MarketingTab)} items={TABS.map(item => ({ ...item, content: <div className="marketing-tab-content">{content[item.key]}</div> }))}>
        <div className="tabs" id="marketing-subnav" aria-label="Các mục Marketing">
          {TABS.map(item => <button key={item.key} type="button" className={`tab-btn ${activeTab === item.key ? 'active' : ''} ${item.key === 'composer' ? 'marketing-ai-tab' : ''}`} onClick={() => openTab(item.key)}>{item.key === 'composer' ? '✨ ' : ''}{item.label}{item.key === 'queue' && queueCount !== null && <span className="marketing-tab-badge" aria-label={`${queueCount} khách chờ duyệt`}>{queueCount}</span>}</button>)}
        </div>
        <div className="marketing-tab-content"><div hidden={activeTab !== 'queue'}>{content.queue}</div>{activeTab !== 'queue' && content[activeTab]}</div>
      </MobileSections>
    </main>
  </div><Toast message={toastMessage} /></div>;
}
