'use client';
import { useEffect, useState } from 'react';

interface InboxSession { ready: boolean; error: string }
let pending: Promise<InboxSession> | undefined;
let refreshAt = 0;
export function openInboxSession(): Promise<InboxSession> {
  if (pending && Date.now() < refreshAt) return pending;
  refreshAt = Date.now() + 60000;
  // Remove credentials previously kept in browser storage; the environment key stays on the server.
  try { localStorage.removeItem('tendly.inbox-access'); } catch { /* Storage unavailable. */ }
  try { sessionStorage.removeItem('tendly.inbox-access'); } catch { /* Storage unavailable. */ }
  pending = fetch('/api/inbox/session', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(10000) })
    .then(async (response) => {
      const data = await response.json();
      return response.ok && data.ready === true
        ? { ready: true, error: '' } : { ready: false, error: data.error || 'Chưa cấu hình truy cập hội thoại.' };
    })
    .catch(() => ({ ready: false, error: 'Không kết nối được server. Vui lòng tải lại trang.' }));
  return pending;
}
export function useInboxSession(): InboxSession {
  const [session, setSession] = useState<InboxSession>({ ready: false, error: '' });
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const renew = async () => {
      const result = await openInboxSession();
      if (!cancelled) { setSession(result); timer = setTimeout(renew, result.ready ? 15 * 60000 : 15000); }
    };
    void renew();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);
  return session;
}
