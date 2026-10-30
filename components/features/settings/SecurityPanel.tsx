'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useAppSecurity } from '@/lib/hooks/useAppSecurity';
import styles from '@/components/shared/security.module.css';

export function SecurityPanel() {
  const { session, refresh } = useAppSecurity();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function toggle() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/security', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !session.protectionEnabled, revision: session.revision }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không thay đổi được trạng thái.');
      await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Không thay đổi được trạng thái.'); await refresh(); }
    finally { setBusy(false); }
  }
  return <div className={styles.root}><div className="page-head"><div><h1>Quản trị bảo mật</h1><p>Đăng nhập với vai trò quản trị · {session.username}</p></div></div>
    <section className="card"><div className={styles.toggleRow}><div><h2>Bảo vệ dữ liệu app</h2><p className={styles.description}>{session.protectionEnabled ? 'Đang bật: tài khoản thường chỉ xem giao diện, dữ liệu thật được ẩn.' : 'Đang tắt: tài khoản thường có thể sử dụng dữ liệu và thao tác với Page thật.'}</p></div><button type="button" role="switch" aria-label="Bảo vệ dữ liệu app" aria-checked={session.protectionEnabled} disabled={busy} className={styles.toggle} onClick={() => void toggle()}><span /></button></div>
      <p className={styles.metadata}>Công tắc áp dụng cho toàn app và được lưu trên server. Quản trị viên vẫn có quyền thao tác khi khóa. Khi bật bảo vệ, tác vụ tự động gửi tin cũng tạm dừng; webhook tiếp tục nhận và lưu tin khách.</p>
      <p className={styles.metadata}>Cập nhật: {session.updatedAt ? new Date(session.updatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—'} · {session.updatedBy || 'Hệ thống'}</p>
      <p role="status" className={styles.metadata}>{busy ? 'Đang lưu trạng thái…' : session.protectionEnabled ? 'Bảo vệ đang bật' : 'Bảo vệ đang tắt'}</p>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </section><div className={styles.banner}><strong>Lưu ý khi mở quyền sử dụng</strong><p>Tắt bảo vệ cho phép tài khoản demo thực hiện các chức năng với Page đang cấu hình. Tin đã được Meta nhận trước khi bật khóa không thể thu hồi bằng công tắc.</p><Link href="/tong-quan">Vào ứng dụng →</Link></div>
  </div>;
}
