'use client';

import React from 'react';
import { CustomerProfile } from '@/lib/types/inbox';
import type { AiMessageAnalysis } from '@/lib/types/ai';
import { EMOTION_LABELS } from '@/lib/services/inboxAi';
import { CustomerAvatar } from './CustomerAvatar';

interface CustomerProfilePaneProps {
  profile: CustomerProfile;
  analysis?: AiMessageAnalysis;
  aiStatus?: 'analyzing' | 'ready' | 'error';
  isUnreplied: boolean;
  personalitySummary?: string;
}

export function CustomerProfilePane({ profile, analysis, aiStatus, isUnreplied, personalitySummary }: CustomerProfilePaneProps) {
  return (
    <div className="profile-pane">
      {/* Profile Head */}
      <div className="profile-head">
        <CustomerAvatar className="profile-avatar" name={profile.name} initials={profile.avatar} url={profile.avatarUrl} />
        <div className="profile-name">{profile.name}</div>
        <div className="profile-sub">{profile.since}</div>
        {profile.identityStatus === 'pending' && <p className="emotion-analysis-note">Đang lấy tên và ảnh từ Messenger...</p>}
        {profile.identityStatus === 'unavailable' && <p className="emotion-analysis-note">Messenger chưa cung cấp tên và ảnh cho khách này. Hội thoại vẫn được đồng bộ.</p>}
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

      <div className="profile-section emotion-analysis" aria-label="Phân tích cảm xúc của AI">
        <div className="profile-section-title">Cảm xúc &amp; ưu tiên</div>
        <p className="emotion-summary-line" title={personalitySummary || 'Chưa đủ dữ liệu để suy luận'}>
          <strong>Tính cách (suy luận):</strong> {personalitySummary || 'Chưa đủ dữ liệu để suy luận'}
        </p>
        <p className="emotion-summary-line" role="status">
          <strong>Hiện tại:</strong> {aiStatus === 'analyzing' ? 'Đang phân tích…'
            : aiStatus === 'error' ? 'Chưa cập nhật cảm xúc'
            : analysis ? EMOTION_LABELS[analysis.emotion] : 'Chưa xác định'}
          {' · '}{!isUnreplied ? 'Đã trả lời' : analysis?.needsHuman ? 'Cần nhân viên' : analysis?.priority === 'high' ? 'Khẩn cấp' : 'Chờ trả lời'}
        </p>
      </div>

      {/* Profile Info */}
      <div className="profile-section">
        <div className="profile-section-title">Thông tin</div>
        <div className="profile-kv">
          <span className="k">Kênh chính</span>
          <span className="v">{profile.channel}</span>
        </div>
        {profile.messengerId && <div className="profile-kv">
          <span className="k">Messenger ID</span>
          <span className="v messenger-customer-id">{profile.messengerId}</span>
        </div>}
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

    </div>
  );
}
