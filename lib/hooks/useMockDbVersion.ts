'use client';

import { useSyncExternalStore } from 'react';
import { dbVersion, subscribeDb } from '@/lib/services/mockDb';

/**
 * Trả về -1 khi render trên server / lúc hydrate (chưa đọc được localStorage),
 * sau đó là số phiên bản của mock DB — dùng làm dependency để đọc lại dữ liệu.
 */
export function useMockDbVersion(): number {
  return useSyncExternalStore(subscribeDb, dbVersion, () => -1);
}
