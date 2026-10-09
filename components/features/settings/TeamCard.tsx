'use client';
import { useMemo, useState } from 'react';
import { useMockDbVersion } from '@/lib/hooks/useMockDbVersion';
import { savedMembers, saveMember, deleteMember } from '@/lib/services/settingsData';
import { initials } from '@/lib/utils/format';
import type { Member } from '@/lib/types/admin';
import { IconEdit, IconTrash } from '@/components/ui/Icons';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { errorMessage, useToast } from '@/components/shared/ToastProvider';

const empty = { name: '', email: '', role: 'staff' as Member['role'] };
export function TeamCard() {
  const version = useMockDbVersion();
  const members = useMemo(() => version < 0 ? [] : savedMembers(), [version]);
  const [form, setForm] = useState<{ id?: string; name: string; email: string; role: Member['role'] }>(empty);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [toRemove, setToRemove] = useState<Member | null>(null);
  const toast = useToast();
  const edit = (member?: Member) => { setForm(member ? { id: member.id, name: member.name, email: member.email, role: member.role } : empty); setError(''); setOpen(true); };
  const save = () => {
    try { saveMember(form); setOpen(false); toast(form.id ? 'Đã cập nhật nhân viên' : 'Đã thêm nhân viên'); }
    catch (error) { setError(errorMessage(error)); }
  };
  return <div className="card">
    <div className="card-head">
      <h2>Nhân viên</h2>
      <div className="head-actions"><span className="hint">{members.length} thành viên</span>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => edit()}>+ Thêm nhân viên</button>
      </div>
    </div>
    {members.map((member) => <div className="team-row" key={member.id}>
      <div className="avatar">{initials(member.name)}</div>
      <div className="team-info"><div className="t-name">{member.name}</div><div className="t-email">{member.email}</div></div>
      <span>{member.role === 'owner' ? 'Chủ shop' : 'Nhân viên'}</span>
      <div className="team-actions">
        <button type="button" className="btn-icon" aria-label={'Chỉnh sửa ' + member.name} title="Chỉnh sửa" onClick={() => edit(member)}><IconEdit /></button>
        <button type="button" className="btn-icon" aria-label={'Xóa ' + member.name} title="Xóa" onClick={() => setToRemove(member)}><IconTrash /></button>
      </div>
    </div>)}
    <Modal open={open} title={form.id ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên'} onClose={() => setOpen(false)}>
      <form onSubmit={(event) => { event.preventDefault(); save(); }}>
        <div className="field"><label htmlFor="member-name">Họ tên</label><input id="member-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={200} /></div>
        <div className="field" style={{ marginTop: 16 }}><label htmlFor="member-email">Email</label><input id="member-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required maxLength={320} /></div>
        <div className="field" style={{ marginTop: 16 }}><label htmlFor="member-role">Vai trò</label><select id="member-role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Member['role'] })}><option value="staff">Nhân viên</option><option value="owner">Chủ shop</option></select></div>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="card-actions"><button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>Hủy</button><button type="submit" className="btn btn-primary">Lưu</button></div>
      </form>
    </Modal>
    <ConfirmDialog open={Boolean(toRemove)} title="Xóa nhân viên?" message={<>Xóa <b>{toRemove?.name}</b> khỏi danh sách nhân viên?</>} confirmLabel="Xóa"
      onClose={() => setToRemove(null)} onConfirm={() => {
        if (!toRemove) return;
        try { deleteMember(toRemove.id); setToRemove(null); toast('Đã xóa nhân viên'); }
        catch (error) { toast(errorMessage(error), 'error'); }
      }} />
  </div>;
}
