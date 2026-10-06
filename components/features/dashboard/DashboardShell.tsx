'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { DashboardTab, UrgentItem } from '@/lib/types/dashboard';
import { INITIAL_URGENT_ITEMS } from '@/lib/data/dashboard';
import { Sidebar } from './Sidebar';
import { StatCards } from './StatCards';
import { UrgentQueue } from './UrgentQueue';
import { EmailAutomationLog } from './EmailAutomationLog';
import { ReportAnalytics } from './ReportAnalytics';
import { ReplyModal } from './ReplyModal';
import { Toast } from '@/components/shared/Toast';

interface DashboardShellProps {
  initialItems?: UrgentItem[];
}

export function DashboardShell({ initialItems = INITIAL_URGENT_ITEMS }: DashboardShellProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [urgentItems, setUrgentItems] = useState<UrgentItem[]>(initialItems);
  const [activeModalItem, setActiveModalItem] = useState<UrgentItem | null>(null);
  const [customReply, setCustomReply] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('Đã làm mới dữ liệu hệ thống lúc ' + new Date().toLocaleTimeString('vi-VN'));
    }, 700);
  };

  const openUrgentModal = (item: UrgentItem) => {
    setActiveModalItem(item);
    setCustomReply(item.suggestedReply);
  };

  const handleResolveUrgent = (itemId: string, actionName: string) => {
    setUrgentItems((prev) => prev.filter((item) => item.id !== itemId));
    setActiveModalItem(null);
    showToast(`${actionName} cho khách hàng thành công!`);
  };

  return (
    <div className="dashboard-root">
      <div className="shell">
        <Sidebar currentPath="tong-quan" activeTab={activeTab} setActiveTab={setActiveTab} onToast={showToast} />

        <main className="main">
          <div className="page-head">
            <div>
              <h1>
                Chào buổi sáng, <span className="greet-name">Thảo</span>
              </h1>
              <p>Đây là tình hình shop của bạn hôm nay, 15 tháng 9.</p>
            </div>

            <div className="head-actions">
              <button
                type="button"
                className="btn-refresh"
                onClick={handleRefresh}
                title="Làm mới dữ liệu"
              >
                <svg
                  className={isRefreshing ? 'spinning' : ''}
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 21h5v-5" />
                </svg>
                <span>{isRefreshing ? 'Đang tải...' : 'Làm mới'}</span>
              </button>

              <Link href="/pricing" className="btn btn-outline btn-sm">
                Nâng cấp gói
              </Link>
            </div>
          </div>

          <div className="tabs">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Tổng quan
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`}
              onClick={() => setActiveTab('report')}
            >
              Báo cáo chi tiết
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="tab-panel" id="tab-overview">
              <StatCards urgentCount={urgentItems.length} />

              <div className="grid-2">
                <UrgentQueue
                  urgentItems={urgentItems}
                  onOpenModal={openUrgentModal}
                  onToast={showToast}
                />

                <EmailAutomationLog onToast={showToast} />
              </div>
            </div>
          )}

          {activeTab === 'report' && <ReportAnalytics />}
        </main>
      </div>

      <ReplyModal
        item={activeModalItem}
        customReply={customReply}
        setCustomReply={setCustomReply}
        onClose={() => setActiveModalItem(null)}
        onResolve={handleResolveUrgent}
      />

      <Toast message={toastMessage} />
    </div>
  );
}
