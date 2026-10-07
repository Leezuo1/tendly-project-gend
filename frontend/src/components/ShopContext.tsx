import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { snapshot } from '../services/api';
import type { Shop } from '../types';

const ShopContext = createContext<Shop | null>(null);

/** Thông tin shop dùng chung (sidebar, email, khung chat). Tự cập nhật khi mock DB thay đổi. */
export function ShopProvider({ children }: { children: ReactNode }) {
  const [shop, setShop] = useState<Shop>(() => snapshot.shop());

  useEffect(() => {
    const sync = () => setShop(snapshot.shop());
    window.addEventListener('tendly:db-changed', sync);
    return () => window.removeEventListener('tendly:db-changed', sync);
  }, []);

  return <ShopContext.Provider value={shop}>{children}</ShopContext.Provider>;
}

export function useShop(): Shop {
  const shop = useContext(ShopContext);
  if (!shop) throw new Error('useShop phải nằm trong ShopProvider');
  return shop;
}

export const DEFAULT_LOGO = '/tendly-logo.png';
