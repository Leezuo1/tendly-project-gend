'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { liveClient } from '@/lib/services/liveClient';
import { LiveMiniPanel } from './LiveMiniPanel';

/**
 * ?pending=1: cửa sổ mở trước khi phiên tạo xong. Tự tìm phiên live vừa tạo (trong 2 phút) thay vì chờ trang mở nó
 * báo lại — trang mở có thể đã bị đóng/thay thế (một số trình duyệt mở popup đè lên tab).
 */
function PendingSession() {
  const router = useRouter();
  const [openedAt] = useState(() => Date.now());
  const [note, setNote] = useState('Đang tạo phiên live…');
  useEffect(() => {
    let stop = false;
    const look = async (tries: number) => {
      if (stop) return;
      try {
        const sessions = await liveClient.sessions();
        const fresh = sessions.find((s) => s.status === 'live' && s.startedAt >= openedAt - 120_000);
        if (fresh) return router.replace(`/livestream/mini?session=${encodeURIComponent(fresh.id)}`);
      } catch {
        // chưa có mã quản trị / mạng chập chờn: thử lại
      }
      if (tries > 30) return setNote('Chưa thấy phiên mới. Đóng cửa sổ này và bấm "Mở cửa sổ nổi" ở trang Livestream.');
      setTimeout(() => void look(tries + 1), 1000);
    };
    void look(0);
    return () => { stop = true; };
  }, [openedAt, router]);
  return <div className="live-mini"><span className="live-mini-empty">{note}</span></div>;
}

export function LiveMiniPage() {
  const params = useSearchParams();
  const sessionId = params.get('session');
  const pending = params.get('pending') === '1';
  return (
    <div className="live-mini-root">
      {sessionId && /^[0-9a-f-]{36}$/i.test(sessionId)
        ? <LiveMiniPanel sessionId={sessionId} />
        : pending ? <PendingSession />
          : <div className="live-mini"><span className="live-mini-empty">Thiếu phiên live. Mở cửa sổ này từ trang Livestream.</span></div>}
    </div>
  );
}
