'use client';

import { useEffect } from 'react';
import { useAppSecurity } from '@/lib/hooks/useAppSecurity';
import { startCatalogSync } from '@/lib/services/catalogSync';

/** Giữ danh mục sản phẩm/FAQ trong trình duyệt khớp với database khi đã đăng nhập; không hiển thị gì. */
export function CatalogSync() {
  const { session } = useAppSecurity();
  const enabled = session.authenticated && session.canUse;
  useEffect(() => (enabled ? startCatalogSync() : undefined), [enabled]);
  return null;
}
