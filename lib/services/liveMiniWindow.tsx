'use client';

/**
 * Mở cửa sổ nhỏ hỗ trợ live, luôn nổi trên cùng (Document Picture-in-Picture — Chrome/Edge),
 * kéo đặt cạnh màn hình phát live. Trình duyệt không hỗ trợ thì mở popup nhỏ /livestream/mini.
 * Dashboard nào cũng gọi được: openLiveMini(sessionId).
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

export async function openLiveMini(sessionId: string): Promise<'pip' | 'popup' | 'blocked'> {
  const pipApi = (window as unknown as { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture;
  if (pipApi?.requestWindow) {
    try {
      pipApi.window?.close(); // mỗi lúc chỉ 1 cửa sổ nổi
      const pip = await pipApi.requestWindow(SIZE);
      copyStyles(pip.document);
      pip.document.title = 'Tendly Live';
      pip.document.body.style.margin = '0';
      const container = pip.document.createElement('div');
      container.className = 'live-mini-root';
      pip.document.body.appendChild(container);
      const unregister = registerLiveSurface(pip);
      const root = createRoot(container);
      root.render(<LiveMiniPanel sessionId={sessionId} fullUrl={`${location.origin}/livestream`} />);
      pip.addEventListener('pagehide', () => {
        unregister();
        root.unmount();
      }, { once: true });
      return 'pip';
    } catch {
      // Người dùng từ chối / trình duyệt chặn → dùng popup
    }
  }
  const popup = window.open(miniUrl(sessionId), 'tendly-live-mini', `width=${SIZE.width},height=${SIZE.height}`);
  return popup ? 'popup' : 'blocked';
}
