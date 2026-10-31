'use client';

import React, { useState } from 'react';
import { MarketingTab } from '@/lib/types/marketing';
import { Sidebar } from '@/components/features/dashboard/Sidebar';
import { ApprovalQueueTab } from './ApprovalQueueTab';
import { CustomerSegmentsTab } from './CustomerSegmentsTab';
import { CampaignPerformanceTab } from './CampaignPerformanceTab';
import { PostComposerTab } from './PostComposerTab';
import { FacebookCommentsTab } from './FacebookCommentsTab';
import { FacebookPostsTab } from './FacebookPostsTab';
import { Toast } from '@/components/shared/Toast';
import type { FacebookFeedPost } from '@/lib/types/facebookFeed';
import { IconChevrons } from '@/components/ui/Icons';

export function MarketingShell() {
  const [activeTab, setActiveTab] = useState<MarketingTab>('queue');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [sourcePost, setSourcePost] = useState<FacebookFeedPost>();
  const [tabsCollapsed, setTabsCollapsed] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  return (
    <div className="marketing-root">
      <div className="shell">
        <Sidebar currentPath="marketing" onToast={showToast} />

        <main className="main">
          <div className="page-head">
            <h1>Marketing</h1>
            <p>Nhắn lại khách bằng tin AI soạn theo đúng hội thoại, xem nhóm khách và hiệu quả bài đăng — từ dữ liệu Messenger &amp; Fanpage thật.</p>
          </div>

          <div className="marketing-workspace" data-tabs-collapsed={tabsCollapsed}>
          <div className="marketing-subnav">
          <button type="button" className="marketing-subnav-toggle" aria-label={tabsCollapsed ? 'Hiện mục Marketing' : 'Ẩn mục Marketing'} title={tabsCollapsed ? 'Hiện mục Marketing' : 'Ẩn mục Marketing'} aria-expanded={!tabsCollapsed} aria-controls="marketing-subnav" onClick={() => setTabsCollapsed(value => !value)}><IconChevrons style={{ transform: `rotate(${tabsCollapsed ? 0 : 180}deg)` }} /></button>
          <div className="tabs" id="marketing-subnav" aria-label="Các mục Marketing">
            <button type="button" className={`tab-btn ${activeTab === 'facebook-posts' ? 'active' : ''}`} onClick={() => setActiveTab('facebook-posts')}>
              Bài đăng Facebook
            </button>
            <button type="button" className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`} onClick={() => setActiveTab('comments')}>
              Bình luận Facebook
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
              onClick={() => setActiveTab('queue')}
            >
              Hàng chờ duyệt {queueCount !== null && <span className="marketing-tab-badge" aria-label={`${queueCount} khách chờ duyệt`}>{queueCount}</span>}
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'segments' ? 'active' : ''}`}
              onClick={() => setActiveTab('segments')}
            >
              Khách hàng theo nhóm
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'performance' ? 'active' : ''}`}
              onClick={() => setActiveTab('performance')}
            >
              Hiệu suất chiến dịch
            </button>
            <button
              type="button"
              className={`tab-btn marketing-ai-tab ${activeTab === 'composer' ? 'active' : ''}`}
              onClick={() => { setSourcePost(undefined); setActiveTab('composer'); }}
            >
              ✨ Soạn bài AI
            </button>
          </div>

          </div>
          <div className="marketing-tab-content">
          <div hidden={activeTab !== 'queue'}><ApprovalQueueTab onToast={showToast} onCountChange={setQueueCount} /></div>
          {activeTab === 'segments' && <CustomerSegmentsTab />}
          {activeTab === 'performance' && <CampaignPerformanceTab />}
          {activeTab === 'composer' && <PostComposerTab onToast={showToast} sourcePost={sourcePost} />}
          {activeTab === 'comments' && <FacebookCommentsTab onToast={showToast} />}
          {activeTab === 'facebook-posts' && <FacebookPostsTab onCompose={(post) => { setSourcePost(post); setActiveTab('composer'); }} />}
          </div>
          </div>
        </main>
      </div>

      <Toast message={toastMessage} />
    </div>
  );
}
