'use client';
import { useEffect, useState } from 'react';
import { useInboxSession } from '@/lib/services/inboxCredentials';

/** Load verified Page identity through the server session; credentials never enter browser storage. */
export function useFacebookPage() {
  const { ready } = useInboxSession();
  const [page, setPage] = useState({ name: '', avatarUrl: '' });
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    const refresh = async () => {
      if (document.visibilityState === 'hidden') { timer = setTimeout(refresh, 2000); return; }
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let retry = 60000;
      try {
        const response = await fetch('/api/settings/channels', { cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!cancelled) {
          setPage(response.ok && data.pageAccessible
            ? { name: data.pageName || '', avatarUrl: data.pageAvatarUrl || '' } : { name: '', avatarUrl: '' });
          if (response.ok && data.pageAccessible) retry = 300000;
        }
      } catch { /* Retain previously verified identity during a temporary network failure. */ }
      finally { clearTimeout(timeout); if (!cancelled) timer = setTimeout(refresh, retry); }
    };
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); controller?.abort(); };
  }, [ready]);
  return ready ? page : { name: '', avatarUrl: '' };
}
