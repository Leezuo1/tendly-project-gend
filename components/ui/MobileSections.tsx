'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useMobileViewport } from '@/lib/hooks/useMobileViewport';
import { IconChevrons } from './Icons';
import styles from './mobile-sections.module.css';

interface Props {
  title: string;
  menuHeading?: boolean;
  items: { key: string; label: string; content: ReactNode }[];
  initialKey?: string;
  activeKey?: string | null;
  onSelect?: (key: string) => void;
  onBack?: () => void;
  children: ReactNode;
}

export function MobileSections({ title, menuHeading, items, initialKey, activeKey, onSelect, onBack, children }: Props) {
  const mobile = useMobileViewport();
  const router = useRouter();
  const backButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  const initial = items.some(item => item.key === initialKey) ? initialKey! : null;
  const [view, setView] = useState({ active: initial, visited: initial ? [initial] : [] });
  const selectedKey = activeKey === undefined ? view.active : activeKey;
  useEffect(() => { if (mobile && selectedKey) backButton.current?.focus(); }, [mobile, selectedKey]);
  if (activeKey && !view.visited.includes(activeKey)) setView(previous => ({ ...previous, visited: [...previous.visited, activeKey] }));
  if (mobile === null) return <p role="status">Đang mở…</p>;
  if (!mobile) return children;
  const selected = items.find(item => item.key === selectedKey);
  return <section className={styles.root} aria-label={title}>
    {!selected && menuHeading && <h1 className="mobile-page-title">{title}</h1>}
    {!selected && <nav ref={menu} className={styles.menu} aria-label={`Các mục ${title}`}>
      {items.map(item => <button key={item.key} type="button" onClick={() => {
        setView(previous => ({ active: item.key, visited: previous.visited.includes(item.key) ? previous.visited : [...previous.visited, item.key] }));
        onSelect?.(item.key);
      }}><span>{item.label}</span><IconChevrons aria-hidden="true" width="20" height="20" /></button>)}
    </nav>}
    {selected && <header className={styles.header}><button ref={backButton} type="button" aria-label={`Quay lại các mục ${title}`} onClick={() => {
      setView(previous => ({ ...previous, active: null }));
      onBack?.();
      const url = new URL(window.location.href);
      if (url.searchParams.has('tab')) { url.searchParams.delete('tab'); router.replace(url.pathname + url.search, { scroll: false }); }
      requestAnimationFrame(() => menu.current?.querySelector('button')?.focus());
    }}><IconChevrons aria-hidden="true" width="20" height="20" style={{ transform: 'rotate(180deg)' }} /></button><h2>{selected.label}</h2></header>}
    {items.filter(item => view.visited.includes(item.key)).map(item => <div key={item.key} hidden={selectedKey !== item.key}>{item.content}</div>)}
  </section>;
}
