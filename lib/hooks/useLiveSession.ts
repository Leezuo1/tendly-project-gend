'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { liveClient } from '@/lib/services/liveClient';
import type { LiveSnapshot } from '@/lib/types/live';

const POLL_MS = 3000;

/**
 * Mỗi phiên live chỉ có MỘT vòng cập nhật dùng chung cho mọi nơi đang xem
 * (trang Livestream, dashboard, cửa sổ nổi) — không gọi sync trùng nhau.
 * Cửa sổ nổi (Document Picture-in-Picture) chạy cùng JS với trang mở nó nên dùng chung được store này.
 */
interface SessionState {
  snapshot: LiveSnapshot | null;
  error: unknown;
  /** Người bán bấm tạm dừng: ngừng kéo bình luận mới (dữ liệu cũ vẫn hiển thị). Dùng chung cho mọi cửa sổ. */
  paused: boolean;
}

interface Store {
  state: SessionState;
  listeners: Set<() => void>;
  timer?: ReturnType<typeof setTimeout>;
  run: number;
}

const stores = new Map<string, Store>();
/** Cửa sổ phụ đang hiển thị dữ liệu live (cửa sổ nổi) — còn mở thì vẫn cập nhật dù tab chính bị ẩn. */
const surfaces = new Set<Window>();

export function registerLiveSurface(win: Window) {
  surfaces.add(win);
  return () => { surfaces.delete(win); };
}

function anySurfaceVisible() {
  if (!document.hidden) return true;
  for (const w of surfaces) if (!w.closed && !w.document.hidden) return true;
  return false;
}

function notify(store: Store) {
  for (const l of store.listeners) l();
}

function start(id: string, store: Store) {
  const run = ++store.run;
  if (store.timer) clearTimeout(store.timer);
  const tick = async (first: boolean) => {
    if (run !== store.run) return;
    if (!first && (store.state.paused || !anySurfaceVisible())) {
      store.timer = setTimeout(() => void tick(false), POLL_MS);
      return;
    }
    let live = true;
    try {
      const next = first ? await liveClient.snapshot(id) : await liveClient.sync(id);
      if (run !== store.run) return;
      store.state = { ...store.state, snapshot: next, error: null };
      live = next.session.status === 'live';
    } catch (error) {
      if (run !== store.run) return;
      store.state = { ...store.state, error };
    }
    notify(store);
    if (live) store.timer = setTimeout(() => void tick(false), first ? 0 : POLL_MS);
  };
  void tick(true);
}

function storeFor(id: string): Store {
  let store = stores.get(id);
  if (!store) {
    store = { state: { snapshot: null, error: null, paused: false }, listeners: new Set(), run: 0 };
    stores.set(id, store);
  }
  return store;
}

function subscribe(id: string, listener: () => void) {
  const store = storeFor(id);
  store.listeners.add(listener);
  if (store.listeners.size === 1) start(id, store);
  return () => {
    store.listeners.delete(listener);
    if (!store.listeners.size) {
      store.run++;
      if (store.timer) clearTimeout(store.timer);
    }
  };
}

const EMPTY: SessionState = { snapshot: null, error: null, paused: false };
const noop = () => () => {};

/**
 * Dữ liệu của 1 phiên live cho dashboard. Đang live: gọi sync, chờ 3 giây sau khi request trước xong rồi gọi tiếp,
 * tạm dừng khi không còn chỗ nào đang hiển thị (tab ẩn và không có cửa sổ nổi). Phiên đã kết thúc: tải snapshot 1 lần.
 * `setPaused(true)` ngừng kéo bình luận mới cho tới khi bỏ tạm dừng.
 * `apply(snapshot)` cập nhật ngay sau các thao tác (đổi mẫu lên sóng, duyệt nhóm...) trả về snapshot mới.
 */
export function useLiveSession(sessionId: string | null) {
  const state = useSyncExternalStore(
    useCallback((l: () => void) => (sessionId ? subscribe(sessionId, l) : noop()), [sessionId]),
    () => (sessionId ? storeFor(sessionId).state : EMPTY),
    () => EMPTY,
  );
  const apply = useCallback((next: LiveSnapshot) => {
    const store = storeFor(next.session.id);
    store.state = { ...store.state, snapshot: next, error: null };
    notify(store);
  }, []);
  const setPaused = useCallback((paused: boolean) => {
    if (!sessionId) return;
    const store = storeFor(sessionId);
    store.state = { ...store.state, paused };
    notify(store);
  }, [sessionId]);
  const reload = useCallback(() => {
    if (!sessionId) return;
    const store = storeFor(sessionId);
    if (store.listeners.size) start(sessionId, store);
  }, [sessionId]);
  return { snapshot: state.snapshot, error: state.error, paused: state.paused, setPaused, apply, reload };
}
