'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { EmailBody } from '@/components/shared/EmailBody';
import { IconBolt, IconCart, IconChat, IconMoon } from '@/components/ui/Icons';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { errorMessage, useToast } from '@/components/shared/ToastProvider';
import { CUSTOMER, LAST_ORDER } from '@/lib/data/customer';
import { emailApi, snapshot } from '@/lib/services/api';
import { fillTemplate, sampleContext, TEMPLATE_VARS } from '@/lib/services/emailTemplate';
import type { EmailLog, EmailTrigger, TriggerKind } from '@/lib/types/admin';
import { initials, relativeTime } from '@/lib/utils/format';

const ICONS: Record<TriggerKind, ReactNode> = {
  'ask-no-order': <IconChat />,
  negative: <IconBolt />,
  'abandoned-cart': <IconCart />,
  inactive: <IconMoon />,
};

export const describeTrigger = (t: EmailTrigger) => t.desc.replace('{delay}', `${t.delayValue} ${t.delayUnit}`);

function TemplateModal({ trigger, onClose, onSaved, onTestSent }: {
  trigger: EmailTrigger;
  onClose: () => void;
  onSaved: (t: EmailTrigger) => void;
  onTestSent: (log: EmailLog) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(trigger);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const product = snapshot.products().find((p) => p.sku === LAST_ORDER.productSku) ?? null;
  const ctx = sampleContext(product);
  const dirty = JSON.stringify(form) !== JSON.stringify(trigger);

  const insertVar = (key: string) => {
    const el = bodyRef.current;
    const token = key === 'the_san_pham' ? '\n\n{the_san_pham}\n\n' : `{${key}}`;
    if (!el) return;
    const start = el.selectionStart ?? form.body.length;
    const end = el.selectionEnd ?? start;
    const body = form.body.slice(0, start) + token + form.body.slice(end);
    setForm({ ...form, body });
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + token.length; });
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await emailApi.updateTrigger(trigger.id, {
        subject: form.subject, body: form.body, delayValue: Number(form.delayValue), delayUnit: form.delayUnit,
      });
      onSaved(saved);
      toast('Đã lưu mẫu email');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setSending(true);
    try {
      const log = await emailApi.logSent(trigger.id, 'Gửi thử', `tới ${CUSTOMER.email}`);
      onTestSent(log);
      toast(`Đã gửi email thử tới ${CUSTOMER.email}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open
      width={920}
      title={`Mẫu email — ${trigger.title}`}
      onClose={() => !saving && onClose()}
      footer={
        <>
          {trigger.id === 'ask-no-order' && (
            <Link href="/khach-hang/email" className="btn btn-text btn-sm" style={{ marginRight: 'auto' }}>
              Xem trong hộp thư khách →
            </Link>
          )}
          <button className="btn btn-outline btn-sm" onClick={sendTest} disabled={sending}>
            {sending && <span className="spinner" />}
            Gửi thử
          </button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={!dirty || saving}>
            {saving && <span className="spinner" />}
            Lưu mẫu
          </button>
        </>
      }
    >
      <div className="tpl-grid">
        <div>
          {!trigger.instant && (
            <div className="field">
              <label>Gửi sau</label>
              <div className="delay-row">
                <input type="number" min={1} value={form.delayValue} onChange={(e) => setForm({ ...form, delayValue: Number(e.target.value) })} />
                <select value={form.delayUnit} onChange={(e) => setForm({ ...form, delayUnit: e.target.value as EmailTrigger['delayUnit'] })}>
                  <option>giờ</option>
                  <option>ngày</option>
                </select>
              </div>
            </div>
          )}
          <div className="field">
            <label htmlFor="tpl-subject">Tiêu đề</label>
            <input id="tpl-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="tpl-body">Nội dung</label>
            <textarea id="tpl-body" ref={bodyRef} rows={11} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <span className="field-hint">Bấm để chèn biến cá nhân hoá — AI tự điền theo từng khách:</span>
            <div className="tpl-vars">
              {TEMPLATE_VARS.map((v) => (
                <button key={v.key} type="button" className="var-chip" onClick={() => insertVar(v.key)} title={`{${v.key}}`}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="tpl-preview">
          <div className="tpl-preview-head">
            <div className="lbl">Xem trước · gửi tới {CUSTOMER.email}</div>
            <div className="subj">{fillTemplate(form.subject, ctx)}</div>
          </div>
          <div className="tpl-preview-body">
            <EmailBody body={form.body} ctx={ctx} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function EmailTab() {
  const toast = useToast();
  const [triggers, setTriggers] = useState<EmailTrigger[] | null>(null);
  const [logs, setLogs] = useState<EmailLog[] | null>(null);
  const [preview, setPreview] = useState<EmailTrigger | null>(null);
  const [newLogId, setNewLogId] = useState<string | null>(null);

  useEffect(() => {
    emailApi.listTriggers().then(setTriggers);
    emailApi.listLogs().then(setLogs);
  }, []);

  const replace = (t: EmailTrigger) => setTriggers((prev) => prev!.map((x) => (x.id === t.id ? t : x)));

  const onToggle = async (t: EmailTrigger, enabled: boolean) => {
    replace({ ...t, enabled }); // optimistic
    try {
      replace(await emailApi.updateTrigger(t.id, { enabled }));
      toast(`${enabled ? 'Đã bật' : 'Đã tắt'} kịch bản “${t.title}”`);
    } catch (e) {
      replace(t);
      toast(errorMessage(e), 'error');
    }
  };

  const triggerTitle = (id: TriggerKind) => triggers?.find((t) => t.id === id)?.title.replace(/\s*\(.*\)/, '') ?? '';

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>Kịch bản email tự động</h2>
          <span className="hint">{triggers?.filter((t) => t.enabled).length ?? 0} đang bật</span>
        </div>

        {!triggers && <div className="skeleton" style={{ height: 260 }} />}
        {triggers?.map((t) => (
          <div key={t.id} className={`trigger-row${t.enabled ? '' : ' off'}`}>
            <div className={`trigger-icon${t.instant ? ' instant' : ''}`}>{ICONS[t.id]}</div>
            <div className="trigger-info">
              <div className="tr-title">
                {t.title}
                {t.instant && <span className="badge-instant">Tức thì</span>}
              </div>
              <div className="tr-desc">{describeTrigger(t)}</div>
            </div>
            <div className="trigger-tail">
              <button className="link-btn" onClick={() => setPreview(t)}>Xem mẫu</button>
              <Switch checked={t.enabled} onChange={(v) => onToggle(t, v)} label={`Bật/tắt ${t.title}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Email đã gửi gần đây</h2>
          <span className="hint">Hôm nay</span>
        </div>
        {!logs && <div className="skeleton" style={{ height: 120 }} />}
        {logs?.length === 0 && <div className="empty-state">Chưa có email nào được gửi</div>}
        {logs?.slice(0, 8).map((l) => (
          <div key={l.id} className={`log-row${l.id === newLogId ? ' new' : ''}`}>
            <div className="log-icon">{initials(l.customer)}</div>
            <div className="log-name">{l.customer}</div>
            <div className="log-trigger">{triggerTitle(l.triggerId)} — {l.summary}</div>
            <div className="log-time">{relativeTime(l.sentAt)}</div>
            <div className={`log-status ${l.status}`}><span className="dot" />{l.status === 'opened' ? 'Đã mở' : 'Đã gửi'}</div>
          </div>
        ))}
      </div>

      {preview && (
        <TemplateModal
          trigger={preview}
          onClose={() => setPreview(null)}
          onSaved={(t) => { replace(t); setPreview(t); }}
          onTestSent={(log) => { setLogs((prev) => [log, ...(prev ?? [])]); setNewLogId(log.id); }}
        />
      )}
    </>
  );
}
