'use client';

import React from 'react';
import { CustomerProfile } from '@/lib/types/inbox';
import type { AiMessageAnalysis } from '@/lib/types/ai';
import { EMOTION_LABELS, PRIORITY_LABELS } from '@/lib/services/inboxAi';
import { CustomerAvatar } from './CustomerAvatar';
import type { ConversationMemoryEntry } from '@/lib/types/conversationMemory';

interface CustomerProfilePaneProps {
  profile: CustomerProfile;
  analysis?: AiMessageAnalysis;
  aiStatus?: 'analyzing' | 'ready' | 'error';
  isUnreplied: boolean;
  memory?: ConversationMemoryEntry[];
}

export function CustomerProfilePane({ profile, analysis, aiStatus, isUnreplied, memory = [] }: CustomerProfilePaneProps) {
  const emotions = Object.entries(memory.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.analysis.emotion] = (counts[entry.analysis.emotion] || 0) + 1;
    return counts;
  }, {}));
  const styles = [...new Set([...memory].reverse().map((entry) => entry.analysis.communicationStyle).filter(Boolean))].slice(0, 5);
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
        {aiStatus === 'analyzing' ? (
          <p className="emotion-analysis-note" role="status">Đang phân tích tin nhắn mới...</p>
        ) : analysis ? (
          <>
            <div className="emotion-analysis-tags">
              <span className={`tag tag-${analysis.sentiment === 'negative' ? 'high' : analysis.sentiment === 'positive' ? 'positive' : 'neutral'}`}>
                {EMOTION_LABELS[analysis.emotion]}
              </span>
              <span className={`tag tag-${isUnreplied && analysis.priority === 'high' ? 'high' : 'neutral'}`}>
                {isUnreplied ? PRIORITY_LABELS[analysis.priority] : 'Đã trả lời'}
              </span>
            </div>
            <p className="emotion-analysis-reason">{analysis.reason}</p>
            {isUnreplied && analysis.needsHuman && <p className="emotion-analysis-note">Nên để nhân viên hỗ trợ trực tiếp.</p>}
            <p className="emotion-analysis-note">Đánh giá từ tin nhắn gần nhất và ngữ cảnh trong phiên.</p>
          </>
        ) : <p className="emotion-analysis-note">Chưa có phân tích AI. Gửi tin mới hoặc bấm Phân tích AI.</p>}
        {aiStatus === 'error' && <p className="emotion-analysis-note">Phân tích tin mới chưa thành công; chưa cập nhật nhãn.</p>}
        <div className="profile-section-title" style={{ marginTop: 20 }}>Diễn biến toàn cuộc trò chuyện</div>
        <p className="emotion-analysis-note">Đã lưu {memory.length} lượt phân tích. Tin cũ được phân tích dần khi mở hội thoại.</p>
        <div className="emotion-analysis-tags">{emotions.map(([emotion, count]) => <span className="tag tag-neutral" key={emotion}>
          {EMOTION_LABELS[emotion as keyof typeof EMOTION_LABELS]} · {count}
        </span>)}</div>
        {styles.length > 0 && <>
          <div className="profile-section-title" style={{ marginTop: 16 }}>Phong cách giao tiếp quan sát được</div>
          {styles.map((style) => <p className="emotion-analysis-reason" key={style}>{style}</p>)}
          <p className="emotion-analysis-note">Suy luận từ lời nhắn, không phải kết luận cố định về tính cách.</p>
        </>}
        {memory.length > 0 && <details style={{ marginTop: 16 }}><summary>Lịch sử cảm xúc &amp; ưu tiên ({memory.length})</summary>
          {[...memory].reverse().map((entry) => <div className="timeline-text" key={entry.messageId} style={{ marginTop: 14 }}>
            <div>{EMOTION_LABELS[entry.analysis.emotion]} · {PRIORITY_LABELS[entry.analysis.priority]}</div>
            <p>{entry.analysis.reason}</p>
            <div className="emotion-analysis-note">{entry.messageText.slice(0, 180)}</div>
            <span className="t-time">{new Date(entry.timestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>
          </div>)}
        </details>}
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
