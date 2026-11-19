'use client';

import { useState } from 'react';

/** Ảnh khách gửi hiện ngay trong luồng tin; bấm để mở ảnh gốc. Đường dẫn của Meta có hạn nên khi không tải được thì hiện liên kết thay vì ảnh vỡ. */
export function MessageImage({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <a href={url} target="_blank" rel="noopener noreferrer">Ảnh không hiện được, mở ảnh gốc</a>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="msg-image-link">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="msg-image" src={url} alt="Ảnh trong tin nhắn" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    </a>
  );
}
