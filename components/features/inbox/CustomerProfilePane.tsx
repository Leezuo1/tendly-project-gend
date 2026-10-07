'use client';

import React from 'react';
import { CustomerProfile } from '@/lib/types/inbox';

interface CustomerProfilePaneProps {
  profile: CustomerProfile;
  onToast: (msg: string) => void;
}

export function CustomerProfilePane({ profile, onToast }: CustomerProfilePaneProps) {
  return (
    <div className="profile-pane">
      {/* Profile Head */}
      <div className="profile-head">
        <div className="profile-avatar">{profile.avatar}</div>
        <div className="profile-name">{profile.name}</div>
        <div className="profile-sub">{profile.since}</div>
        {profile.tags && profile.tags.length > 0 && (
          <div className="profile-tags">
            {profile.tags.map((tag, idx) => (
              <span key={idx} className={`tag tag-${tag.type}`}>
                {tag.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Profile Info */}
      <div className="profile-section">
        <div className="profile-section-title">Thông tin</div>
        <div className="profile-kv">
          <span className="k">Kênh chính</span>
          <span className="v">{profile.channel}</span>
        </div>
        <div className="profile-kv">
          <span className="k">Số đơn đã mua</span>
          <span className="v">{profile.orderCount}</span>
        </div>
        <div className="profile-kv">
          <span className="k">Khu vực giao hàng</span>
          <span className="v">{profile.shippingArea}</span>
        </div>
        {profile.totalSpent && (
          <div className="profile-kv">
            <span className="k">Tổng chi tiêu</span>
            <span className="v" style={{ color: 'var(--coral-deep)' }}>
              {profile.totalSpent}
            </span>
          </div>
        )}
      </div>

      {/* 360 Timeline */}
      <div className="profile-section">
        <div className="profile-section-title">Hồ sơ 360 — gần đây</div>
        <div className="timeline">
          {profile.timeline.map((item, index) => {
            const isLast = index === profile.timeline.length - 1;
            return (
              <div key={item.id} className="timeline-item">
                <div className="timeline-dot-wrap">
                  <div className="timeline-dot"></div>
                  {!isLast && <div className="timeline-line"></div>}
                </div>
                <div className="timeline-text">
                  {item.text}
                  <span className="t-time">{item.time}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action footer button */}
      <button
        type="button"
        className="btn btn-outline btn-sm"
        style={{ width: '100%', justifyContent: 'center' }}
        onClick={() => onToast(`Đang mở hồ sơ 360 chi tiết của khách hàng ${profile.name}`)}
      >
        Xem đầy đủ hồ sơ khách hàng
      </button>
    </div>
  );
}
