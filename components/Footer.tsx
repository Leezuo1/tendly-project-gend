import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <Link className="logo" href="/" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/tendly-logo.png" alt="Tendly" style={{ width: 120, height: 'auto', display: 'block' }} />
        </Link>
        <div className="footer-links">
          <Link href="/#san-pham">Sản phẩm</Link>
          <Link href="/pricing">Bảng giá</Link>
          <Link href="/tong-quan">Mở <Image unoptimized src="/tendly-logo.png" alt="Tendly" width={960} height={377} style={{ display: 'inline-block', height: '1em', width: 'auto', verticalAlign: '-.12em' }} /></Link>
        </div>
        <p>© 2026 <Image unoptimized src="/tendly-logo.png" alt="Tendly" width={960} height={377} style={{ display: 'inline-block', height: '1em', width: 'auto', verticalAlign: '-.12em' }} /> — Nền tảng chăm sóc khách hàng AI</p>
      </div>
    </footer>
  );
}
