'use client';

import React from 'react';
import { UrgentItem } from '@/lib/types/dashboard';

interface ReplyModalProps {
  item: UrgentItem | null;
  customReply: string;
  setCustomReply: (val: string) => void;
  onClose: () => void;
  onResolve: (itemId: string, actionName: string) => void;
}

export function ReplyModal({
  item,
  customReply,
  setCustomReply,
  onClose,
  onResolve,
}: ReplyModalProps) {
  if (!item) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Xử lý hội thoại khẩn cấp</h3>
            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              Kênh: {item.channel} • Chờ {item.time}
            </span>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="customer-detail-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <strong>{item.name}</strong>
              <span className="tag tag-high">{item.tag}</span>
            </div>
            <div style={{ color: 'var(--ink)', fontStyle: 'italic' }}>
              {item.msg}
            </div>
          </div>

          <div className="ai-suggestion-box">
            <div className="ai-suggestion-head">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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
            onClick={() => onResolve(item.id, 'Đã chuyển nhân viên')}
          >
            Chuyển nhân viên
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onResolve(item.id, 'Đã gửi phản hồi AI')}
          >
            Gửi phản hồi ngay
          </button>
        </div>
      </div>
    </div>
  );
}
