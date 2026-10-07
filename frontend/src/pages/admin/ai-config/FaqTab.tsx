import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { IconEdit, IconSearch, IconTrash } from '../../../components/Icons';
import { ConfirmDialog, Modal } from '../../../components/Modal';
import { Switch } from '../../../components/Switch';
import { errorMessage, useToast } from '../../../components/Toast';
import { faqApi, snapshot, type FaqInput } from '../../../services/api';
import { botReply, emptyCtx } from '../../../services/chatBot';
import type { Faq } from '../../../types';
import { normalize } from '../../../utils/format';

const TAGS = ['Giao hàng & Thanh toán', 'Đổi trả & Hoàn tiền', 'Vận chuyển', 'Sản phẩm & Bảo quản', 'Khuyến mãi', 'Khác'];
const EMPTY: FaqInput = { question: '', answer: '', tag: TAGS[0], keywords: [], active: true };

function FaqFormModal({ initial, onClose, onSaved }: { initial: Faq | 'new'; onClose: () => void; onSaved: (f: Faq, isNew: boolean) => void }) {
  const isNew = initial === 'new';
  const [form, setForm] = useState<FaqInput>(isNew ? EMPTY : { ...initial });
  const [kwText, setKwText] = useState(isNew ? '' : initial.keywords.join(', '));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const tags = TAGS.includes(form.tag) ? TAGS : [form.tag, ...TAGS];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload: FaqInput = {
      ...form,
      question: form.question.trim(),
      answer: form.answer.trim(),
      keywords: kwText.split(',').map((k) => k.trim()).filter(Boolean),
    };
    try {
      const saved = isNew ? await faqApi.create(payload) : await faqApi.update(initial.id, payload);
      onSaved(saved, isNew);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={isNew ? 'Thêm câu hỏi thường gặp' : 'Sửa câu hỏi'}
      onClose={() => !saving && onClose()}
      width={560}
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose} disabled={saving}>Huỷ</button>
          <button className="btn btn-primary btn-sm" type="submit" form="faq-form" disabled={saving}>
            {saving && <span className="spinner" />}
            {isNew ? 'Thêm câu hỏi' : 'Lưu thay đổi'}
          </button>
        </>
      }
    >
      <form id="faq-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="faq-q">Câu hỏi</label>
          <input id="faq-q" autoFocus value={form.question} placeholder="VD: Shop có giao COD không?" onChange={(e) => setForm({ ...form, question: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="faq-a">Câu trả lời của AI</label>
          <textarea id="faq-a" rows={4} value={form.answer} placeholder="Nội dung AI sẽ trả lời khách..." onChange={(e) => setForm({ ...form, answer: e.target.value })} />
        </div>
        <div className="field-row" style={{ marginTop: 14 }}>
          <div className="field">
            <label htmlFor="faq-tag">Nhóm</label>
            <select id="faq-tag" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })}>
              {tags.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10 }}>
              <Switch checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Kích hoạt" />
              Kích hoạt cho AI
            </label>
          </div>
        </div>
        <div className="field">
          <label htmlFor="faq-kw">Từ khoá kích hoạt</label>
          <input id="faq-kw" value={kwText} placeholder="VD: COD, thanh toán khi nhận" onChange={(e) => setKwText(e.target.value)} />
          <span className="field-hint">Phân cách bằng dấu phẩy. Khách nhắn có chứa từ khoá này thì AI ưu tiên dùng câu trả lời trên.</span>
        </div>
        {error && <p className="field-error" style={{ marginTop: 12 }}>{error}</p>}
      </form>
    </Modal>
  );
}

function AskAiBox() {
  const [q, setQ] = useState('');
  const [result, setResult] = useState<{ text: string; faq?: Faq; handoff?: boolean } | null>(null);
  const [thinking, setThinking] = useState(false);

  const ask = (e: FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setThinking(true);
    setTimeout(() => {
      const r = botReply(q, snapshot.faqs(), snapshot.products(), emptyCtx());
      setResult({ text: r.text, faq: r.matchedFaq, handoff: !!r.handoff });
      setThinking(false);
    }, 500);
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Thử hỏi AI</h2>
          <p className="card-desc">Gõ thử một câu khách hay hỏi để xem AI sẽ trả lời thế nào với bộ FAQ & sản phẩm hiện tại.</p>
        </div>
      </div>
      <form onSubmit={ask} style={{ display: 'flex', gap: 10 }}>
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="VD: phí ship bao nhiêu vậy shop?" />
        <button className="btn btn-primary btn-sm" disabled={thinking || !q.trim()}>
          {thinking && <span className="spinner" />}
          Hỏi
        </button>
      </form>
      {result && (
        <div className="faq-tip" style={{ marginTop: 14 }}>
          <div style={{ color: 'var(--ink)', fontWeight: 600 }}>🤖 {result.text}</div>
          <div style={{ marginTop: 6, fontSize: 12 }}>
            {result.handoff
              ? '→ AI sẽ chuyển tiếp cho nhân viên thật.'
              : result.faq
                ? `→ Dựa trên FAQ: “${result.faq.question}”`
                : '→ Không dựa trên FAQ nào (trả lời từ dữ liệu sản phẩm hoặc câu mặc định).'}
          </div>
        </div>
      )}
    </div>
  );
}

