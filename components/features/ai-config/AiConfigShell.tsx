'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs } from '@/components/ui/Tabs';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/shared/ToastProvider';
import { useTabParam } from '@/lib/hooks/useTabParam';
import { useAppSecurity } from '@/lib/hooks/useAppSecurity';
import { dashboardRequest, postsClient } from '@/lib/services/postsClient';
import { liveClient } from '@/lib/services/liveClient';
import { readPageAiProfile, savePageAiProfile, type PageAiProfile } from '@/lib/services/aiSettingsClient';
import { AI_ROLES, AI_PLATFORMS, AI_RULE_FIELDS, ROLE_PLATFORMS, defaultAiRules, effectiveAiRules,
  defaultAiConfiguration,
  type AiConfiguration, type AiPlatform, type AiProfile, type AiRoleId } from '@/lib/services/aiConfiguration';
import type { MarketingPost } from '@/lib/types/posts';
import type { MarketingWorkspaceView } from '@/lib/types/marketingWorkspace';
import type { LiveSessionListItem } from '@/lib/types/live';
import styles from './ai-configuration.module.css';
import { CustomerCareSettings } from './CustomerCareSettings';

const TABS = [{ key: 'manage', label: 'Quản lý AI' }, { key: 'settings', label: 'Thiết lập AI' }] as const;
const LABELS: Record<AiRoleId, string> = { chat: 'AI Chat', content: 'AI Soạn nội dung', review: 'AI Kiểm tra nội dung', sourcing: 'AI Smart Sourcing', livestream: 'AI Livestream' };
const ORDER: AiRoleId[] = ['chat', 'content', 'review', 'sourcing', 'livestream'];

