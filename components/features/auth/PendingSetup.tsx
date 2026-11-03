'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAppSecurity } from '@/lib/hooks/useAppSecurity';
import styles from './auth.module.css';

export function PendingSetup() {
  const { session, logout } = useAppSecurity();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    setBusy(true);
    try { await logout(); router.replace('/dang-nhap'); }
    catch { setError('Chưa đăng xuất được. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  }
  return <main className={styles.root}>
    <section className={`${styles.formPanel} ${styles.pendingPanel}`} aria-labelledby="account-title">
      <Link href="/" className={styles.logo}><img src="/tendly-logo.png" alt="Tendly — về trang chủ" width="144" height="48" /></Link>
      <div className={styles.formBody}>
        <h1 id="account-title">Bạn đã đăng nhập.</h1>
        <p className={styles.formDescription}>Chào {session.name}. Tài khoản {session.username} của bạn đã sẵn sàng.</p>
        <p className={styles.formDescription}>Tài khoản chưa có shop hay kênh kết nối. Chức năng thiết lập shop sẽ được bổ sung sau.</p>
        {error && <p className={styles.notice} role="alert">{error}</p>}
        <button type="button" className={styles.submit} disabled={busy} onClick={() => void signOut()}>{busy ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>
      </div>
    </section>
  </main>;
}
