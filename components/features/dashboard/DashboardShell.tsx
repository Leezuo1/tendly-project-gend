'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { DashboardTab } from '@/lib/types/dashboard';
import type { DashboardData } from '@/lib/types/dashboardData';
import { useShopOwnerName } from '@/lib/services/shopIdentity';
import { useInboxSession } from '@/lib/services/inboxCredentials';
import { Sidebar } from './Sidebar';
import { StatCards } from './StatCards';
import { EmailAutomationLog } from './EmailAutomationLog';
import { ReportAnalytics } from './ReportAnalytics';
import { CustomersPanel, OrdersPanel, useCrmOverview } from './CrmPanels';
import { Toast } from '@/components/shared/Toast';

const TABS: [DashboardTab, string][] = [['overview', 'Tổng quan'], ['orders', 'Đơn hàng'], ['customers', 'Khách hàng'], ['report', 'Báo cáo chi tiết']];

export function DashboardShell() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [range, setRange] = useState(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const { ready, error: sessionError } = useInboxSession();
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const ownerName = useShopOwnerName();
  // Đơn hàng/khách hàng chỉ tải khi mở tab; nút Làm mới tải lại cả hai.
  const crm = useCrmOverview(ready && (activeTab === 'orders' || activeTab === 'customers'), range, refresh);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    const poll = async () => {
      if (document.visibilityState === 'hidden') { timer = setTimeout(poll, 2000); return; }
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch('/api/dashboard', {
          cache: 'no-store', signal: controller.signal,
        });
        const result = await response.json();
        if (!cancelled) {
          if (!response.ok) throw new Error(result.error || 'Không tải được dashboard.');
          setData(result); setError(null);
        }
      } catch (error) {
        if (!cancelled) setError(error instanceof Error ? error.message : 'Không tải được dashboard.');
      } finally {
        clearTimeout(timeout);
        if (!cancelled) timer = setTimeout(poll, 2000);
      }
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); controller?.abort(); };
  }, [ready, refresh]);
  if (!ready) return <div className="dashboard-root"><div className="shell">
    <Sidebar currentPath="tong-quan" onToast={setError} />
    <main className="main"><p role="status">{sessionError || 'Đang kiểm tra cấu hình kết nối...'}</p></main>
  </div></div>;
  return <div className="dashboard-root"><div className="shell">
    <Sidebar currentPath="tong-quan" activeTab={activeTab} setActiveTab={setActiveTab} onToast={setError} />
    <main className="main">
      <div className="page-head">
        <div><h1>Xin chào{ownerName && <>, <span className="greet-name">{ownerName}</span></>}</h1><p>Đây là tình hình shop của bạn hôm nay.</p></div>
        <div className="head-actions">
          <button type="button" className="btn-refresh" onClick={() => setRefresh((n) => n + 1)}>Làm mới</button>
          <Link href="/pricing" className="btn btn-outline btn-sm">Nâng cấp gói</Link>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Nội dung tổng quan">
        {TABS.map(([tab, label]) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={'tab-btn ' + (activeTab === tab ? 'active' : '')} onClick={() => setActiveTab(tab)}>{label}</button>)}
      </div>
      {activeTab === 'overview' && <div className="tab-panel" id="tab-overview">
        <StatCards data={data} />
        <div className="grid-2"><div className="card">
          <div className="card-head"><h2>Tin nhắn khách gần đây</h2></div>
          {data?.recentMessages.map((message) => <Link href="/hop-thoai" key={message.id} className="urgent-row" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div className="urgent-info"><div className="urgent-name">{message.name}</div><div className="urgent-msg">{message.text}</div></div>
            <div className="urgent-time">{new Date(message.timestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</div>
          </Link>)}
          <Link href="/hop-thoai" className="card-foot-link">Xem hội thoại →</Link>
        </div><EmailAutomationLog /></div>
      </div>}
      {activeTab === 'orders' && <OrdersPanel data={crm.data} error={crm.error} range={range} onRange={setRange} />}
      {activeTab === 'customers' && <CustomersPanel data={crm.data} error={crm.error} range={range} onRange={setRange} />}
      {activeTab === 'report' && <ReportAnalytics data={data} />}
    </main>
  </div><Toast message={error} /></div>;
}
