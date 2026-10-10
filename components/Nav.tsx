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
    <nav className={scrolled ? 'scrolled' : ''} id="nav">
      <div className="wrap nav-inner">
        <Link className="logo" href="/" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/tendly-logo.png" alt="Tendly" style={{ height: 32, width: 'auto', display: 'block' }} />
        </Link>
        <div className="nav-links">
          <Link href="/#how">Cách hoạt động</Link>
          <Link href="/#features">Tính năng</Link>
          <Link href="/#care">AI hỗ trợ khách</Link>
          <Link href="/pricing" className={pathname === '/pricing' ? 'active' : ''}>
            Bảng giá
          </Link>
        </div>
        <Link href="/tong-quan" className="nav-cta">Đăng ký / Đăng nhập</Link>
      </div>
    </nav>
  );
}
