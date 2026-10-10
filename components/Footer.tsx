import Link from 'next/link';

export default function Footer() {
  return (
    <footer>
      <div className="wrap">
        <Link className="logo" href="/" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/tendly-logo.png" alt="Tendly" style={{ height: 26, width: 'auto', display: 'block' }} />
        </Link>
        <div className="footer-links">
          <Link href="/#features">Tính năng</Link>
          <Link href="/pricing">Bảng giá</Link>
          <Link href="/tong-quan">Mở Tendly</Link>
        </div>
        <p>© 2026 Tendly — Nền tảng chăm sóc khách hàng AI</p>
      </div>
    </footer>
  );
}
