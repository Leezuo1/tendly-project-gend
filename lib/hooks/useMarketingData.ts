'use client';

import { useCallback, useEffect, useState } from 'react';

interface LoadState<T> {
  data?: T;
  error?: unknown;
  loading: boolean;
}

/** Tải dữ liệu một lần khi mở tab; reload() để tải lại (sau khi nhập mã quản trị, bấm Thử lại...). */
export function useMarketingData<T>(load: () => Promise<T>) {
  const [state, setState] = useState<LoadState<T>>({ loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => { if (!cancelled) setState({ data, loading: false }); },
      (error: unknown) => { if (!cancelled) setState({ error, loading: false }); },
    );
    return () => { cancelled = true; };
  }, [load, version]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    setVersion((v) => v + 1);
  }, []);

  return { ...state, reload };
}
