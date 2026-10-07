import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../../../components/Modal';
import { Switch } from '../../../components/Switch';
import { errorMessage, useToast } from '../../../components/Toast';
import { channelApi } from '../../../services/api';
import type { Channel } from '../../../types';

const ICON_TEXT: Record<Channel['id'], string> = { messenger: 'f', zalo: 'Z', tiktok: 'T' };
const EMPTY_DESC: Record<Channel['id'], string> = {
  messenger: 'Chưa liên kết Fanpage',
  zalo: 'Chưa liên kết tài khoản',
  tiktok: 'Tin nhắn & bình luận video',
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
            return (
              <div key={c.id} className={`channel-card${c.comingSoon ? ' disabled' : ''}${c.connected && !c.enabled ? ' paused' : ''}`}>
                <div className="channel-top">
                  <div className={`channel-icon ic-${c.id}`}>{ICON_TEXT[c.id]}</div>
                  <div>
                    <div className="channel-name">{c.name}</div>
                    <div className="channel-desc">{c.account ?? EMPTY_DESC[c.id]}</div>
                  </div>
                </div>

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
                          label={`Bật/tắt ${c.name}`}
                          onChange={(v) => run(c.id, () => channelApi.setEnabled(c.id, v), (r) => `${r.name}: ${v ? 'đã bật lại' : 'đã tạm dừng'}`)}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="status"><span className="dot" />{isBusy ? 'Đang kết nối...' : 'Chưa kết nối'}</div>
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={isBusy}
                        onClick={() => run(c.id, () => channelApi.connect(c.id), (r) => `Đã kết nối ${r.name} thành công 🎉`)}
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
        title={`Ngắt kết nối ${toDisconnect?.name ?? ''}?`}
        message="Tin nhắn mới từ kênh này sẽ không còn về Hộp thoại và AI sẽ ngừng trả lời tự động trên kênh này."
        confirmLabel="Ngắt kết nối"
        busy={!!toDisconnect && busy === toDisconnect.id}
        onClose={() => setToDisconnect(null)}
        onConfirm={async () => {
          const c = toDisconnect!;
          await run(c.id, () => channelApi.disconnect(c.id), (r) => `Đã ngắt kết nối ${r.name}`);
          setToDisconnect(null);
        }}
      />
    </>
  );
}
