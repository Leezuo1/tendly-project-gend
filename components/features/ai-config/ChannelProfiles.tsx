'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useToast } from '@/components/shared/ToastProvider';
import { marketingWorkspaceClient } from '@/lib/services/marketingWorkspaceClient';
import { emptyMarketingProfile } from '@/lib/services/marketingBrief';
import type { MarketingProfile, MarketingWorkspaceView } from '@/lib/types/marketingWorkspace';
import styles from './ai-configuration.module.css';

const LABELS: Record<keyof MarketingProfile, string> = { name: 'Tên tài khoản', purpose: 'Vai trò của kênh', audience: 'Đối tượng chính', pain: 'Nhu cầu / rào cản', address: 'Cách xưng hô', tone: 'Giọng văn', approach: 'Cách tiếp cận', format: 'Định dạng ưu tiên', cta: 'CTA mặc định', avoid: 'Từ / tuyên bố cần tránh', examples: 'Ví dụ đúng giọng đã được duyệt' };

/** Hồ sơ từng tài khoản đăng (Fanpage, kênh mẫu). Lưu trong workspace Marketing; sửa hồ sơ đưa brief liên quan về chờ duyệt. */
export function ChannelProfiles() {
  const [view, setView] = useState<MarketingWorkspaceView | null>(null);
  const [accountId, setAccountId] = useState('');
  const [profile, setProfile] = useState<MarketingProfile | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const select = (next: MarketingWorkspaceView, id: string) => {
    const account = next.accounts.find(item => item.id === id) ?? next.accounts[0];
    setView(next); setAccountId(account?.id ?? '');
    setProfile(account ? next.workspace.profiles[account.id] ?? { ...emptyMarketingProfile(), name: account.name } : null);
  };
  const load = useCallback(async () => {
    try { select(await marketingWorkspaceClient.read(), ''); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa tải được hồ sơ kênh.'); }
  }, []);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);

  const saved = view && accountId ? view.workspace.profiles[accountId] ?? { ...emptyMarketingProfile(), name: view.accounts.find(item => item.id === accountId)?.name ?? '' } : null;
  const dirty = !!profile && JSON.stringify(profile) !== JSON.stringify(saved);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function apply() {
    if (!view || !profile || busy) return;
    setBusy(true);
    try { select(await marketingWorkspaceClient.act(view.revision, 'profile', { accountId, profile }), accountId); setError(''); toast('Đã lưu hồ sơ kênh'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa lưu được hồ sơ kênh.'); }
    finally { setBusy(false); setConfirming(false); }
  }

  return <div className={styles.root}>
    {error && <div className={styles.error} role="alert">{error} <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => void load()}>Tải lại</button></div>}
    {!view && !error && <p className={styles.loading} role="status">Đang tải hồ sơ kênh…</p>}
    {view && profile && <form onSubmit={(event: FormEvent) => { event.preventDefault(); setConfirming(true); }}><fieldset className={styles.fieldset} disabled={busy}><div className={styles.settings}>
      <div className={styles.selectors}><div><label htmlFor="channel-account">Tài khoản đăng</label>
        <select id="channel-account" value={accountId} onChange={event => { if (dirty) setError('Lưu hoặc hủy hồ sơ đang chỉnh trước khi đổi tài khoản.'); else select(view, event.target.value); }}>
          {view.accounts.map(account => <option key={account.id} value={account.id}>{view.workspace.profiles[account.id]?.name || account.name}{account.mock ? ' (kênh mẫu)' : ''}</option>)}
        </select></div></div>
      <section className={styles.editor}><div className={styles.formBody}>
        <p className={styles.ruleHint}>Mỗi tài khoản có đối tượng và giọng riêng. Thứ tự áp dụng: thiết lập chung của Tendly → cấu hình AI của Page → hồ sơ kênh → brief. Sửa hồ sơ sẽ đưa brief liên quan về chờ duyệt.</p>
        {(Object.keys(LABELS) as (keyof MarketingProfile)[]).map(key => <div className={styles.ruleField} key={key}>
          <label htmlFor={`channel-${key}`}>{LABELS[key]}</label>
          <textarea id={`channel-${key}`} rows={2} maxLength={1500} required={key === 'name' || key === 'tone'} value={profile[key]} onChange={event => setProfile({ ...profile, [key]: event.target.value })} />
        </div>)}
      </div></section>
      <footer className={styles.saveBar}><p aria-live="polite">{busy ? 'Đang lưu…' : dirty ? 'Có thay đổi chưa lưu' : 'Đã lưu'}</p>
        <button className="btn btn-outline" type="button" disabled={!dirty} onClick={() => setProfile(saved)}>Hủy thay đổi</button>
        <button className="btn btn-primary" type="submit" disabled={!dirty}>Lưu hồ sơ kênh</button></footer>
    </div></fieldset></form>}
    <ConfirmDialog open={confirming} busy={busy} title="Áp dụng hồ sơ kênh?" message="Brief liên quan sẽ quay về chờ duyệt. Bài và lịch không tự thay nội dung theo hồ sơ mới." confirmLabel="Áp dụng" onClose={() => setConfirming(false)} onConfirm={() => void apply()} />
  </div>;
}
