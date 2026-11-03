'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
    <div className="nav-topbar" aria-hidden="true" />
    <nav className={scrolled ? 'scrolled' : ''} id="nav">
      <div className="wrap-wide nav-inner">
        <Link className="logo" href="/" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/tendly-logo.png" alt="Tendly" style={{ width: 136, height: 'auto', display: 'block' }} />
        </Link>
        <div className="nav-links">
          <Link href="/#san-pham">Sản phẩm</Link>
          <Link href="/#cach-hoat-dong">Cách hoạt động</Link>
          <Link href="/#hoi-dap">Hỏi đáp</Link>
          <Link href="/pricing" className={pathname === '/pricing' ? 'active' : ''}>
            Bảng giá
          </Link>
        </div>
        <Link href="/dang-nhap" className="nav-cta" aria-label="Đăng ký hoặc đăng nhập Tendly">Bắt đầu</Link>
      </div>
    </nav>
    </>
  );
}
