import React from 'react';
import { APPROVAL_ITEMS } from '@/lib/data/marketing';

interface ApprovalQueueTabProps {
  onToast?: (msg: string) => void;
}

export function ApprovalQueueTab({ onToast }: ApprovalQueueTabProps) {
  const handleApprove = (name: string) => {
    if (onToast) onToast(`Đã duyệt & gửi remarketing cho ${name}!`);
  };

  const handleEdit = (name: string) => {
    if (onToast) onToast(`Mở chỉnh sửa nội dung cho ${name}`);
  };

  return (
    <div className="tab-panel active" id="tab-queue">
      <div className="card">
        <div className="card-head">
          <h2>Nội dung AI đề xuất</h2>
          <span className="hint">{APPROVAL_ITEMS.length} đang chờ duyệt</span>
        </div>

        {APPROVAL_ITEMS.map((item) => (
          <div key={item.id} className="approval-row">
            <div className="approval-avatar" style={item.avatarStyle}>
              {item.avatar}
            </div>
            <div className="approval-body">
              <div className="approval-top">
                <span className="approval-name">{item.name}</span>
                <span className="approval-channel">{item.channel}</span>
                <span className={`tag tag-${item.tagType}`}>{item.tag}</span>
              </div>
              <div className="approval-context">
                {item.context}
              </div>
              <div className="approval-draft">{item.draft}</div>
              <div className="approval-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleApprove(item.name)}
                >
                  Duyệt &amp; Gửi
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => handleEdit(item.name)}
                >
                  Xem &amp; Sửa
                </button>
              </div>
            </div>
            <div className="approval-tail">
              <span className="approval-time">{item.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
