'use client';
import { useEffect, useState } from 'react';
import { useInboxSession } from '@/lib/services/inboxCredentials';

/** Sidebar polling runs on every dashboard page, independently of the inbox. */
export function useUnrepliedCount() {
  const { ready } = useInboxSession();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    let running = false;
    const refresh = async () => {
      if (cancelled || running) return;
      clearTimeout(timer);
      if (document.visibilityState === 'hidden') return;
      running = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10000);
      try {
        const response = await fetch('/api/messenger/unreplied', { cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!cancelled && response.ok && Number.isSafeInteger(data.count) && data.count >= 0) setCount(data.count);
      } catch { /* Keep the last count during temporary network failures. */ }
      finally {
        clearTimeout(timeout);
        running = false;
        if (!cancelled) timer = setTimeout(refresh, 2000);
      }
    };
    const resume = () => { if (document.visibilityState !== 'hidden') void refresh(); };
    document.addEventListener('visibilitychange', resume);
    void refresh();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', resume);
    };
  }, [ready]);
  return ready ? count : 0;
}