export function FaqTab() {
  const toast = useToast();
  const [faqs, setFaqs] = useState<Faq[] | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Faq | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<Faq | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => { faqApi.list().then(setFaqs); }, []);

  const filtered = useMemo(() => {
    const q = normalize(query);
    return (faqs ?? []).filter((f) => !q || normalize(`${f.question} ${f.answer} ${f.tag} ${f.keywords.join(' ')}`).includes(q));
  }, [faqs, query]);

  const activeCount = faqs?.filter((f) => f.active).length ?? 0;

  const onToggle = async (f: Faq, active: boolean) => {
    setTogglingId(f.id);
    try {
      const updated = await faqApi.update(f.id, { ...f, active });
      setFaqs((prev) => prev!.map((x) => (x.id === f.id ? updated : x)));
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const onDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await faqApi.remove(toDelete.id);
      setFaqs((prev) => prev!.filter((x) => x.id !== toDelete.id));
      toast('Đã xoá câu hỏi');
      setToDelete(null);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Câu hỏi thường gặp (FAQ)</h2>
            <p className="card-desc">AI tham khảo ngân hàng câu hỏi này để trả lời chuẩn xác và nhanh chóng khi khách chat 24/7.</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>+ Thêm câu hỏi</button>
        </div>

        <div className="table-toolbar" style={{ marginTop: 10, marginBottom: 6 }}>
          <div className="search-input-wrap">
            <IconSearch />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm kiếm theo từ khóa câu hỏi..." />
          </div>
          <div className="table-summary">Tổng cộng <b>{activeCount}</b> / {faqs?.length ?? 0} câu hỏi đã kích hoạt</div>
        </div>

        <div>
          {!faqs && <div className="skeleton" style={{ height: 200, marginTop: 12 }} />}
          {filtered.map((f) => (
            <div key={f.id} className={`faq-row${f.active ? '' : ' inactive'}`}>
              <div>
                <div className="faq-q">
                  {f.question}
                  <span className="faq-tag">{f.tag}</span>
                </div>
                <div className="faq-a">{f.answer}</div>
                {f.keywords.length > 0 && (
                  <div className="faq-kw">{f.keywords.map((k) => <span key={k} className="kw-chip">{k}</span>)}</div>
                )}
              </div>
              <div className="faq-actions">
                <Switch checked={f.active} disabled={togglingId === f.id} onChange={(v) => onToggle(f, v)} label={f.active ? 'Tắt câu hỏi' : 'Bật câu hỏi'} />
                <button className="btn-icon" aria-label="Sửa" title="Sửa" onClick={() => setEditing(f)}><IconEdit /></button>
                <button className="btn-icon" aria-label="Xoá" title="Xoá" onClick={() => setToDelete(f)}><IconTrash /></button>
              </div>
            </div>
          ))}
          {faqs && filtered.length === 0 && (
            <div className="empty-state">
              <div className="emoji">💬</div>
              {faqs.length === 0 ? 'Chưa có câu hỏi nào — thêm câu đầu tiên để AI học nhé' : 'Không tìm thấy câu hỏi phù hợp'}
            </div>
          )}
        </div>
      </div>

      <AskAiBox />

      {editing && (
        <FaqFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(f, isNew) => {
            setFaqs((prev) => (isNew ? [f, ...prev!] : prev!.map((x) => (x.id === f.id ? f : x))));
            setEditing(null);
            toast(isNew ? 'Đã thêm câu hỏi mới — AI sẽ dùng ngay' : 'Đã cập nhật câu hỏi');
          }}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Xoá câu hỏi này?"
        message={<>AI sẽ không dùng câu trả lời cho “<b>{toDelete?.question}</b>” nữa.</>}
        confirmLabel="Xoá"
        busy={deleting}
        onConfirm={onDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
