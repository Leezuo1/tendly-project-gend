'use client';

import type { DraftImage } from '@/lib/types/inbox';

/** Hàng ảnh nhỏ phía trên ô soạn: ảnh AI gợi ý và ảnh nhân viên chọn từ máy; gỡ bằng nút ×, sẽ đi kèm tin được gửi. */
export function PhotoTray({ items, onRemove, disabled }: { items: DraftImage[]; onRemove: (key: string) => void; disabled?: boolean }) {
  if (!items.length) return null;
  return (
    <div className="photo-tray" aria-label="Ảnh sẽ gửi kèm">
      {items.map((item) => (
        <figure className="photo-tray-item" key={item.key}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.kind === 'product' ? `/api/product-images/${encodeURIComponent(item.imageId)}` : item.previewUrl} alt={item.kind === 'product' ? 'Ảnh sản phẩm gửi kèm' : 'Ảnh đính kèm'} />
          <button type="button" className="photo-tray-remove" aria-label="Gỡ ảnh này" disabled={disabled} onClick={() => onRemove(item.key)}>×</button>
        </figure>
      ))}
    </div>
  );
}
