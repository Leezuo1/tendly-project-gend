'use client';

/**
 * Mở cửa sổ nhỏ hỗ trợ live, luôn nổi trên cùng (Document Picture-in-Picture — Chrome/Edge),
 * kéo đặt cạnh màn hình phát live. Trình duyệt không hỗ trợ thì mở popup nhỏ /livestream/mini.
 *
 * Trình duyệt chỉ cho mở cửa sổ NGAY TRONG cú bấm của người dùng, nên hàm nhận cả Promise mã phiên:
 * cửa sổ mở trước (hiện "Đang tạo phiên…"), phiên tạo xong thì hiện dữ liệu. Ví dụ:
 *   onClick={() => openLiveMini(liveClient.start({...}).then((s) => s.id))}
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { LiveMiniPanel } from '@/components/features/livestream/LiveMiniPanel';
import { registerLiveSurface } from '@/lib/hooks/useLiveSession';

interface DocumentPictureInPicture {
  requestWindow(options: { width: number; height: number }): Promise<Window>;
  window: Window | null;
}

const SIZE = { width: 380, height: 660 };

export const miniUrl = (sessionId: string) => `/livestream/mini?session=${encodeURIComponent(sessionId)}`;

/** Chép CSS của trang vào cửa sổ nổi (cửa sổ nổi là tài liệu riêng, không tự có style). */
function copyStyles(target: Document) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = target.createElement('style');
      style.textContent = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
      target.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = target.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        target.head.appendChild(link);
      }
    }
  }
}

function Placeholder({ text }: { text: string }) {
  return <div className="live-mini"><span className="live-mini-empty">{text}</span></div>;
}

export type MiniOpenResult = 'pip' | 'popup' | 'blocked';

export async function openLiveMini(session: string | Promise<string>): Promise<MiniOpenResult> {
  const pipApi = (window as unknown as { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture;
  if (pipApi?.requestWindow) {
    let pip: Window | null = null;
    try {
      pipApi.window?.close(); // mỗi lúc chỉ 1 cửa sổ nổi
      pip = await pipApi.requestWindow(SIZE); // gọi trước mọi await khác để còn trong cú bấm
    } catch {
      pip = null; // bị chặn / không hỗ trợ thật → popup
    }
    if (pip) {
      copyStyles(pip.document);
      pip.document.title = 'Tendly Live';
      pip.document.body.style.margin = '0';
      const container = pip.document.createElement('div');
      container.className = 'live-mini-root';
      pip.document.body.appendChild(container);
      const unregister = registerLiveSurface(pip);
      const root = createRoot(container);
      pip.addEventListener('pagehide', () => {
        unregister();
        root.unmount();
      }, { once: true });
      root.render(<Placeholder text="Đang tạo phiên live…" />);
      try {
        const id = await session;
        root.render(<LiveMiniPanel sessionId={id} fullUrl={`${location.origin}/livestream`} />);
      } catch {
        root.render(<Placeholder text="Không tạo được phiên live. Đóng cửa sổ này và thử lại." />);
      }
      return 'pip';
    }
  }
  // Popup: mở ngay trong cú bấm bằng trang thật (một số trình duyệt chặn popup trang trống),
  // có mã phiên rồi mới chuyển tới đúng phiên
  const ready = typeof session === 'string' ? session : null;
  const popup = window.open(ready ? miniUrl(ready) : '/livestream/mini?pending=1', 'tendly-live-mini',
    `width=${SIZE.width},height=${SIZE.height}`);
  if (!popup) return 'blocked';
  if (!ready) {
    try {
      popup.location.href = miniUrl(await session);
    } catch {
      popup.close();
    }
  }
  return 'popup';
}
