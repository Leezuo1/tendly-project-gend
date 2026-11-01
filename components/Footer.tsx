import Link from 'next/link';
import Image from 'next/image';

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
          <Link href="/tong-quan">Mở <Image unoptimized src="/tendly-logo.png" alt="Tendly" width={960} height={377} style={{ display: 'inline-block', height: '1em', width: 'auto', verticalAlign: '-.12em' }} /></Link>
        </div>
        <p>© 2026 <Image unoptimized src="/tendly-logo.png" alt="Tendly" width={960} height={377} style={{ display: 'inline-block', height: '1em', width: 'auto', verticalAlign: '-.12em' }} /> — Nền tảng chăm sóc khách hàng AI</p>
      </div>
    </footer>
  );
}
