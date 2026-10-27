'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { LiveMiniPanel } from './LiveMiniPanel';

export function LiveMiniPage() {
  const sessionId = useSearchParams().get('session');
  return (
    <div className="live-mini-root">
      {sessionId && /^[0-9a-f-]{36}$/i.test(sessionId)
        ? <LiveMiniPanel sessionId={sessionId} />
        : <div className="live-mini"><span className="live-mini-empty">Thiếu phiên live. Mở cửa sổ này từ trang Livestream.</span></div>}
    </div>
  );
}
