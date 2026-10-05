'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import './tong-quan.css';

interface UrgentItem {
  id: string;
  initials: string;
  name: string;
  tag: string;
  msg: string;
  time: string;
  channel: string;
  suggestedReply: string;
}

const initialUrgentItems: UrgentItem[] = [
  {
    id: 'u1',
    initials: 'PT',
    name: 'Phương T.',
    tag: 'Cảm xúc âm',
    msg: '"Đơn của em bị giao sai màu rồi, đây là lần thứ 2 luôn á..."',
    time: '6 phút',
    channel: 'Messenger (Facebook)',
    suggestedReply:
      'Dạ Tendly thay mặt shop chân thành xin lỗi chị Phương ạ! Shop sẽ gửi hoả tốc sản phẩm đúng màu và tặng kèm voucher 50k cho chị ngay trong chiều nay nhé ạ.',
  },
  {
    id: 'u2',
    initials: 'VH',
    name: 'Việt H.',
    tag: 'Cảm xúc âm',
    msg: '"Ship gì mà 5 ngày chưa tới, shop trả lời giúp em với"',
    time: '19 phút',
    channel: 'Zalo OA',
    suggestedReply:
      'Chào anh Việt, bên em vừa tra cứu mã vận đơn đơn hàng #TD-8821. Hiện kiện hàng đang tại bưu cục phát quận mình và sẽ giao trước 17h hôm nay ạ!',
  },
];

