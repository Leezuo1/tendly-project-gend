'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** Tab đang chọn được lưu trên URL (?tab=...) để reload / chia sẻ link vẫn đúng tab */
export function useTabParam<T extends string>(tabs: readonly T[], fallback: T): [T, (tab: T) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get('tab') as T | null;
  const current = raw && tabs.includes(raw) ? raw : fallback;
  const setTab = (tab: T) => router.replace(`${pathname}?tab=${tab}`, { scroll: false });
  return [current, setTab];
}
