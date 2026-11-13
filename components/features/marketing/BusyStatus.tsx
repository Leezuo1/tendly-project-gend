'use client';

import { useEffect, useState } from 'react';

/** Đếm giây từ lúc hiện ra; AI có thể chạy tới ~1 phút. Số giây aria-hidden để trình đọc màn hình không đọc mỗi giây. */
export function BusyStatus() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now(), timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  return <>Đang xử lý yêu cầu…<span aria-hidden="true"> {seconds}s</span>{seconds >= 15 && ' AI có thể mất tới 1 phút, đừng đóng trang.'}</>;
}
