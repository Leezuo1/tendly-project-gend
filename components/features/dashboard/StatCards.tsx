import React from 'react';

interface StatCardsProps {
  urgentCount: number;
}

export function StatCards({ urgentCount }: StatCardsProps) {
  return (
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
        <div className="value">{urgentCount}</div>
        <div className="sub">
          {urgentCount > 0
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
  );
}
