'use client';

import React, { useState } from 'react';
import { MarketingTab } from '@/lib/types/marketing';
import { Sidebar } from '@/components/features/dashboard/Sidebar';
import { ApprovalQueueTab } from './ApprovalQueueTab';
import { CustomerSegmentsTab } from './CustomerSegmentsTab';
import { CampaignPerformanceTab } from './CampaignPerformanceTab';
import { PostComposerTab } from './PostComposerTab';
import { Toast } from '@/components/shared/Toast';

export function MarketingShell() {
  const [activeTab, setActiveTab] = useState<MarketingTab>('queue');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
            <p>Duyệt nội dung remarketing do AI đề xuất và theo dõi hiệu suất so với cách làm cũ.</p>
          </div>

          <div className="tabs">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
              onClick={() => setActiveTab('queue')}
            >
              Hàng chờ duyệt
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
              className={`tab-btn ${activeTab === 'composer' ? 'active' : ''}`}
              onClick={() => setActiveTab('composer')}
            >
              ✨ Soạn bài AI
            </button>
          </div>

          {activeTab === 'queue' && <ApprovalQueueTab onToast={showToast} />}
          {activeTab === 'segments' && <CustomerSegmentsTab />}
          {activeTab === 'performance' && <CampaignPerformanceTab />}
          {activeTab === 'composer' && <PostComposerTab onToast={showToast} />}
        </main>
      </div>

      <Toast message={toastMessage} />
    </div>
  );
}
