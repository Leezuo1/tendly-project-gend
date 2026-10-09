'use client';

import { useEffect, useState } from 'react';

/** Read the real Page identity after this tab has an authenticated inbox session. */
export function useFacebookPage() {
  const [page, setPage] = useState({ name: '', avatarUrl: '' });
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    let lastKey = '';
    let refreshAt = 0;
    const poll = async () => {
      let key = '';
      try { key = sessionStorage.getItem('tendly.inbox-access') || ''; } catch { /* storage unavailable */ }
      if (key && document.visibilityState !== 'hidden' && (key !== lastKey || Date.now() >= refreshAt)) {
        lastKey = key;
        refreshAt = Date.now() + 60_000;
        controller = new AbortController();
        const timeout = setTimeout(() => controller?.abort(), 10000);
        try {
          const response = await fetch('/api/settings/channels', {
            headers: { Authorization: `Bearer ${key}` }, cache: 'no-store', signal: controller.signal,
          });
          const data = await response.json();
          if (!cancelled) {
            setPage(response.ok && data.pageAccessible
              ? { name: data.pageName || '', avatarUrl: data.pageAvatarUrl || '' } : { name: '', avatarUrl: '' });
            if (response.ok && data.pageAccessible) refreshAt = Date.now() + 300_000;
          }
        } catch { /* Retry later without replacing a previously verified identity. */ }
        finally { clearTimeout(timeout); }
      } else if (!key && lastKey && !cancelled) {
        lastKey = ''; setPage({ name: '', avatarUrl: '' });
      }
      if (!cancelled) timer = setTimeout(poll, 2000);
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); controller?.abort(); };
  }, []);
  return page;
}