export function AiConfigShell() {
  const [tab, setTab] = useTabParam(TABS.map(item => item.key), 'manage');
  const params = useSearchParams();
  const selected = ORDER.includes(params.get('ai') as AiRoleId) ? params.get('ai') as AiRoleId : 'chat';
  const [platform, setPlatform] = useState<AiPlatform | 'default'>('default');
  const [detail, setDetail] = useState<AiRoleId | null>(null);
  const [config, setConfig] = useState<AiConfiguration>(defaultAiConfiguration);
  const [saved, setSaved] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState<PageAiProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [posts, setPosts] = useState<MarketingPost[] | null>(null);
  const [marketing, setMarketing] = useState<MarketingWorkspaceView | null>(null);
  const [sessions, setSessions] = useState<LiveSessionListItem[] | null>(null);
  const [usageErrors, setUsageErrors] = useState<string[]>([]);
  const { session } = useAppSecurity();
  const owner = session.userId || session.username;
  const toast = useToast();
  const profile = config.profiles[selected];
  const currentPlatform = platform !== 'default' && ROLE_PLATFORMS[selected].includes(platform) ? platform : undefined;
  const override = currentPlatform ? profile.platformRules[currentPlatform] : undefined;
  const rules = effectiveAiRules(profile, currentPlatform);
  const dirty = ready && JSON.stringify(config) !== saved;
  const role = AI_ROLES.find(item => item.id === selected)!;

  const apply = (value: PageAiProfile, persisted = true) => {
    setPage(value); setConfig(value.configuration); setSaved(persisted ? JSON.stringify(value.configuration) : ''); setReady(true); setError('');
  };
  const load = useCallback(async () => {
    // Chưa lưu lên server (revision 0) thì coi là nháp để người dùng bấm Lưu một lần.
    try { const value = await readPageAiProfile(session.pageId, owner); apply(value, !!value.revision); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa đọc được thiết lập AI của Page. Vui lòng thử lại.'); }
  }, [owner, session.pageId]);
  useEffect(() => { if (owner) { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); } }, [load, owner]);
  const loadUsage = useCallback(async () => {
    const result = await Promise.allSettled([
      postsClient.list(), liveClient.sessions(),
      dashboardRequest('/api/marketing/workspace').then(response => response.json() as Promise<MarketingWorkspaceView>),
    ]);
    const errors: string[] = [];
    if (result[0].status === 'fulfilled') setPosts(result[0].value.posts);
    else { setPosts(null); errors.push('Chưa tải được bài viết.'); }
    if (result[1].status === 'fulfilled') setSessions(result[1].value);
    else { setSessions(null); errors.push('Chưa tải được phiên livestream.'); }
    if (result[2].status === 'fulfilled') setMarketing(result[2].value);
    else { setMarketing(null); errors.push('Chưa tải được chiến dịch Marketing.'); }
    setUsageErrors(errors);
  }, []);
  useEffect(() => { const timer = setTimeout(() => void loadUsage(), 0); return () => clearTimeout(timer); }, [loadUsage]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function updateProfile(id: AiRoleId, patch: Partial<AiProfile>) {
    setConfig(current => ({ ...current, profiles: { ...current.profiles, [id]: { ...current.profiles[id], ...patch } } }));
  }
  function setRule(key: string, value: string) {
    if (!currentPlatform) updateProfile(selected, { rules: { ...profile.rules, [key]: value } });
    else updateProfile(selected, { platformRules: { ...profile.platformRules, [currentPlatform]: { enabled: true, values: { ...override?.values, [key]: value } } } });
  }
  function selectAi(id: AiRoleId) { setPlatform('default'); setTab('settings', { ai: id }); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!page || saving) return;
    setSaving(true);
    try { apply(await savePageAiProfile(page, config)); toast('Đã lưu thiết lập AI cho Page'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa lưu được thiết lập. Vui lòng thử lại.'); }
    finally { setSaving(false); }
  }
  function template() {
    const values = defaultAiRules(selected);
    if (selected === 'content' && currentPlatform === 'instagram') values.format = 'Caption ngắn, lợi ích nổi bật, tối đa 5 hashtag phù hợp';
    if (selected === 'content' && currentPlatform === 'facebook') values.format = 'Mở đầu thu hút, 3 lợi ích chính, giá đã xác nhận và CTA nhắn tin';
    if (currentPlatform) updateProfile(selected, { platformRules: { ...profile.platformRules, [currentPlatform]: { enabled: true, values } } });
    else updateProfile(selected, { rules: values });
  }
  const usage = (id: AiRoleId) => {
    if (id === 'content' || id === 'review') {
      const items = posts?.filter(post => id === 'content' || post.status === 'draft');
      return <><h3>{id === 'content' ? 'Campaign & nền tảng đăng bài' : 'Campaign & bước duyệt bài'}</h3>
        {marketing?.workspace?.campaigns.length ? marketing.workspace.campaigns.filter(campaign => id === 'content' || marketing.workspace.reviews.some(review => review.campaignId === campaign.id)).map(campaign => {
          const account = marketing.accounts.find(item => item.id === campaign.accountId);
          return <p key={campaign.id}>{campaign.name} · {account?.platform}{account?.mock ? ' (mẫu)' : ''} · {campaign.approvedAt ? 'Brief đã duyệt' : 'Brief nháp'}</p>;
        }) : <p>{marketing ? 'Chưa có chiến dịch.' : 'Chưa tải được danh sách chiến dịch.'}</p>}
        {items ? <><p>{id === 'content' ? 'Bài viết đã lưu' : 'Bước kiểm tra trước khi chủ shop duyệt'}: {items.length} bài{items.length > 0 && ` · ${[...new Set(items.map(post => post.channel))].map(channel => channel === 'facebook' ? 'Facebook' : channel === 'tiktok' ? 'TikTok' : 'Email').join(', ')}`}</p>
          {items.slice(0, 3).map(post => <p key={post.id}>{post.title} · {post.channel} · {post.status === 'draft' ? 'Bản nháp' : 'Đã đăng'}</p>)}</> : <p>Chưa tải được danh sách bài viết.</p>}
        <Link href={`/marketing?tab=${id === 'content' ? 'composer' : 'approvals'}`} className="btn btn-outline btn-sm">{id === 'content' ? 'Mở soạn nội dung' : 'Mở duyệt nội dung'}</Link></>;
    }
    if (id === 'sourcing') return <><h3>Nguồn dữ liệu tìm kiếm</h3><p>TikTok: thu thập bài theo từ khóa. Google: tìm đầu mối nhà cung cấp.</p><p>Tiêu chí hiện tại: {config.profiles.sourcing.rules.category} · {config.profiles.sourcing.rules.region}</p><Link href="/smart-sourcing" className="btn btn-outline btn-sm">Mở Smart Sourcing</Link></>;
    const active = sessions?.filter(item => item.status === 'live');
    return <><h3>Kênh & phiên livestream</h3>{active ? active.length ? active.map(item => <p key={item.id}>{item.title} · {item.platform === 'facebook' ? 'Facebook' : item.platform}</p>) : <p>Chưa có phiên livestream đang hoạt động.</p> : <p>Chưa tải được phiên livestream.</p>}<Link href="/livestream" className="btn btn-outline btn-sm">Mở Livestream</Link></>;
  };

  return <div className={styles.root}>
    <div className="page-head"><div><h1>Cấu hình AI</h1><p>Cá nhân hóa từng AI cho Page của shop{page ? ` · Page ${page.pageId} (${AI_PLATFORMS[page.platform]})` : ''}. Thiết lập chung của Tendly luôn được áp dụng trước.</p></div>{tab === 'settings' && selected !== 'chat' && <button className="btn btn-primary" form="ai-profile-settings" type="submit" disabled={saving || !ready || !dirty}>Lưu thiết lập</button>}</div>
    <Tabs tabs={[...TABS]} active={tab} onChange={value => setTab(value, { ai: selected })} />
    {error && <div className={styles.error} role="alert">{error} <button type="button" className="btn btn-outline btn-sm" onClick={() => void load()}>Tải lại thiết lập</button></div>}
    {!ready && !error && <p className={styles.loading} role="status">Đang tải thiết lập…</p>}
    <form id="ai-profile-settings" onSubmit={save}><fieldset className={styles.fieldset} disabled={saving}>
      {tab === 'manage' ? <div className={styles.management}>
        {usageErrors.length > 0 && <div className={styles.usageError} role="status">{usageErrors.join(' ')} <button className="btn btn-text btn-sm" type="button" onClick={() => void loadUsage()}>Tải lại</button></div>}
        {ORDER.map(id => id === 'chat' ? (ready || error) && <CustomerCareSettings key={id} mode="manage" initialProfile={config.profiles.chat} /> : ready && <section key={id} className={styles.aiRow}>
          <header className={styles.rowHead}><div><h2>{LABELS[id]}</h2><p>{AI_ROLES.find(item => item.id === id)!.description}</p></div>
            <div className={styles.statusControl}><span>{config.profiles[id].enabled ? 'Đã bật' : 'Đang tắt'}</span></div></header>
          <div className={styles.usage}>{usage(id)}</div>
          {detail === id && <div className={styles.detail}><h3>Nhiệm vụ & kết quả</h3><p>{AI_ROLES.find(item => item.id === id)!.goal}</p><p>{AI_ROLES.find(item => item.id === id)!.output}</p></div>}
          <footer className={styles.rowActions}><button type="button" className="btn btn-outline btn-sm" aria-expanded={detail === id} onClick={() => setDetail(detail === id ? null : id)}>{detail === id ? 'Thu gọn' : 'Mở chi tiết'}</button><button type="button" className="btn btn-primary btn-sm" onClick={() => selectAi(id)}>Chỉnh quy tắc</button></footer>
        </section>)}
      </div> : <div className={styles.settings}>
        <div className={styles.selectors}><div><label htmlFor="ai-selector">Chọn AI</label><select id="ai-selector" value={selected} onChange={event => selectAi(event.target.value as AiRoleId)}>{ORDER.map(id => <option key={id} value={id}>{LABELS[id]}</option>)}</select></div>
          {selected !== 'chat' && ROLE_PLATFORMS[selected].length > 0 && <div><label htmlFor="ai-platform">Bộ quy tắc</label><select id="ai-platform" value={currentPlatform ?? 'default'} onChange={event => setPlatform(event.target.value as AiPlatform | 'default')}><option value="default">Quy tắc mặc định</option>{ROLE_PLATFORMS[selected].map(item => <option key={item} value={item}>{AI_PLATFORMS[item]}</option>)}</select></div>}</div>
        {selected === 'chat' ? (ready || error) && <CustomerCareSettings mode="settings" initialProfile={config.profiles.chat} /> : ready && <section className={styles.editor} aria-labelledby="rules-heading"><header className={styles.editorHead}><div><h2 id="rules-heading">{LABELS[selected]} · {currentPlatform ? AI_PLATFORMS[currentPlatform] : 'Quy tắc mặc định'}</h2><p>{role.description}</p></div></header>
          <div className={styles.formBody}>
            {!currentPlatform && <><div className={styles.switchRow}><div><strong>Bật {LABELS[selected]}</strong><p>Thay đổi trạng thái rồi chọn “Lưu thiết lập” để áp dụng.</p></div><Switch checked={profile.enabled} label={`Bật ${LABELS[selected]}`} onChange={enabled => updateProfile(selected, { enabled })} /></div>
              {(['goal', 'input', 'output', 'instructions'] as const).map(key => <div className={styles.ruleField} key={key}><label htmlFor={`profile-${key}`}>{{ goal: 'Nhiệm vụ', input: 'Dữ liệu đầu vào', output: 'Kết quả đầu ra', instructions: 'Chỉ dẫn bổ sung' }[key]}</label><textarea id={`profile-${key}`} rows={3} maxLength={key === 'instructions' ? 2000 : 1500} required={key !== 'instructions'} value={profile[key]} onChange={event => updateProfile(selected, { [key]: event.target.value })} /></div>)}</>}
            {currentPlatform && <div className={styles.switchRow}><div><strong>Tùy chỉnh cho nền tảng này</strong><p>Các mục chưa tùy chỉnh sẽ dùng quy tắc mặc định.</p></div><Switch checked={override?.enabled ?? false} label="Tùy chỉnh cho nền tảng này" onChange={enabled => updateProfile(selected, { platformRules: { ...profile.platformRules, [currentPlatform]: { enabled, values: override?.values ?? {} } } })} /></div>}
            <div className={styles.templateRow}><p>Bắt đầu với mẫu có sẵn, rồi chỉnh theo shop.</p><button type="button" className="btn btn-outline btn-sm" disabled={!!currentPlatform && !override?.enabled} onClick={template}>Dùng mẫu gợi ý</button></div>
            {AI_RULE_FIELDS[selected].map(field => {
              const customized = !!override?.enabled && Object.hasOwn(override.values, field.key);
              const disabled = !!currentPlatform && !customized;
              return <div className={styles.ruleField} key={field.key}>
                <div className={styles.fieldHeading}><label htmlFor={`rule-${field.key}`}>{field.label}</label>{currentPlatform && override?.enabled && <label className={styles.checkLabel}><input type="checkbox" aria-label={`Tùy chỉnh ${field.label}`} checked={customized} onChange={event => {
                  const values = { ...override.values };
                  if (event.target.checked) values[field.key] = profile.rules[field.key]; else delete values[field.key];
                  updateProfile(selected, { platformRules: { ...profile.platformRules, [currentPlatform]: { enabled: true, values } } });
                }} />Tùy chỉnh</label>}</div>
                {field.type === 'check' ? <label className={styles.checkLabel}><input id={`rule-${field.key}`} type="checkbox" disabled={disabled} checked={rules[field.key] === 'yes'} onChange={event => setRule(field.key, event.target.checked ? 'yes' : 'no')} />Kiểm tra tiêu chí này</label> : field.type === 'number' ? <input id={`rule-${field.key}`} type="number" min={0} step={1} disabled={disabled} value={rules[field.key]} placeholder="Không giới hạn" onChange={event => setRule(field.key, event.target.value)} /> : <textarea id={`rule-${field.key}`} rows={2} maxLength={500} disabled={disabled} value={rules[field.key]} required onChange={event => setRule(field.key, event.target.value)} />}
                {currentPlatform && !customized && <small>Dùng quy tắc mặc định</small>}
              </div>;
            })}
            <p className={styles.ruleHint}>{selected === 'review' ? 'Kết quả kiểm tra cần chỉ ra lỗi và gợi ý sửa. Chủ shop quyết định duyệt bài.' : selected === 'sourcing' ? 'Chỉ đối chiếu giá, MOQ và khu vực khi nguồn hàng có cung cấp thông tin tương ứng.' : role.guard}</p>
          </div>
        </section>}
      </div>}
      {tab === 'settings' && selected !== 'chat' && <footer className={styles.saveBar}><p aria-live="polite">{saving ? 'Đang lưu…' : dirty ? 'Có thay đổi chưa lưu' : page?.revision ? 'Đã lưu thiết lập' : 'Chưa có thay đổi'}</p><button className="btn btn-primary" type="submit" disabled={saving || !ready || !dirty}>Lưu thiết lập</button></footer>}
    </fieldset></form>
  </div>;
}
