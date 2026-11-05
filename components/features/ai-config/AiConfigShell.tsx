'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Tabs } from '@/components/ui/Tabs';
import { Switch } from '@/components/ui/Switch';
import { IconChat, IconEdit, IconSearch, IconSpark } from '@/components/ui/Icons';
import { useToast } from '@/components/shared/ToastProvider';
import { useTabParam } from '@/lib/hooks/useTabParam';
import { useAppSecurity } from '@/lib/hooks/useAppSecurity';
import { useMockDbVersion } from '@/lib/hooks/useMockDbVersion';
import { readDb } from '@/lib/services/mockDb';
import { AI_MODES, AI_ROLES, AI_SOURCES, defaultAiConfiguration, readAiConfiguration, saveAiConfiguration,
  type AiConfiguration, type AiMode, type AiProfile, type AiRoleId } from '@/lib/services/aiConfiguration';
import styles from './ai-configuration.module.css';

const TABS = [{ key: 'agents', label: 'Vai trò AI' }, { key: 'knowledge', label: 'Tri thức chung' }, { key: 'channels', label: 'Gán Fanpage' }] as const;
const ROLE_ICONS = { content: IconEdit, chat: IconChat, review: IconSpark, sourcing: IconSearch, livestream: IconChat };

export function AiConfigShell() {
  const [tab, setTab] = useTabParam(TABS.map(t => t.key), 'agents');
  const [selected, setSelected] = useState<AiRoleId>('content');
  const [config, setConfig] = useState<AiConfiguration>(defaultAiConfiguration);
  const [saved, setSaved] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const { session } = useAppSecurity();
  const owner = session.userId || session.username;
  const toast = useToast();
  const dbVersion = useMockDbVersion();
  const knowledge = dbVersion < 0 ? null : readDb();
  const role = AI_ROLES.find(r => r.id === selected)!;
  const profile = config.profiles[selected];
  const dirty = ready && JSON.stringify(config) !== saved;

  const load = useCallback(() => {
    try {
      const value = readAiConfiguration(owner);
      setConfig(value); setSaved(JSON.stringify(value)); setReady(true); setError('');
    } catch { setError('Chưa đọc được bản thiết lập đã lưu. Hãy cho phép lưu trữ trình duyệt và thử lại; dữ liệu cũ chưa bị thay đổi.'); }
  }, [owner]);
  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function updateProfile(patch: Partial<AiProfile>) {
    setConfig(current => ({ ...current, profiles: { ...current.profiles, [selected]: { ...current.profiles[selected], ...patch } } }));
  }
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const value = saveAiConfiguration(config, owner);
      setConfig(value); setSaved(JSON.stringify(value)); setError(''); toast('Đã lưu bản thiết lập trên trình duyệt này.', 'success');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa lưu được thiết lập. Vui lòng thử lại.'); }
  }

  return <div className={styles.root}>
    <div className="page-head"><div><h1>Cấu hình AI</h1><p>Thiết lập cách năm vai trò AI phối hợp cùng shop.</p></div><div className={styles.headerActions}><Link className="btn btn-outline" href="/cai-dat?tab=faq">FAQ & sản phẩm</Link><button className="btn btn-primary" form="ai-profile-settings" type="submit" disabled={!ready || !dirty}>Lưu thiết lập</button></div></div>
    <Tabs tabs={[...TABS]} active={tab} onChange={setTab} />
    {error && <div className={styles.error} role="alert">{error} {!ready && <button type="button" className="btn btn-outline btn-sm" onClick={load}>Thử đọc lại</button>}</div>}
    {!ready && !error && <p role="status" className={styles.loading}>Đang đọc bản thiết lập…</p>}
    <form id="ai-profile-settings" onSubmit={save}>
      <fieldset disabled={!ready} className={styles.fieldset}>
        {tab === 'agents' && <div className={styles.workspace}>
          <aside className={styles.roles} aria-label="Chọn vai trò AI">
            <h2>Năm vai trò của shop</h2><p>Mỗi vai trò có nhiệm vụ và giới hạn riêng.</p>
            <div className={styles.roleList}>{AI_ROLES.map(item => {
              const Icon = ROLE_ICONS[item.id];
              return <button key={item.id} type="button" className={`${styles.roleButton} ${selected === item.id ? styles.selected : ''}`}
                aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
                <Icon width={19} height={19} aria-hidden="true" />
                <span><strong>{item.label}</strong><small>{config.profiles[item.id].enabled ? 'Đã bật trong bản thiết lập' : 'Chưa bật trong bản thiết lập'}</small></span>
              </button>;
            })}</div>
            <div className={styles.workflow}><h3>Cùng một nguồn tri thức</h3><p>Content soạn → Review kiểm tra → shop duyệt. Chat và Live dùng sản phẩm, FAQ để tư vấn.</p><Link href="/cai-dat?tab=faq">Mở nguồn tri thức</Link></div>
          </aside>
          <section className={styles.editor} aria-labelledby="agent-heading">
            <header className={styles.editorHead}><div><h2 id="agent-heading">{role.label}</h2><p>{role.description}</p></div><Switch checked={profile.enabled} label={`Dùng ${role.label} trong bản thiết lập`} onChange={enabled => updateProfile({ enabled })} /></header>
            <div className={styles.formBody}>
              <div className={styles.pair}>
                <label htmlFor="agent-name">Tên profile<input id="agent-name" value={profile.name} maxLength={100} required onChange={e => updateProfile({ name: e.target.value })} /></label>
                <label htmlFor="agent-mode">Mức tự động hóa<select id="agent-mode" value={profile.mode} onChange={e => updateProfile({ mode: e.target.value as AiMode })}>
                  {Object.entries(AI_MODES).filter(([key]) => selected === 'chat' || key !== 'auto').map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select></label>
              </div>
              <label htmlFor="agent-goal">Mục tiêu<textarea id="agent-goal" rows={3} value={profile.goal} maxLength={1500} required onChange={e => updateProfile({ goal: e.target.value })} /></label>
              <label htmlFor="agent-tone">Văn phong<input id="agent-tone" value={profile.tone} maxLength={500} required onChange={e => updateProfile({ tone: e.target.value })} /></label>
              <div className={styles.pair}>
                <label htmlFor="agent-input">Input — dữ liệu đầu vào<textarea id="agent-input" rows={4} value={profile.input} maxLength={1500} required onChange={e => updateProfile({ input: e.target.value })} /></label>
                <label htmlFor="agent-output">Output — kết quả cần trả<textarea id="agent-output" rows={4} value={profile.output} maxLength={1500} required onChange={e => updateProfile({ output: e.target.value })} /></label>
              </div>
              <fieldset className={styles.sources}><legend>Nguồn tri thức được dùng</legend><div>{role.sources.map(source => <label key={source}>
                <input type="checkbox" checked={profile.sources.includes(source)} onChange={e => updateProfile({ sources: e.target.checked ? [...profile.sources, source] : profile.sources.filter(s => s !== source) })} />{AI_SOURCES[source]}
              </label>)}</div><p>Nguồn theo campaign, thị trường và phiên làm việc cần được cung cấp ở đúng luồng tương ứng.</p></fieldset>
              <label htmlFor="agent-instructions">Chỉ dẫn bổ sung <span className={styles.optional}>(không bắt buộc)</span><textarea id="agent-instructions" rows={3} value={profile.instructions} maxLength={2000} placeholder="Ví dụ: ưu tiên hỏi lại mã sản phẩm khi có nhiều mẫu tương tự." onChange={e => updateProfile({ instructions: e.target.value })} /></label>
              <div className={styles.guard}><h3>Giới hạn của vai trò</h3><p>{role.guard}</p><p>Chỉ dẫn bổ sung không thay thế dữ kiện sản phẩm, quyền phê duyệt hoặc điều kiện gửi của nền tảng.</p></div>
            </div>
          </section>
        </div>}
        {tab === 'knowledge' && <section className={styles.knowledge} aria-labelledby="knowledge-heading">
          <div className={styles.sectionIntro}><h2 id="knowledge-heading">Tri thức chung của shop</h2><p>Quản lý các nguồn tại Cài đặt. Chọn nguồn cho từng vai trò ở tab Vai trò AI.</p></div>
          <div className={styles.knowledgeList}>
            <div><div><h3>Sản phẩm</h3><p>Tên, SKU, giá, chất liệu, màu, size và tồn kho tổng.</p></div><span>{knowledge ? `${knowledge.products.length} sản phẩm` : 'Đang đọc…'}</span><Link href="/cai-dat?tab=products">Quản lý sản phẩm</Link></div>
            <div><div><h3>FAQ & chính sách</h3><p>Chỉ những câu hỏi đang bật được cung cấp cho AI hiện tại.</p></div><span>{knowledge ? `${knowledge.faqs.filter(f => f.active).length} FAQ đang bật` : 'Đang đọc…'}</span><Link href="/cai-dat?tab=faq">Quản lý FAQ</Link></div>
            <div><div><h3>Thông tin shop</h3><p>Tên và thông tin liên hệ đã lưu trong Cài đặt.</p></div><span>{knowledge?.shop.name || 'Chưa có tên shop'}</span><Link href="/cai-dat">Mở Cài đặt</Link></div>
            <div><div><h3>Kịch bản email</h3><p>Mẫu tham khảo hiện có; trạng thái bật không chứng minh email đã được gửi.</p></div><span>{knowledge ? `${knowledge.triggers.filter(t => t.enabled).length} kịch bản đang bật` : 'Đang đọc…'}</span><Link href="/cai-dat?tab=email">Quản lý kịch bản</Link></div>
          </div>
          <p className={styles.footnote}>Sản phẩm và FAQ ở đây dùng dữ liệu đang lưu trên trình duyệt này.</p>
        </section>}
        {tab === 'channels' && <section className={styles.channels} aria-labelledby="channel-heading">
          <div className={styles.sectionIntro}><h2 id="channel-heading">Gán AI hội thoại cho Fanpage</h2><p>Thử thiết lập một Page với profile Chat. Bốn vai trò còn lại hỗ trợ các công việc riêng của shop.</p></div>
          <div className={styles.channelGrid}>
            <div className={styles.channelForm}>
              <label htmlFor="binding-page">Tên Fanpage minh họa<input id="binding-page" maxLength={200} value={config.binding.pageName} placeholder="Nhập tên Page để thử thiết lập" required={config.binding.enabled} onChange={e => setConfig(c => ({ ...c, binding: { ...c.binding, pageName: e.target.value } }))} /></label>
              <label htmlFor="binding-profile">Profile AI hội thoại<select id="binding-profile" defaultValue="chat"><option value="chat">{config.profiles.chat.name}</option></select></label>
              <label htmlFor="binding-mode">Mode mặc định của hội thoại<select id="binding-mode" value={config.binding.mode} onChange={e => setConfig(c => ({ ...c, binding: { ...c.binding, mode: e.target.value as AiMode } }))}>{Object.entries(AI_MODES).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
              <div className={styles.switchRow}><div><strong>Dùng AI cho Page trong bản thiết lập</strong><p>Tắt Page sẽ ưu tiên hơn mode riêng của hội thoại.</p></div><Switch label="Dùng AI cho Page trong bản thiết lập" checked={config.binding.enabled} onChange={enabled => setConfig(c => ({ ...c, binding: { ...c.binding, enabled } }))} /></div>
              <p className={styles.footnote}>Đây là Page minh họa, chưa liên kết với Page thật. <Link href="/cai-dat?tab=channels">Xem trạng thái kết nối kênh</Link>.</p>
            </div>
            <div className={styles.channelRules}><h3>Thứ tự kiểm soát dự kiến</h3><ol><li>Quyền truy cập và bảo vệ app</li><li>Vai trò Chat và công tắc AI của Page</li><li>Mode riêng của từng hội thoại</li><li>Dữ liệu đủ căn cứ và điều kiện gửi</li></ol><p><strong>{config.binding.enabled && config.profiles.chat.enabled ? 'Đã bật trong bản thiết lập.' : 'Tự động hóa đang tắt trong bản thiết lập.'}</strong></p><p>Các lựa chọn này chỉ mô phỏng. Chế độ gửi tin thật được quản lý tại Hộp thoại.</p></div>
          </div>
        </section>}
        <footer className={styles.saveBar}><p aria-live="polite">{dirty ? 'Có thay đổi chưa lưu' : config.updatedAt ? 'Đã lưu trên trình duyệt này' : 'Chưa lưu bản thiết lập'}</p><button className="btn btn-primary" type="submit" disabled={!ready || !dirty}>Lưu thiết lập</button></footer>
      </fieldset>
    </form>
  </div>;
}
