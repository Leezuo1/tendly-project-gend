'use client';

import { useSyncExternalStore } from 'react';

const query = '(max-width: 880px)';
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};

export function useMobileViewport(): boolean | null {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => null);
}
