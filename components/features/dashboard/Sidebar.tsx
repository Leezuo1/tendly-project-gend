'use client';

import React from 'react';
import Link from 'next/link';
import { DashboardTab } from '@/lib/types/dashboard';

interface SidebarProps {
  currentPath?: 'tong-quan' | 'marketing' | 'hop-thoai' | 'cau-hinh-ai' | 'cai-dat';
  activeTab?: DashboardTab;
  setActiveTab?: (tab: DashboardTab) => void;
  onToast: (msg: string) => void;
}

export function Sidebar({
  currentPath = 'tong-quan',
  activeTab,
  setActiveTab,
  onToast,
}: SidebarProps) {
  const isTongQuan = currentPath === 'tong-quan';
  const isMarketing = currentPath === 'marketing';
  const isHopThoai = currentPath === 'hop-thoai';

  return (
    <aside className="sidebar">
      <div className="brand">
        <Link href="/" title="Trang chủ Tendly">
          <img src="/tendly-logo.png" alt="Tendly" />
        </Link>
      </div>

      <div className="nav-group">
        {/* Tổng quan */}
        {isTongQuan ? (
          <button
            type="button"
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab && setActiveTab('overview')}
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="9" rx="1.5"></rect>
              <rect x="14" y="3" width="7" height="5" rx="1.5"></rect>
              <rect x="14" y="12" width="7" height="9" rx="1.5"></rect>
              <rect x="3" y="16" width="7" height="5" rx="1.5"></rect>
            </svg>
            <span>Tổng quan</span>
          </button>
        ) : (
          <Link href="/tong-quan" className="nav-item">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="9" rx="1.5"></rect>
              <rect x="14" y="3" width="7" height="5" rx="1.5"></rect>
              <rect x="14" y="12" width="7" height="9" rx="1.5"></rect>
              <rect x="3" y="16" width="7" height="5" rx="1.5"></rect>
            </svg>
            <span>Tổng quan</span>
          </Link>
        )}

        {/* Hộp thoại */}
        <Link
          href="/hop-thoai"
          className={`nav-item ${isHopThoai ? 'active' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          <span>Hộp thoại</span>
          <span className="nav-badge">12</span>
        </Link>

        {/* Marketing */}
        <Link
          href="/marketing"
          className={`nav-item ${isMarketing ? 'active' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1z"></path>
            <path d="M15 8a4 4 0 0 1 0 8"></path>
            <path d="M18 5a8 8 0 0 1 0 14"></path>
          </svg>
          <span>Marketing</span>
        </Link>

        {/* Cấu hình AI */}
        <button
          type="button"
          className="nav-item"
          onClick={() => onToast('Mở màn hình Cấu hình AI Tendly')}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"></path>
            <circle cx="12" cy="12" r="3.5"></circle>
          </svg>
          <span>Cấu hình AI</span>
        </button>

        {/* Cài đặt */}
        <button
          type="button"
          className="nav-item"
          onClick={() => onToast('Mở màn hình Cài đặt cửa hàng & kênh')}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>Cài đặt</span>
        </button>
      </div>

      <div className="sidebar-foot">
        <div className="avatar-sm">TD</div>
        <div className="who">
          <div className="name">Tendly</div>
          <div className="role">Chủ shop</div>
        </div>

        <Link
          href="/"
          className="logout-btn"
          title="Đăng xuất"
          onClick={() => onToast && onToast('Đã đăng xuất')}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </Link>
      </div>
    </aside>
  );
}
