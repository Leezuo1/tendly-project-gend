'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { liveClient } from '@/lib/services/liveClient';
import type { LiveSnapshot } from '@/lib/types/live';

const POLL_MS = 3000;

/**
 * Dữ liệu của 1 phiên live cho dashboard. Đang live: gọi sync, chờ 3 giây sau khi request trước xong rồi gọi tiếp,
 * tạm dừng khi tab bị ẩn. Phiên đã kết thúc: tải snapshot 1 lần.
 * `apply(snapshot)` cập nhật ngay sau các thao tác (đổi mẫu lên sóng, duyệt nhóm...) trả về snapshot mới.
 */
export function useLiveSession(sessionId: string | null) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [version, setVersion] = useState(0);
  const live = useRef(true);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    live.current = true;

    const tick = async (first: boolean) => {
      if (cancelled) return;
      if (!first && document.hidden) {
        timer = setTimeout(() => void tick(false), POLL_MS);
        return;
      }
      try {
        const next = first ? await liveClient.snapshot(sessionId) : await liveClient.sync(sessionId);
        if (cancelled) return;
        setSnapshot(next);
        setError(null);
        live.current = next.session.status === 'live';
      } catch (e) {
        if (!cancelled) setError(e);
      }
      if (!cancelled && live.current) timer = setTimeout(() => void tick(false), first ? 0 : POLL_MS);
    };
    void tick(true);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, version]);

  const apply = useCallback((next: LiveSnapshot) => setSnapshot(next), []);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { snapshot: sessionId && snapshot?.session.id === sessionId ? snapshot : null, error, apply, reload };
}
