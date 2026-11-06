'use client';

import { useState } from 'react';
import { useMockDbVersion } from '@/lib/hooks/useMockDbVersion';
import { Switch } from '@/components/ui/Switch';
import { ConfirmDialog } from '@/components/ui/Modal';
import { errorMessage, useToast } from '@/components/shared/ToastProvider';
import { CONTEXT_TAG_COLORS, matchContextTags, readContextTagRules, saveContextTagRules, validateContextTagRule } from '@/lib/services/contextTags';
import type { ContextTagRule } from '@/lib/types/contextTags';

export function ContextTagsTab() {
  const version = useMockDbVersion();
  const rules = version < 0 ? [] : readContextTagRules();
  const toast = useToast();
  const [editing, setEditing] = useState<ContextTagRule | null>(null);
  const [keywords, setKeywords] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<ContextTagRule | null>(null);
  const [sample, setSample] = useState('Mình muốn đặt hàng, phí ship bao nhiêu?');
  const persist = (next: ContextTagRule[]) => {
    try { saveContextTagRules(next); toast('Đã lưu quy tắc gắn thẻ'); return true; }
    catch (e) { const message = errorMessage(e); setError(message); toast(message, 'error'); return false; }
  };
  const edit = (rule: ContextTagRule) => { setEditing({ ...rule }); setKeywords(rule.keywords.join(', ')); setError(''); };
  const save = () => {
    if (!editing) return;
    try {
      const rule = validateContextTagRule({ ...editing, keywords: keywords.split(',') });
      const next = rules.some(item => item.id === rule.id) ? rules.map(item => item.id === rule.id ? rule : item) : [...rules, rule];
      if (persist(next)) setEditing(null);
    } catch (e) { setError(errorMessage(e)); }
  };
  const matches = matchContextTags(sample, rules);
  return <>
    <section className="card context-tags">
      <div className="card-head"><div><h2>Gắn thẻ theo ngữ cảnh</h2><p className="card-desc">Tự gắn thẻ vào hội thoại khi tin nhắn mới nhất của khách chứa một trong các từ khóa đã đặt.</p></div>
        <button className="btn btn-primary btn-sm" disabled={!!editing || version < 0 || rules.length >= 50} onClick={() => edit({ id: crypto.randomUUID(), label: '', keywords: [], type: 'neutral', enabled: true })}>Thêm quy tắc</button></div>
      <p className="card-desc">{rules.filter(rule => rule.enabled).length} quy tắc đang bật · Không phân biệt chữ hoa và dấu tiếng Việt.</p>
      {error && !editing && <p className="field-error" role="alert">{error}</p>}
      {editing && <form className="context-tag-form" onSubmit={event => { event.preventDefault(); save(); }}>
        <h3>{rules.some(rule => rule.id === editing.id) ? 'Chỉnh sửa quy tắc' : 'Quy tắc mới'}</h3>
        <div className="form-grid">
          <div className="field"><label htmlFor="tag-name">Tên thẻ</label><input id="tag-name" autoFocus required maxLength={50} value={editing.label} onChange={event => setEditing({ ...editing, label: event.target.value })} /></div>
          <div className="field"><label htmlFor="tag-color">Màu thẻ</label><select id="tag-color" value={editing.type} onChange={event => setEditing({ ...editing, type: event.target.value as ContextTagRule['type'] })}>{Object.entries(CONTEXT_TAG_COLORS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        </div>
        <div className="field"><label htmlFor="tag-keywords">Từ khóa / cụm từ</label><textarea id="tag-keywords" rows={3} required maxLength={2019} value={keywords} onChange={event => setKeywords(event.target.value)} placeholder="Ví dụ: đổi trả, hoàn tiền, hàng lỗi" /><span className="field-hint">Ngăn cách bằng dấu phẩy. Tối đa 20 từ khóa; chỉ khớp từ hoặc cụm từ đầy đủ.</span></div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="context-tag-actions"><button type="button" className="btn btn-outline btn-sm" onClick={() => { setEditing(null); setError(''); }}>Hủy</button><button className="btn btn-primary btn-sm" type="submit">Lưu quy tắc</button></div>
      </form>}
      <div className="context-tag-rules">
        {version < 0 && <p className="card-desc">Đang tải quy tắc…</p>}
        {version >= 0 && !rules.length && <p className="empty-state">Chưa có quy tắc. Thêm thẻ để phân loại nhu cầu khách hàng.</p>}
        {rules.map(rule => <div className="context-tag-rule" key={rule.id}>
          <div><span className={`tag ${rule.type}`}>{rule.label}</span><p>{rule.keywords.join(' · ')}</p></div>
          <div className="context-tag-actions"><Switch checked={rule.enabled} label={`Bật thẻ ${rule.label}`} disabled={!!editing} onChange={enabled => { setError(''); persist(rules.map(item => item.id === rule.id ? { ...item, enabled } : item)); }} />
            <button className="btn btn-outline btn-sm" disabled={!!editing} onClick={() => edit(rule)} aria-label={`Sửa thẻ ${rule.label}`}>Sửa</button>
            <button className="btn btn-text btn-sm" disabled={!!editing} onClick={() => setDeleting(rule)} aria-label={`Xóa thẻ ${rule.label}`}>Xóa</button></div>
        </div>)}
      </div>
    </section>
    <section className="card context-tags"><div className="card-head"><h2>Thử gắn thẻ</h2></div>
      <div className="field"><label htmlFor="tag-sample">Tin nhắn của khách</label><textarea id="tag-sample" rows={3} maxLength={5000} value={sample} onChange={event => setSample(event.target.value)} /></div>
      <div className="context-tag-results" aria-live="polite">{matches.length ? matches.map(tag => <span key={tag.label} className={`tag ${tag.type}`}>{tag.label}</span>) : <p className="card-desc">Không có thẻ phù hợp với các quy tắc đang bật.</p>}</div>
    </section>
    <ConfirmDialog open={!!deleting} title="Xóa quy tắc gắn thẻ?" message={`Thẻ “${deleting?.label ?? ''}” sẽ không còn được gắn theo quy tắc này.`} confirmLabel="Xóa quy tắc" onClose={() => setDeleting(null)} onConfirm={() => { if (persist(rules.filter(rule => rule.id !== deleting?.id))) setDeleting(null); }} />
  </>;
}
