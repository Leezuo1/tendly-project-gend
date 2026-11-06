'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/shared/ToastProvider';
import { dashboardRequest } from '@/lib/services/postsClient';
import { currentAiKnowledge } from '@/lib/services/aiChat';
import { AI_RULE_FIELDS, defaultAiConfiguration, type AiProfile } from '@/lib/services/aiConfiguration';
import type { AiChatReply, AiKnowledge } from '@/lib/types/ai';
import type { CarePageProfile, CustomerCareSettings as Settings } from '@/lib/types/customerCare';
import styles from './ai-configuration.module.css';

export function CustomerCareSettings({ mode, initialProfile }: { mode: 'manage' | 'settings'; initialProfile: AiProfile }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [profile, setProfile] = useState<AiProfile>(defaultAiConfiguration().profiles.chat);
  const [page, setPage] = useState<CarePageProfile | null>(null);
  const [assigned, setAssigned] = useState(false);
  const [pageEnabled, setPageEnabled] = useState(false);
  const [knowledge, setKnowledge] = useState<AiKnowledge | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('Khách muốn đổi size thì cần đáp ứng điều kiện nào?');
  const [preview, setPreview] = useState<AiChatReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const value = await (await dashboardRequest('/api/customer-care')).json() as Settings & { currentPageProfile: CarePageProfile };
      setSettings(value); setProfile(value.profile ?? initialProfile); setPage(value.currentPageProfile);
      setAssigned(value.pageAssigned); setPageEnabled(value.pageEnabled);
      setKnowledge(value.knowledge ?? currentAiKnowledge()); setConfirmed(false); setPreview(null); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa tải được AI Chat.'); }
    finally { setBusy(false); }
  }, [initialProfile]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  const reset = () => { setConfirmed(false); setPreview(null); };
  function change(patch: Partial<AiProfile>) { setProfile(current => ({ ...current, ...patch })); reset(); }
  const override = profile.platformRules.facebook;
  const rules = override?.enabled ? { ...profile.rules, ...override.values } : profile.rules;
  function setRule(key: string, value: string) {
    change({ platformRules: { ...profile.platformRules, facebook: { enabled: true, values: { ...override?.values, [key]: value } } } });
  }
  async function toggle(enabled: boolean) {
    setBusy(true); setError('');
    try {
      const value = await (await dashboardRequest('/api/messenger/ai', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoReply: enabled, updatedAt: settings?.updatedAt }) })).json() as Settings;
      setSettings(value); if (value.profile) setProfile(current => mode === 'settings' ? { ...current, enabled } : value.profile!);
      reset();
      toast(enabled ? 'Đã bật AI Chat. Giữ nguyên lựa chọn từng hội thoại.' : 'Đã tắt AI Chat cho tất cả hội thoại trong cấu hình.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa đổi được trạng thái AI.'); }
    finally { setBusy(false); }
  }
  async function apply() {
    setBusy(true); setError('');
    try {
      const value = await (await dashboardRequest('/api/customer-care', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, knowledge, pageAssigned: assigned, pageEnabled, confirmed, updatedAt: settings?.updatedAt, pageProfile: page }) })).json() as Settings;
      setSettings(value); setProfile(value.profile!); setKnowledge(value.knowledge); setPage(value.pageProfile); setConfirmed(false);
      toast('Đã xác nhận và áp dụng cấu hình AI Chat.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa áp dụng được AI Chat.'); }
    finally { setBusy(false); }
  }
  async function testReply() {
    setBusy(true); setError(''); setPreview(null);
    try {
      const value = await (await dashboardRequest('/api/customer-care', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', profile, knowledge, message }) })).json() as AiChatReply & { pageProfile: CarePageProfile };
      setPreview(value); setPage(value.pageProfile); setConfirmed(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa thử được câu trả lời.'); }
    finally { setBusy(false); }
  }
  const status = <>{error && <p className={styles.error} role="alert">{error} <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => void load()}>Tải lại cấu hình</button></p>}
    {!settings && !error && <p role="status">Đang tải AI Chat…</p>}</>;
  const needsSetup = !!settings && !settings.autoReply && (!settings.profile || !settings.pageAssigned || !settings.pageEnabled);
  if (mode === 'manage') return <section className={styles.aiRow}>
    <header className={styles.rowHead}><div><h2>AI Chat</h2><p>Tư vấn theo chính sách shop, đề xuất trả lời và chuyển người xử lý khi cần.</p></div>
      <div className={styles.statusControl}><span>{settings?.autoReply ? 'Đã bật' : 'Đang tắt'}</span></div></header>
    {status}<div className={styles.usage}><h3>{page?.name || 'Fanpage Facebook'}</h3><p>{settings?.pageAssigned ? settings.pageEnabled ? 'Đã gán · Cho phép AI Chat' : 'Đã gán · Đang tắt trên Page' : 'Chưa gán AI Chat'}</p>
      {needsSetup && <p role="status">Chưa thể bật AI Chat. Chọn “Thiết lập để bật AI Chat” bên dưới, kiểm tra tri thức và quy tắc, gán và cho phép AI Chat trên Fanpage, rồi chọn “Xác nhận & áp dụng AI Chat”. Bước này giúp bạn kiểm tra nội dung AI sẽ dùng trước khi tự trả lời khách.</p>}
      <p>Bật/tắt AI Chat tại tab Thiết lập AI. Tắt AI Chat sẽ dừng tự trả lời cho tất cả hội thoại trong cấu hình.</p></div>
    <footer className={styles.rowActions}><Link className="btn btn-primary btn-sm" href="/cau-hinh-ai?tab=settings&ai=chat">{needsSetup ? 'Thiết lập để bật AI Chat' : 'Chỉnh quy tắc'}</Link></footer>
  </section>;
  return <section className={styles.editor} aria-labelledby="care-heading">
    <header className={styles.editorHead}><h2 id="care-heading">AI Chat · Chăm sóc khách</h2><p>Kiểm tra tri thức, thử tình huống và xác nhận bộ quy tắc trước khi áp dụng.</p></header>
    <div className={styles.formBody}>{status}
      <div className={styles.switchRow}><div><strong>Bật AI Chat</strong><p>{settings?.autoReply ? 'Tắt tại đây để dừng tự trả lời cho mọi hội thoại trong cấu hình.' : profile.enabled ? 'Sẽ bật sau khi xác nhận và cho phép AI Chat trên Fanpage.' : 'Đang tắt chung cho mọi hội thoại trong cấu hình.'}</p></div><Switch checked={profile.enabled} disabled={busy || !settings} label="Bật AI Chat" onChange={enabled => { if (!enabled && settings?.autoReply) void toggle(false); else change({ enabled }); }} /></div>
      <div className={styles.careScope}><h3>{page?.name || 'Fanpage Facebook'}</h3>
        <label className={styles.checkLabel}><input type="checkbox" checked={assigned} disabled={busy || !settings} onChange={event => { setAssigned(event.target.checked); if (!event.target.checked) setPageEnabled(false); reset(); }} />Gán AI Chat cho Fanpage này</label>
        <label className={styles.checkLabel}><input type="checkbox" checked={pageEnabled} disabled={busy || !settings || !assigned} onChange={event => { setPageEnabled(event.target.checked); reset(); }} />Cho phép AI Chat trên Fanpage này</label>
      </div>
      <div className={styles.careScope}><h3>Tri thức & chính sách</h3><p>{knowledge?.products.length ?? 0} sản phẩm · {knowledge?.faqs.length ?? 0} FAQ đang bật</p>
        <p>Chính sách dùng từ FAQ đã xác nhận. Khi sửa sản phẩm hoặc FAQ, cập nhật tri thức rồi xác nhận lại tại đây.</p>
        <div className={styles.rowActions}><button type="button" className="btn btn-outline btn-sm" disabled={busy || !settings} onClick={() => { setKnowledge(currentAiKnowledge()); reset(); }}>Cập nhật tri thức từ Sản phẩm & FAQ</button><Link href="/cai-dat?tab=faq" className="btn btn-outline btn-sm">Mở FAQ & chính sách</Link></div>
        <details><summary>Xem tri thức sẽ áp dụng</summary><p>Shop: {knowledge?.shop.name || 'Chưa có tên shop'}</p>{knowledge?.faqs.map(faq => <div key={faq.id}><strong>{faq.question}</strong><p>{faq.answer}</p></div>)}{knowledge?.products.map(product => <p key={product.id}>{product.sku} · {product.name} · {product.price.toLocaleString('vi-VN')} đ</p>)}</details>
      </div>
      <div className={styles.careScope}><h3>Quy tắc riêng cho {page?.name || 'Fanpage này'}</h3><p>Xưng hô: {page?.address || profile.rules.address} · Giọng: {page?.tone || profile.rules.tone}</p>{page?.examples && <p>Ví dụ: {page.examples}</p>}<p>Tùy chỉnh dưới đây chỉ áp dụng cho Fanpage này, trong phạm vi quy tắc chung do quản trị viên thiết lập.</p></div>
      {AI_RULE_FIELDS.chat.map(field => <div className={styles.ruleField} key={field.key}><label htmlFor={`care-${field.key}`}>{field.label}</label><textarea id={`care-${field.key}`} rows={2} maxLength={500} disabled={busy || !settings} value={rules[field.key]} onChange={event => setRule(field.key, event.target.value)} />
        {Object.hasOwn(override?.values ?? {}, field.key) && <button type="button" className="btn btn-text btn-sm" disabled={busy} onClick={() => { const values = { ...override?.values }; delete values[field.key]; change({ platformRules: { ...profile.platformRules, facebook: { enabled: true, values } } }); }}>Dùng lại quy tắc riêng của AI</button>}</div>)}
      <div className={styles.careScope}><h3>Giới hạn hành động</h3><p>AI hỏi lại khi thiếu căn cứ, chuyển nhân viên khi khách yêu cầu người thật hoặc có tranh chấp. Hoàn tiền, cấp voucher, đổi hàng và thay đổi đơn luôn cần quyền và phê duyệt riêng.</p></div>
      <div className={styles.ruleField}><label htmlFor="care-test">Thử tình huống</label><textarea id="care-test" rows={3} maxLength={8000} value={message} disabled={busy} onChange={event => { setMessage(event.target.value); setPreview(null); }} /><button type="button" className="btn btn-outline" disabled={busy || !settings || !message.trim()} onClick={() => void testReply()}>Thử câu trả lời</button>
        {preview && <div className={styles.carePreview} role="status"><strong>Câu trả lời thử · Chưa gửi cho khách</strong><p>{preview.reply}</p><p>{preview.analysis.needsHuman || !preview.analysis.canAutoReply ? 'Cần nhân viên kiểm tra' : 'Đủ căn cứ theo phân tích AI'} · {preview.analysis.reason}</p><small>{preview.sourceSummary}</small></div>}</div>
      <label className={styles.checkLabel}><input type="checkbox" checked={confirmed} disabled={busy || !settings} onChange={event => setConfirmed(event.target.checked)} />Tôi xác nhận tri thức, chính sách và quy tắc trên để áp dụng cho AI Chat.</label>
      <div className={styles.saveBar}><p role="status">{settings?.approvedAt ? `Đã xác nhận lúc ${new Date(settings.approvedAt).toLocaleString('vi-VN')} · ${settings.approvedBy}` : 'Chưa có cấu hình được xác nhận'}{busy && ' · Đang xử lý…'}</p><button type="button" className="btn btn-primary" disabled={busy || !settings || !confirmed} onClick={() => void apply()}>Xác nhận & áp dụng AI Chat</button></div>
    </div>
  </section>;
}
