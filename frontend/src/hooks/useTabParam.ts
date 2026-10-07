import { useSearchParams } from 'react-router-dom';

/** Tab đang chọn được lưu trên URL (?tab=...) để reload / chia sẻ link vẫn đúng tab */
export function useTabParam<T extends string>(tabs: readonly T[], fallback: T): [T, (tab: T) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab') as T | null;
  const current = raw && tabs.includes(raw) ? raw : fallback;
  const setTab = (tab: T) => setParams({ tab }, { replace: true });
  return [current, setTab];
}
