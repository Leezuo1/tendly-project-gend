'use client';

import React, { useState, type FormEvent } from 'react';
import { getDashboardKey, PostsApiError, setDashboardKey } from '@/lib/services/postsClient';

/** Lỗi khi tải dữ liệu Marketing: thiếu mã quản trị thì cho nhập mã, lỗi khác thì cho thử lại. */
export function MarketingDataNotice({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const [keyInput, setKeyInput] = useState('');
  const code = error instanceof PostsApiError ? error.code : undefined;

  const saveKey = (e: FormEvent) => {
    e.preventDefault();
    setDashboardKey(keyInput.trim());
    setKeyInput('');
    onRetry();
  };

  if (code === 'NEED_DASHBOARD_KEY') {
    return (
      <div className="card pc-key">
        <div>
          <h2>🔒 Cần mã quản trị</h2>
          <p>
            Dữ liệu khách hàng và chức năng gửi tin được khoá bằng <code>DASHBOARD_KEY</code>.
            {getDashboardKey() ? ' Mã đang lưu không đúng.' : ''}
          </p>
        </div>
        <form onSubmit={saveKey} className="pc-key-form">
          <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="Nhập mã quản trị" />
          <button className="btn btn-primary btn-sm" disabled={!keyInput.trim()}>Lưu mã</button>
        </form>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="pc-notice">
        <b>{error instanceof Error ? error.message : 'Không tải được dữ liệu.'}</b>
        {code === 'NO_DASHBOARD_KEY' && <span> Thêm biến <code>DASHBOARD_KEY</code> trên Vercel rồi deploy lại.</span>}
        <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>Thử lại</button>
      </div>
    </div>
  );
}
