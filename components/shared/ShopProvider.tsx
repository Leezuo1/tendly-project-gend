'use client';

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createSeed } from '@/lib/data/admin';
import { useMockDbVersion } from '@/lib/hooks/useMockDbVersion';
import { snapshot } from '@/lib/services/api';
import type { Shop } from '@/lib/types/admin';

const ShopContext = createContext<Shop | null>(null);

/** Thông tin shop dùng chung (email, khung chat...). Tự cập nhật khi mock DB thay đổi. */
export function ShopProvider({ children }: { children: ReactNode }) {
  // server / lúc hydrate dùng seed để khớp HTML, sau đó đọc mock DB (localStorage)
  const version = useMockDbVersion();
  const shop = useMemo<Shop>(() => (version < 0 ? createSeed().shop : snapshot.shop()), [version]);

  return <ShopContext.Provider value={shop}>{children}</ShopContext.Provider>;
}

export function useShop(): Shop {
  const shop = useContext(ShopContext);
  if (!shop) throw new Error('useShop phải nằm trong ShopProvider');
  return shop;
}

export const DEFAULT_LOGO = '/tendly-logo.png';
