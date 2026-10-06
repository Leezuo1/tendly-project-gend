import React from 'react';
import { EMAIL_LOGS } from '@/lib/data/dashboard';

interface EmailAutomationLogProps {
  onToast: (msg: string) => void;
}

export function EmailAutomationLog({ onToast }: EmailAutomationLogProps) {
  return (
    <div className="card">
      <div className="card-head">
        <h2>Email tự động hôm nay</h2>
      </div>

      {EMAIL_LOGS.map((log, i) => (
        <div key={i} className="log-row">
          <div className="log-icon">{log.icon}</div>
          <div className="log-name">{log.name}</div>
          <div className="log-trigger">{log.trigger}</div>
          <div className="log-status">
            <span className="dot"></span>
            {log.status}
          </div>
        </div>
      ))}

      <button
        type="button"
        className="card-foot-link"
        style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer' }}
        onClick={() => onToast('Mở toàn bộ 18 nhật ký email automation')}
      >
        Xem toàn bộ nhật ký →
      </button>
    </div>
  );
}
