import Link from 'next/link';

export default function Footer() {
  return (
    <footer>
      <div className="wrap">
        <Link className="logo" href="/" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/tendly-logo.png" alt="Tendly" style={{ height: 26, width: 'auto', display: 'block' }} />
        </Link>
        <div className="footer-links">
          <Link href="#">Điều khoản</Link>
          <Link href="#">Chính sách</Link>
          <Link href="#">Liên hệ</Link>
        </div>
        <p>© 2026 Tendly — Nền tảng chăm sóc khách hàng AI</p>
      </div>
    </footer>
  );
}
