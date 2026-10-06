import React from 'react';
import Link from 'next/link';
import { UrgentItem } from '@/lib/types/dashboard';

interface UrgentQueueProps {
  urgentItems: UrgentItem[];
  onOpenModal: (item: UrgentItem) => void;
  onToast: (msg: string) => void;
}

export function UrgentQueue({ urgentItems, onOpenModal, onToast }: UrgentQueueProps) {
  return (
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
              onClick={() => onOpenModal(item)}
            >
              Xử lý
            </button>
          </div>
        ))
      )}

      <Link
        href="/hop-thoai"
        className="card-foot-link"
        style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
      >
        Xem tất cả hội thoại đang chờ →
      </Link>
    </div>
  );
}
