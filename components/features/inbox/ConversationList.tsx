'use client';

import React from 'react';
import { Conversation, InboxFilter } from '@/lib/types/inbox';

interface ConversationListProps {
  toolbar?: React.ReactNode;
  conversations: Conversation[];
  selectedId: string;
  onSelectConv: (id: string) => void;
  filter: InboxFilter;
  onFilterChange: (filter: InboxFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  counts: {
    all: number;
    urgent: number;
    unreplied: number;
  };
}

export function ConversationList({
  conversations,
  selectedId,
  onSelectConv,
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  counts,
  toolbar,
}: ConversationListProps) {
  return (
    <div className="conv-pane">
      <div className="conv-search">
        <div className="conv-queue-title">Hàng chờ trả lời</div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm khách hàng, mã đơn..."
          aria-label="Tìm kiếm hội thoại"
        />
        <p className="conv-queue-note">Sắp theo mức độ cần hỗ trợ · Ưu tiên cao trước</p>
        {toolbar}
      </div>

      <div className="conv-filter-row">
        <button
          type="button"
          className={`conv-filter ${filter === 'all' ? 'selected' : ''}`}
          onClick={() => onFilterChange('all')}
        >
          Tất cả · {counts.all}
        </button>
        <button
          type="button"
          className={`conv-filter ${filter === 'urgent' ? 'selected' : ''}`}
          onClick={() => onFilterChange('urgent')}
        >
          Khẩn cấp · {counts.urgent}
        </button>
        <button
          type="button"
          className={`conv-filter ${filter === 'unreplied' ? 'selected' : ''}`}
          onClick={() => onFilterChange('unreplied')}
        >
          Chưa trả lời · {counts.unreplied}
        </button>
      </div>

      <div className="conv-list">
        {conversations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--ink-soft)' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>🔍</div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Không có hội thoại phù hợp</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Thử tìm kiếm với từ khóa khác</div>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === selectedId;
            const isFb = conv.channel === 'facebook';

            return (
              <div
                key={conv.id}
                className={`conv-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectConv(conv.id)}
                data-conv={conv.id}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelectConv(conv.id);
                  }
                }}
              >
                <div className="conv-avatar-wrap">
                  <div className="conv-avatar">{conv.avatar}</div>
                  <div className={`channel-dot ${isFb ? 'cd-fb' : 'cd-zalo'}`} title={isFb ? 'Facebook Messenger' : 'Zalo OA'}>
                    {isFb ? 'f' : 'Z'}
                  </div>
                </div>

                <div className="conv-info">
                  <div className="conv-top-row">
                    <span className="conv-name">{conv.name}</span>
                    <span className="conv-time">{conv.time}</span>
                  </div>
                  <div className="conv-preview">{conv.preview}</div>
                  {conv.tags && conv.tags.length > 0 && (
                    <div className="conv-tags">
                    {conv.aiStatus === 'analyzing' && <span className="tag tag-neutral">Đang phân tích...</span>}
                    {conv.aiStatus === 'error' && <span className="tag tag-risk">Cần phân tích lại</span>}
                      {conv.tags.map((tag, idx) => (
                        <span key={idx} className={`tag tag-${tag.type}`}>
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
