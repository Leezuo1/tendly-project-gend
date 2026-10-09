'use client';

import { useSyncExternalStore } from 'react';
import { createSeed } from '@/lib/data/admin';

function subscribe(callback: () => void) {
  window.addEventListener('tendly:db-changed', callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener('tendly:db-changed', callback);
    window.removeEventListener('storage', callback);
  };
}

export function readShopOwnerName(): string {
  try {
    const raw = localStorage.getItem('tendly.mockdb');
    if (!raw) return '';
    const db = JSON.parse(raw);
    if (typeof db.shop?.ownerName === 'string') return db.shop.ownerName.trim();
    const owner = db.members?.find((m: { role: string; status: string }) => m.role === 'owner' && m.status === 'active');
    const seedOwner = createSeed().members.find((m) => m.role === 'owner');
    // Existing settings can still contain seeded demo members; do not present them as an account.
    return typeof owner?.name === 'string' && (owner.name !== seedOwner?.name || owner.email !== seedOwner?.email)
      ? owner.name.trim() : '';
  } catch { return ''; }
}

export function useShopOwnerName() {
  return useSyncExternalStore(subscribe, readShopOwnerName, () => '');
}
