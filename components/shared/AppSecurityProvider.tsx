'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppSecurityContext, lockedSession } from '@/lib/hooks/useAppSecurity';
import { logoutMock } from '@/lib/services/mockOnboarding';
import type { AppSession } from '@/lib/types/security';
import { ReadOnlyPreview } from './ReadOnlyPreview';
import '@/components/features/admin/admin-shell.css';

const publicPaths = ['/', '/pricing', '/dang-nhap', '/dang-ky', '/tao-shop', '/ket-noi'];
export function AppSecurityProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<AppSession>(lockedSession);
  const [loading, setLoading] = useState(true);
  const pending = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    pending.current?.abort();
    const active = new AbortController(); pending.current = active;
    let next = lockedSession;
    try {
      const response = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.any([active.signal, AbortSignal.timeout(10000)]) });
      const data = await response.json();
      if (!response.ok || typeof data.canUse !== 'boolean' || !['admin', 'user', null].includes(data.role)) throw new Error(data.error || 'Không đọc được trạng thái bảo vệ.');
      next = data;
    } catch (error) { next = { ...lockedSession, error: error instanceof Error ? error.message : 'Không kết nối được hệ thống bảo mật.' }; }
    if (!active.signal.aborted) { setSession(next); setLoading(false); }
    return next;
  }, []);
  useEffect(() => {
    for (const storage of [() => localStorage, () => sessionStorage]) {
      try { for (const key of ['tendly.dashboardKey', 'tendly.inbox-access']) storage().removeItem(key); } catch { /* Browser storage may be disabled. */ }
    }
    const initial = window.setTimeout(() => void refresh(), 0);
    const visibleRefresh = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(visibleRefresh, 3000);
    window.addEventListener('focus', visibleRefresh);
    document.addEventListener('visibilitychange', visibleRefresh);
    return () => { clearTimeout(initial); clearInterval(timer); pending.current?.abort(); window.removeEventListener('focus', visibleRefresh); document.removeEventListener('visibilitychange', visibleRefresh); };
  }, [refresh]);
  const logout = async () => {
    const response = await fetch('/api/auth/session', { method: 'DELETE' });
    if (!response.ok) throw new Error('Chưa đăng xuất được. Vui lòng thử lại.');
    logoutMock(); await refresh();
  };
  let content = children;
  if (!publicPaths.includes(pathname)) {
    if (loading) content = <main style={{ padding: 40 }} role="status">Đang kiểm tra quyền truy cập…</main>;
    else if (pathname === '/quan-tri' && session.role !== 'admin') content = <main style={{ padding: 40 }}><h1>Khu vực quản trị</h1><p>{session.error || 'Đăng nhập bằng tài khoản quản trị riêng để quản lý chế độ bảo vệ.'}</p><Link href="/dang-nhap">Đến trang đăng nhập</Link></main>;
    else if (!session.canUse) content = <ReadOnlyPreview pathname={pathname} />;
  }
  return <AppSecurityContext.Provider value={{ session, loading, refresh, logout }}><div key={`${session.role}:${session.canUse}:${session.revision}`}>{content}</div></AppSecurityContext.Provider>;
}
