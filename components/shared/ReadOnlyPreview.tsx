'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AdminShell } from '@/components/features/admin/AdminShell';
import { useAppSecurity } from '@/lib/hooks/useAppSecurity';
import styles from './security.module.css';

const pages = {
  'tong-quan': { title: 'Tổng quan', tabs: ['Tổng quan', 'Hoạt động'], columns: ['Hội thoại', 'Khách hàng', 'Tin nhắn hôm nay'] },
  'hop-thoai': { title: 'Hộp thoại', tabs: ['Tất cả', 'Chưa trả lời'], columns: ['Danh sách hội thoại', 'Nội dung hội thoại', 'Thông tin khách hàng'] },
  marketing: { title: 'Marketing', tabs: ['Hàng chờ duyệt', 'Bình luận Facebook', 'Bài đăng', 'Soạn bài AI'], columns: ['Nội dung đề xuất', 'Nhóm khách hàng', 'Hiệu suất'] },
  livestream: { title: 'Livestream', tabs: ['Phiên trực tiếp', 'Sản phẩm', 'Đơn nháp'], columns: ['Bình luận', 'Nhóm câu hỏi', 'Đơn hàng'] },
  'smart-sourcing': { title: 'Smart Sourcing', tabs: ['Từ khóa', 'Sản phẩm', 'Nguồn hàng'], columns: ['Từ khóa theo ngành', 'Sản phẩm nổi bật', 'Nguồn cung'] },
  'cau-hinh-ai': { title: 'Cấu hình AI', tabs: ['Sản phẩm', 'FAQ', 'Email tự động'], columns: ['Danh mục sản phẩm', 'Câu hỏi thường gặp', 'Kịch bản chăm sóc'] },
  'cai-dat': { title: 'Cài đặt', tabs: ['Tài khoản & nhân viên', 'Tích hợp kênh'], columns: ['Thông tin shop', 'Nhân viên', 'Kênh kết nối'] },
};
export function ReadOnlyPreview({ pathname }: { pathname: string }) {
  const { session, refresh } = useAppSecurity();
  const [tab, setTab] = useState('');
  const current = Object.keys(pages).find(path => pathname === `/${path}` || pathname.startsWith(`/${path}/`)) as keyof typeof pages | undefined;
  const page = pages[current || 'tong-quan'];
  return <AdminShell currentPath={current || 'tong-quan'}><div className={styles.root}>
    {session.error && <div className={styles.banner}><p role="alert">{session.error}</p><button type="button" onClick={() => void refresh()}>Thử lại</button></div>}
    <div className="page-head"><div><h1>{page.title}</h1><p>Bản xem trước giao diện.</p></div>{!session.authenticated && <Link href="/dang-nhap">Đăng nhập</Link>}</div>
    <div className="tabs" aria-label="Các mục xem trước">{page.tabs.map(label => <button type="button" className={`tab-btn ${label === (tab || page.tabs[0]) ? 'active' : ''}`} key={label} onClick={() => setTab(label)}>{label}</button>)}</div>
    <div className={styles.previewGrid}>{page.columns.map((label, index) => <section className="card" key={label}><h2>{label}</h2><span className={styles.sample}>Minh họa {index + 1}</span><div className={styles.placeholder} aria-hidden="true" /><div className={styles.placeholder} aria-hidden="true" /><p>Thông tin thật chỉ hiển thị khi bạn được cấp quyền.</p></section>)}</div>
    <section className="card"><h2>{tab || page.tabs[0]}</h2><fieldset disabled className={styles.disabled}><label htmlFor="preview-content">Nội dung minh họa</label><textarea id="preview-content" placeholder="Chức năng chỉ xem — chưa có dữ liệu khách hàng" /><div><button className="btn btn-primary" type="button">Gửi / lưu</button><button className="btn btn-outline" type="button">Đồng bộ dữ liệu</button></div></fieldset></section>
  </div></AdminShell>;
}