export default function TongQuanPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'report'>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [urgentItems, setUrgentItems] = useState<UrgentItem[]>(initialUrgentItems);
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
        {/* ========== SIDEBAR ========== */}
        <aside className="sidebar">
          <div className="brand">
            <Link href="/" title="Trang chủ Tendly">
              <img src="/tendly-logo.png" alt="Tendly" />
            </Link>
          </div>

          <nav className="nav-group">
            <button
              type="button"
              className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" rx="1.5"></rect>
                <rect x="14" y="3" width="7" height="5" rx="1.5"></rect>
                <rect x="14" y="12" width="7" height="9" rx="1.5"></rect>
                <rect x="3" y="16" width="7" height="5" rx="1.5"></rect>
              </svg>
              <span>Tổng quan</span>
            </button>

            <button
              type="button"
              className="nav-item"
              onClick={() => {
                setActiveTab('overview');
                showToast('Chuyển đến màn hình Hộp thoại thông minh (12 tin chờ)');
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
              <span>Hộp thoại</span>
              <span className="nav-badge">12</span>
            </button>

            <button
              type="button"
              className="nav-item"
              onClick={() => {
                setActiveTab('report');
                showToast('Chuyển tới Báo cáo chiến dịch Marketing');
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1z"></path>
                <path d="M15 8a4 4 0 0 1 0 8"></path>
                <path d="M18 5a8 8 0 0 1 0 14"></path>
              </svg>
              <span>Marketing</span>
            </button>

            <button
              type="button"
              className="nav-item"
              onClick={() => showToast('Mở màn hình Cấu hình AI Tendly')}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"></path>
                <circle cx="12" cy="12" r="3.5"></circle>
              </svg>
              <span>Cấu hình AI</span>
            </button>

            <button
              type="button"
              className="nav-item"
              onClick={() => showToast('Mở màn hình Cài đặt cửa hàng & kênh')}
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              <span>Cài đặt</span>
            </button>
          </nav>

          <div className="sidebar-foot">
            <Link href="/" className="back-home-link">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              <span>Về trang chủ Tendly</span>
            </Link>

            <div className="user-profile">
              <div className="avatar-sm">TD</div>
              <div className="who">
                <div className="name">Tendly</div>
                <div className="role">
                  <span className="role-dot"></span>
                  Chủ shop • Đang hoạt động
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ========== MAIN ========== */}
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

          {/* ===== TAB 1: Tổng quan ===== */}
          {activeTab === 'overview' && (
            <div className="tab-panel" id="tab-overview">
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="label">Hội thoại đang chờ</div>
                  <div className="value">12</div>
                  <div className="sub">Trên 2 kênh: Messenger, Zalo OA</div>
                </div>

                <div className="stat-card alert">
                  <div className="label">
                    <span className="pulse-dot"></span> Cần xử lý gấp
                  </div>
                  <div className="value">{urgentItems.length}</div>
                  <div className="sub">
                    {urgentItems.length > 0
                      ? 'Khách đang bực, chưa được xử lý'
                      : 'Tuyệt vời! Tất cả đã được xử lý'}
                  </div>
                </div>

                <div className="stat-card">
                  <div className="label">Email tự động hôm nay</div>
                  <div className="value">18</div>
                  <div className="sub">Đã gửi qua 3 kịch bản</div>
                </div>

                <div className="stat-card">
                  <div className="label">Đơn ước tính qua chat hôm nay</div>
                  <div className="value">7</div>
                  <div className="sub">*ước tính từ tín hiệu hội thoại</div>
                </div>
              </div>

              <div className="grid-2">
                {/* Cần xử lý gấp */}
                <div className="card">
                  <div className="card-head">
                    <h2>Cần xử lý gấp</h2>
                    <span className="hint">{urgentItems.length} hội thoại</span>
                  </div>

                  {urgentItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--ink-soft)' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                      <div style={{ fontWeight: 700, color: 'var(--ink)' }}>Không còn hội thoại gấp!</div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        Các khách hàng có cảm xúc âm đều đã được phản hồi kịp thời.
                      </div>
                    </div>
                  ) : (
                    urgentItems.map((item) => (
                      <div key={item.id} className="urgent-row">
                        <div className="avatar">{item.initials}</div>
                        <div className="urgent-info">
                          <div className="urgent-name-row">
                            <span className="urgent-name">{item.name}</span>
                            <span className="tag tag-high">{item.tag}</span>
                          </div>
                          <div className="urgent-msg">{item.msg}</div>
                        </div>
                        <div className="urgent-time">{item.time}</div>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => openUrgentModal(item)}
                        >
                          Xử lý
                        </button>
                      </div>
                    ))
                  )}

                  <button
                    type="button"
                    className="card-foot-link"
                    style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer' }}
                    onClick={() => showToast('Mở danh sách 12 hội thoại đang chờ')}
                  >
                    Xem tất cả hội thoại đang chờ →
                  </button>
                </div>

                {/* Email tự động hôm nay */}
                <div className="card">
                  <div className="card-head">
                    <h2>Email tự động hôm nay</h2>
                  </div>

                  <div className="log-row">
                    <div className="log-icon">KD</div>
                    <div className="log-name">Khánh D.</div>
                    <div className="log-trigger">Hỏi chưa chốt đơn</div>
                    <div className="log-status">
                      <span className="dot"></span>Đã gửi
                    </div>
                  </div>

                  <div className="log-row">
                    <div className="log-icon">HM</div>
                    <div className="log-name">Hoài M.</div>
                    <div className="log-trigger">Bỏ giỏ hàng</div>
                    <div className="log-status">
                      <span className="dot"></span>Đã mở
                    </div>
                  </div>

                  <div className="log-row">
                    <div className="log-icon">NT</div>
                    <div className="log-name">Ngọc T.</div>
                    <div className="log-trigger">Hỏi chưa chốt đơn</div>
                    <div className="log-status">
                      <span className="dot"></span>Đã gửi
                    </div>
                  </div>

                  <button
                    type="button"
                    className="card-foot-link"
                    style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer' }}
                    onClick={() => showToast('Mở toàn bộ 18 nhật ký email automation')}
                  >
                    Xem toàn bộ nhật ký →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===== TAB 2: Báo cáo chi tiết ===== */}
          {activeTab === 'report' && (
            <div className="tab-panel" id="tab-report">
              <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="label">Tỷ lệ phản hồi sau email cá nhân hoá</div>
                  <div className="value">8,4%</div>
                  <div className="trend up">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 17 17 7"></path>
                      <path d="M7 7h10v10"></path>
                    </svg>
                    +2,1% <span className="trend-note">so với tuần trước</span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="label">Thời gian phản hồi trung bình</div>
                  <div className="value">2p40s</div>
                  <div className="trend down-good">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 7 17 17"></path>
                      <path d="M17 7v10H7"></path>
                    </svg>
                    18% nhanh hơn <span className="trend-note">tuần trước</span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="label">Số hội thoại cảm xúc âm đã xử lý</div>
                  <div className="value">34</div>
                  <div className="trend up">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 17 17 7"></path>
                      <path d="M7 7h10v10"></path>
                    </svg>
                    +12% <span className="trend-note">so với tuần trước</span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="label">Tỷ lệ mở email</div>
                  <div className="value">61%</div>
                  <div className="trend down-bad">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 7 17 17"></path>
                      <path d="M17 7v10H7"></path>
                    </svg>
                    -3% <span className="trend-note">so với tuần trước</span>
                  </div>
                </div>
              </div>

              <div className="grid-2">
                {/* Line Chart 1 */}
                <div className="card">
                  <div className="card-head">
                    <h2>Tỷ lệ phản hồi sau email theo ngày</h2>
                    <span className="hint">%</span>
                  </div>
                  <svg viewBox="0 0 600 170" width="100%" height="170" role="img" aria-label="Biểu đồ tỷ lệ phản hồi sau email theo ngày trong tuần">
                    <line x1="20" y1="20" x2="580" y2="20" stroke="#E7DED7" strokeWidth="1"></line>
                    <line x1="20" y1="70" x2="580" y2="70" stroke="#E7DED7" strokeWidth="1"></line>
                    <line x1="20" y1="120" x2="580" y2="120" stroke="#E7DED7" strokeWidth="1"></line>
                    <defs>
                      <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F06A6A" stopOpacity="0.18"></stop>
                        <stop offset="100%" stopColor="#F06A6A" stopOpacity="0"></stop>
                      </linearGradient>
                    </defs>
                    <path d="M20,115 L113,95 L207,100 L300,72 L393,48 L487,30 L580,60 L580,130 L20,130 Z" fill="url(#convGrad)"></path>
                    <polyline points="20,115 113,95 207,100 300,72 393,48 487,30 580,60" fill="none" stroke="#F06A6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"></polyline>
                    <circle cx="20" cy="115" r="3.5" fill="white" stroke="#F06A6A" strokeWidth="2"></circle>
                    <circle cx="113" cy="95" r="3.5" fill="white" stroke="#F06A6A" strokeWidth="2"></circle>
                    <circle cx="207" cy="100" r="3.5" fill="white" stroke="#F06A6A" strokeWidth="2"></circle>
                    <circle cx="300" cy="72" r="3.5" fill="white" stroke="#F06A6A" strokeWidth="2"></circle>
                    <circle cx="393" cy="48" r="3.5" fill="white" stroke="#F06A6A" strokeWidth="2"></circle>
                    <circle cx="487" cy="30" r="3.5" fill="white" stroke="#F06A6A" strokeWidth="2"></circle>
                    <circle cx="580" cy="60" r="5" fill="#F06A6A" stroke="white" strokeWidth="2"></circle>
                    <text x="578" y="45" textAnchor="end" fontSize="12" fontWeight="700" fill="#D8514F" fontFamily="Inter, sans-serif">8,4%</text>
                    <text x="20" y="150" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T2</text>
                    <text x="113" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T3</text>
                    <text x="207" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T4</text>
                    <text x="300" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T5</text>
                    <text x="393" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T6</text>
                    <text x="487" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T7</text>
                    <text x="578" y="150" textAnchor="end" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">CN</text>
                  </svg>
                </div>

                {/* Line Chart 2 */}
                <div className="card">
                  <div className="card-head">
                    <h2>Thời gian phản hồi theo ngày</h2>
                    <span className="hint">phút</span>
                  </div>
                  <svg viewBox="0 0 600 170" width="100%" height="170" role="img" aria-label="Biểu đồ thời gian phản hồi trung bình theo ngày trong tuần">
                    <line x1="20" y1="20" x2="580" y2="20" stroke="#E7DED7" strokeWidth="1"></line>
                    <line x1="20" y1="70" x2="580" y2="70" stroke="#E7DED7" strokeWidth="1"></line>
                    <line x1="20" y1="120" x2="580" y2="120" stroke="#E7DED7" strokeWidth="1"></line>
                    <defs>
                      <linearGradient id="respGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4B6358" stopOpacity="0.18"></stop>
                        <stop offset="100%" stopColor="#4B6358" stopOpacity="0"></stop>
                      </linearGradient>
                    </defs>
                    <path d="M20,20 L113,50 L207,30 L300,70 L393,90 L487,120 L580,103 L580,130 L20,130 Z" fill="url(#respGrad)"></path>
                    <polyline points="20,20 113,50 207,30 300,70 393,90 487,120 580,103" fill="none" stroke="#4B6358" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"></polyline>
                    <circle cx="20" cy="20" r="3.5" fill="white" stroke="#4B6358" strokeWidth="2"></circle>
                    <circle cx="113" cy="50" r="3.5" fill="white" stroke="#4B6358" strokeWidth="2"></circle>
                    <circle cx="207" cy="30" r="3.5" fill="white" stroke="#4B6358" strokeWidth="2"></circle>
                    <circle cx="300" cy="70" r="3.5" fill="white" stroke="#4B6358" strokeWidth="2"></circle>
                    <circle cx="393" cy="90" r="3.5" fill="white" stroke="#4B6358" strokeWidth="2"></circle>
                    <circle cx="487" cy="120" r="3.5" fill="white" stroke="#4B6358" strokeWidth="2"></circle>
                    <circle cx="580" cy="103" r="5" fill="#4B6358" stroke="white" strokeWidth="2"></circle>
                    <text x="578" y="88" textAnchor="end" fontSize="12" fontWeight="700" fill="#4B6358" fontFamily="Inter, sans-serif">2p40s</text>
                    <text x="20" y="150" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T2</text>
                    <text x="113" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T3</text>
                    <text x="207" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T4</text>
                    <text x="300" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T5</text>
                    <text x="393" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T6</text>
                    <text x="487" y="150" textAnchor="middle" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">T7</text>
                    <text x="578" y="150" textAnchor="end" fontSize="11" fill="#6B5F5A" fontFamily="Inter, sans-serif">CN</text>
                  </svg>
                </div>
              </div>

              {/* Table of Top Products */}
              <div className="card">
                <div className="card-head">
                  <h2>Sản phẩm được hỏi nhiều nhất</h2>
                  <span className="hint">7 ngày gần nhất • *ước tính từ tín hiệu hội thoại</span>
                </div>
                <div className="table-wrap">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Sản phẩm</th>
                        <th style={{ textAlign: 'right' }}>Hỏi trong chat</th>
                        <th style={{ textAlign: 'right' }}>Có dấu hiệu chốt đơn</th>
                        <th style={{ textAlign: 'right' }}>Tỷ lệ có dấu hiệu chốt</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <div className="table-prod-name">
                            <div className="table-prod-icon">👕</div>
                            <div>
                              <div>Áo thun basic cotton Tendly</div>
                              <div className="table-prod-sku">SKU: AT-01</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>142</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>38</td>
                        <td style={{ textAlign: 'right' }}><span className="rate-badge">26,8%</span></td>
                      </tr>
                      <tr>
                        <td>
                          <div className="table-prod-name">
                            <div className="table-prod-icon">🧥</div>
                            <div>
                              <div>Áo khoác dạ nữ dáng dài AK-23</div>
                              <div className="table-prod-sku">SKU: AK-23</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>96</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>29</td>
                        <td style={{ textAlign: 'right' }}><span className="rate-badge">30,2%</span></td>
                      </tr>
                      <tr>
                        <td>
                          <div className="table-prod-name">
                            <div className="table-prod-icon">👗</div>
                            <div>
                              <div>Đầm voan hoa nhí cổ V vintage</div>
                              <div className="table-prod-sku">SKU: DV-12</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>84</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>21</td>
                        <td style={{ textAlign: 'right' }}><span className="rate-badge">25,0%</span></td>
                      </tr>
                      <tr>
                        <td>
                          <div className="table-prod-name">
                            <div className="table-prod-icon">👖</div>
                            <div>
                              <div>Quần jeans ống suông lưng cao QJ-88</div>
                              <div className="table-prod-sku">SKU: QJ-88</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>75</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>18</td>
                        <td style={{ textAlign: 'right' }}><span className="rate-badge">24,0%</span></td>
                      </tr>
                      <tr>
                        <td>
                          <div className="table-prod-name">
                            <div className="table-prod-icon">👚</div>
                            <div>
                              <div>Chân váy chữ A kaki túi hộp CV-05</div>
                              <div className="table-prod-sku">SKU: CV-05</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>52</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>11</td>
                        <td style={{ textAlign: 'right' }}><span className="rate-badge">21,2%</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="card">
                <div className="card-head">
                  <h2>Hội thoại theo ngày trong tuần</h2>
                  <span className="hint">7 ngày gần nhất</span>
                </div>
                <div className="bar-chart">
                  <div className="bar-col">
                    <span className="bar-val">32</span>
                    <div className="bar" style={{ height: '56%' }} title="Thứ 2: 32 hội thoại"></div>
                    <span className="bar-day">T2</span>
                  </div>
                  <div className="bar-col">
                    <span className="bar-val">41</span>
                    <div className="bar" style={{ height: '71%' }} title="Thứ 3: 41 hội thoại"></div>
                    <span className="bar-day">T3</span>
                  </div>
                  <div className="bar-col">
                    <span className="bar-val">38</span>
                    <div className="bar" style={{ height: '65%' }} title="Thứ 4: 38 hội thoại"></div>
                    <span className="bar-day">T4</span>
                  </div>
                  <div className="bar-col">
                    <span className="bar-val">52</span>
                    <div className="bar" style={{ height: '87%' }} title="Thứ 5: 52 hội thoại"></div>
                    <span className="bar-day">T5</span>
                  </div>
                  <div className="bar-col">
                    <span className="bar-val">61</span>
                    <div className="bar" style={{ height: '97%' }} title="Thứ 6: 61 hội thoại"></div>
                    <span className="bar-day">T6</span>
                  </div>
                  <div className="bar-col peak">
                    <span className="bar-val">74</span>
                    <div className="bar" style={{ height: '100%' }} title="Thứ 7: 74 hội thoại (Cao điểm)"></div>
                    <span className="bar-day">T7</span>
                  </div>
                  <div className="bar-col">
                    <span className="bar-val">45</span>
                    <div className="bar" style={{ height: '78%' }} title="Chủ Nhật: 45 hội thoại"></div>
                    <span className="bar-day">CN</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========== INTERACTIVE MODAL FOR URGENT ACTIONS ========== */}
      {activeModalItem && (
        <div className="modal-overlay" onClick={() => setActiveModalItem(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Xử lý hội thoại khẩn cấp</h3>
                <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                  Kênh: {activeModalItem.channel} • Chờ {activeModalItem.time}
                </span>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setActiveModalItem(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="customer-detail-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <strong>{activeModalItem.name}</strong>
                  <span className="tag tag-high">{activeModalItem.tag}</span>
                </div>
                <div style={{ color: 'var(--ink)', fontStyle: 'italic' }}>
                  {activeModalItem.msg}
                </div>
              </div>

              <div className="ai-suggestion-box">
                <div className="ai-suggestion-head">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"></path>
                    <circle cx="12" cy="12" r="3.5"></circle>
                  </svg>
                  Gợi ý phản hồi từ Tendly AI:
                </div>
                <textarea
                  value={customReply}
                  onChange={(e) => setCustomReply(e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 13.5,
                    fontFamily: 'inherit',
                    color: 'var(--ink)',
                    background: 'white',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => handleResolveUrgent(activeModalItem.id, 'Đã chuyển nhân viên')}
              >
                Chuyển nhân viên
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleResolveUrgent(activeModalItem.id, 'Đã gửi phản hồi AI')}
              >
                Gửi phản hồi ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== TOAST NOTIFICATION ========== */}
      {toastMessage && (
        <div className="toast">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#48BB78" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
