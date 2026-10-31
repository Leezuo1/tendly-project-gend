'use client';

import React from 'react';
import { Conversation, InboxFilter } from '@/lib/types/inbox';
import { CustomerAvatar } from './CustomerAvatar';
import { IconTrash } from '@/components/ui/Icons';

interface ConversationListProps {
  toolbar?: React.ReactNode;
  listToggle?: React.ReactNode;
  conversations: Conversation[];
  selectedId: string;
  onSelectConv: (id: string) => void;
  onDeleteConv: (conversation: Conversation) => void;
  sendingIds: ReadonlySet<string>;
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
  onDeleteConv,
  sendingIds,
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  counts,
  toolbar,
  listToggle,
}: ConversationListProps) {
  return (
    <div className="conv-pane">
      <div className="conv-search">
        <div className="conv-queue-title">{listToggle}</div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm khách hàng, mã đơn..."
          aria-label="Tìm kiếm hội thoại"
        />
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

      <div className="conv-list" id="conversation-list">
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
                className={`conv-item ${isActive ? 'active' : ''} ${conv.hasNewMessage ? 'has-new-message' : ''}`}
                data-conv={conv.id}
              >
                <button type="button" className="conv-select" onClick={() => onSelectConv(conv.id)}
                aria-label={`${conv.name}${conv.hasNewMessage ? ' · Có tin nhắn mới' : ''}`}
                aria-pressed={isActive}
              >
                <div className="conv-avatar-wrap">
                  <CustomerAvatar className="conv-avatar" name={conv.name} initials={conv.avatar} url={conv.avatarUrl} />
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
                  {(conv.tags.length > 0 || conv.waitingConfirmation || conv.hasNewMessage || conv.aiStatus === 'analyzing' || conv.aiStatus === 'error') && (
                    <div className="conv-tags">
                    {conv.isUnreplied && conv.waitingConfirmation && <span className="tag tag-risk">Chờ xác nhận</span>}
                    {conv.hasNewMessage && <span className="tag tag-high">Tin mới</span>}
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
                </button>
                {conv.messenger && <button type="button" className="conv-delete" aria-label={`Xóa hội thoại với ${conv.name}`} title="Xóa hội thoại" disabled={sendingIds.has(conv.id)} onClick={() => onDeleteConv(conv)}><IconTrash width="16" height="16" aria-hidden="true" /></button>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
