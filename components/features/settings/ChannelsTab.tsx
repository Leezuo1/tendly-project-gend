'use client';

import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { errorMessage, useToast } from '@/components/shared/ToastProvider';
import { channelApi } from '@/lib/services/api';
import type { Channel } from '@/lib/types/admin';

const ICON_TEXT: Record<Channel['id'], string> = { messenger: 'f', zalo: 'Z', tiktok: 'T' };
const CHANNEL_NAMES: Record<Channel['id'], string> = { messenger: 'Facebook', zalo: 'Zalo OA', tiktok: 'TikTok Shop' };
// shortcut: sample accounts for the channel mockup, replace when multi-account connections are available.
const SAMPLE_ACCOUNTS: Record<Channel['id'], string[]> = {
  messenger: ['Fanpage Tendly', 'Tendly Studio'],
  zalo: ['Tendly Official', 'Tendly Chăm sóc khách hàng'],
  tiktok: ['@tendly', '@tendly.studio'],
};

export function ChannelsTab() {
  const toast = useToast();
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [busy, setBusy] = useState<Channel['id'] | null>(null);
  const [toDisconnect, setToDisconnect] = useState<Channel | null>(null);

  useEffect(() => { channelApi.list().then(setChannels); }, []);

  const replace = (c: Channel) => setChannels((prev) => prev!.map((x) => (x.id === c.id ? c : x)));

  const run = async (id: Channel['id'], action: () => Promise<Channel>, success: (c: Channel) => string) => {
    setBusy(id);
    try {
      const c = await action();
      replace(c);
      toast(success(c));
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };

  if (!channels) return <div className="card"><div className="skeleton" style={{ height: 260 }} /></div>;

  const activeCount = channels.filter((c) => c.connected && c.enabled).length;

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>Kênh kết nối</h2>
          <span className="hint">{activeCount} đang hoạt động</span>
        </div>
        <div className="channel-grid">
          {channels.map((c) => {
            const isBusy = busy === c.id;
            const name = CHANNEL_NAMES[c.id];
            const accounts = [...new Set([c.account ?? SAMPLE_ACCOUNTS[c.id][0], ...SAMPLE_ACCOUNTS[c.id].slice(1)])];
            return (
              <div key={c.id} className={`channel-card${c.comingSoon ? ' disabled' : ''}${c.connected && !c.enabled ? ' paused' : ''}`}>
                <div className="channel-top">
                  <div className={`channel-icon ic-${c.id}`}>{ICON_TEXT[c.id]}</div>
                  <div>
                    <div className="channel-name">{name}</div>
                    <div className="channel-desc">{accounts.length} {c.id === 'messenger' ? 'Fanpage' : 'tài khoản'}</div>
                  </div>
                </div>

                <ul className="channel-accounts" aria-label={`Trang và tài khoản ${name}`}>
                  {accounts.map(account => <li key={account}>
                    <span className="channel-account-avatar" aria-hidden="true">{account.slice(0, 1).toUpperCase()}</span>
                    <div><strong>{account}</strong><span>{c.id === 'messenger' ? 'Fanpage Facebook' : c.id === 'zalo' ? 'Zalo Official Account' : 'Tài khoản TikTok'}</span></div>
                  </li>)}
                </ul>

                <div className="channel-status">
                  {c.comingSoon ? (
                    <span className="soon-tag">Sắp ra mắt</span>
                  ) : c.connected ? (
                    <>
                      <div className="status">
                        <span className={`dot ${c.enabled ? 'dot-on' : 'dot-pending'}`} />
                        {c.enabled ? 'Đã kết nối' : 'Tạm dừng nhận tin'}
                      </div>
                      <div className="channel-controls">
                        <button className="btn btn-text btn-sm" onClick={() => setToDisconnect(c)} disabled={isBusy}>Ngắt kết nối</button>
                        <Switch
                          checked={c.enabled}
                          disabled={isBusy}
                          label={`Bật/tắt ${name}`}
                          onChange={(v) => run(c.id, () => channelApi.setEnabled(c.id, v), () => `${name}: ${v ? 'đã bật lại' : 'đã tạm dừng'}`)}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="status"><span className="dot" />{isBusy ? 'Đang kết nối...' : 'Chưa kết nối'}</div>
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={isBusy}
                        onClick={() => run(c.id, () => channelApi.connect(c.id), () => `Đã kết nối ${name} thành công 🎉`)}
                      >
                        {isBusy && <span className="spinner" />}
                        Kết nối
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="channel-note">
        Tin nhắn từ các kênh đã kết nối sẽ tự động gom về chung 1 Hộp thoại, kèm gợi ý ưu tiên và trả lời tự động.
      </div>

      <ConfirmDialog
        open={!!toDisconnect}
        title={`Ngắt kết nối ${toDisconnect ? CHANNEL_NAMES[toDisconnect.id] : ''}?`}
        message="Tin nhắn mới từ kênh này sẽ không còn về Hộp thoại và AI sẽ ngừng trả lời tự động trên kênh này."
        confirmLabel="Ngắt kết nối"
        busy={!!toDisconnect && busy === toDisconnect.id}
        onClose={() => setToDisconnect(null)}
        onConfirm={async () => {
          const c = toDisconnect!;
          await run(c.id, () => channelApi.disconnect(c.id), () => `Đã ngắt kết nối ${CHANNEL_NAMES[c.id]}`);
          setToDisconnect(null);
        }}
      />
    </>
  );
}
