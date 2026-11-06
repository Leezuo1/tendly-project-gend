'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useToast } from '@/components/shared/ToastProvider';
import { dashboardRequest } from '@/lib/services/postsClient';
import { AI_ROLES, AI_PLATFORMS, GLOBAL_AI_FIELDS, ROLE_PLATFORMS,
  type AiPlatform, type AiRoleId, type GlobalAiConfiguration, type GlobalAiField } from '@/lib/services/aiConfiguration';
import styles from './ai-configuration.module.css';

const KEYS = Object.keys(GLOBAL_AI_FIELDS) as GlobalAiField[];

/** Admin: thiết lập nền (mô tả, lĩnh vực, vai trò, quy định, từ cấm) cho từng AI và từng nền tảng. */
export function GlobalAiSettings() {
  const [config, setConfig] = useState<GlobalAiConfiguration | null>(null);
  const [saved, setSaved] = useState('');
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<AiRoleId>('chat');
  const [platform, setPlatform] = useState<AiPlatform | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const apply = (data: { configuration: GlobalAiConfiguration; revision: number }) => {
    setConfig(data.configuration); setSaved(JSON.stringify(data.configuration)); setRevision(data.revision); setError('');
  };
  const load = useCallback(async () => {
    try { apply(await (await dashboardRequest('/api/admin/ai-settings')).json()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa tải được cấu hình AI chung.'); }
  }, []);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);

  const dirty = !!config && JSON.stringify(config) !== saved;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !config) return;
    setSaving(true);
    try {
      apply(await (await dashboardRequest('/api/admin/ai-settings', { method: 'PUT', body: JSON.stringify({ configuration: config, revision }) })).json());
      toast('Đã lưu cấu hình AI chung');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa lưu được cấu hình. Vui lòng thử lại.'); }
    finally { setSaving(false); }
  }

  const profile = config?.profiles[selected];
  const setField = (key: GlobalAiField, value: string) => setConfig(current => {
    if (!current) return current;
    const target = current.profiles[selected];
    const next = platform ? { ...target, platforms: { ...target.platforms, [platform]: { ...target.platforms[platform], [key]: value } } }
      : { ...target, base: { ...target.base, [key]: value } };
    return { ...current, profiles: { ...current.profiles, [selected]: next } };
  });

  return <div className={styles.root}>
    <div className="page-head"><div><h2>Cấu hình AI chung</h2><p>Thiết lập vai trò cơ bản cho từng AI. Chi tiết vận hành do từng shop chỉnh trong Cấu hình AI.</p></div></div>
    {error && <div className={styles.error} role="alert">{error} <button type="button" className="btn btn-outline btn-sm" disabled={saving} onClick={() => void load()}>Tải lại</button></div>}
    {!config && !error && <p className={styles.loading} role="status">Đang tải thiết lập…</p>}
    {profile && <form onSubmit={save}><fieldset className={styles.fieldset} disabled={saving}><div className={styles.settings}>
      <div className={styles.selectors}>
        <div><label htmlFor="global-ai">Chọn AI</label><select id="global-ai" value={selected} onChange={event => { setSelected(event.target.value as AiRoleId); setPlatform(''); }}>{AI_ROLES.map(role => <option key={role.id} value={role.id}>{role.label}</option>)}</select></div>
        {ROLE_PLATFORMS[selected].length > 0 && <div><label htmlFor="global-platform">Áp dụng cho</label><select id="global-platform" value={platform} onChange={event => setPlatform(event.target.value as AiPlatform | '')}><option value="">Mọi nền tảng</option>{ROLE_PLATFORMS[selected].map(item => <option key={item} value={item}>{AI_PLATFORMS[item]}</option>)}</select></div>}
      </div>
      <section className={styles.editor}><div className={styles.formBody}>
        {platform && <p className={styles.ruleHint}>Để trống mục nào thì {AI_PLATFORMS[platform]} dùng thiết lập chung của mục đó.</p>}
        {KEYS.map(key => <div className={styles.ruleField} key={key}>
          <label htmlFor={`global-${key}`}>{GLOBAL_AI_FIELDS[key]}</label>
          <textarea id={`global-${key}`} rows={key === 'rules' ? 5 : 2} maxLength={2000} required={!platform && key !== 'forbidden'}
            placeholder={platform ? profile.base[key] : key === 'forbidden' ? 'Mỗi từ cách nhau bằng dấu phẩy' : undefined}
            value={(platform ? profile.platforms[platform]?.[key] : profile.base[key]) ?? ''} onChange={event => setField(key, event.target.value)} />
        </div>)}
      </div></section>
      <footer className={styles.saveBar}><p aria-live="polite">{saving ? 'Đang lưu…' : dirty ? 'Có thay đổi chưa lưu' : 'Đã lưu'}</p><button className="btn btn-primary" type="submit" disabled={saving || !dirty}>Lưu thiết lập</button></footer>
    </div></fieldset></form>}
  </div>;
}
