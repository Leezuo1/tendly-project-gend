'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { IconRefresh, IconTrash } from '@/components/ui/Icons';
import { ConfirmDialog } from '@/components/ui/Modal';
import { errorMessage, useToast } from '@/components/shared/ToastProvider';
import { memberApi } from '@/lib/services/api';
import type { Member, MemberRole } from '@/lib/types/admin';
import { initials, isEmail } from '@/lib/utils/format';

export function TeamCard() {
  const toast = useToast();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('staff');
  const [error, setError] = useState('');
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<Member | null>(null);

  useEffect(() => { memberApi.list().then(setMembers); }, []);

  if (!members) return <div className="card"><div className="skeleton" style={{ height: 240 }} /></div>;

  const onInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) return setError('Email không hợp lệ');
    setInviting(true);
    try {
      const m = await memberApi.invite(email, role);
      setMembers((prev) => [...(prev ?? []), m]);
      setEmail('');
      setRole('staff');
      toast(`Đã gửi lời mời đến ${m.email}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setInviting(false);
    }
  };

  const onRoleChange = async (m: Member, next: MemberRole) => {
    setBusyId(m.id);
    try {
      const updated = await memberApi.updateRole(m.id, next);
      setMembers((prev) => prev!.map((x) => (x.id === m.id ? updated : x)));
      toast(`${m.name} giờ là ${next === 'owner' ? 'Chủ shop' : 'Nhân viên'}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const onResend = async (m: Member) => {
    setBusyId(m.id);
    try {
      await memberApi.resendInvite(m.id);
      toast(`Đã gửi lại lời mời cho ${m.email}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const onConfirmRemove = async () => {
    if (!toRemove) return;
    setBusyId(toRemove.id);
    try {
      await memberApi.remove(toRemove.id);
      setMembers((prev) => prev!.filter((x) => x.id !== toRemove.id));
      toast(`Đã xoá ${toRemove.name} khỏi shop`);
      setToRemove(null);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card">
      <div className="card-head">
        <h2>Nhân viên</h2>
        <span className="hint">{members.length} thành viên</span>
      </div>

      {members.map((m) => (
        <div className="team-row" key={m.id}>
          <div className="avatar">{initials(m.name)}</div>
          <div className="team-info">
            <div className="t-name">{m.name}</div>
            <div className="t-email">{m.email}</div>
          </div>
          <select
            className={`role-select ${m.role}`}
            value={m.role}
            disabled={busyId === m.id}
            onChange={(e) => onRoleChange(m, e.target.value as MemberRole)}
            aria-label={`Vai trò của ${m.name}`}
          >
            <option value="owner">Chủ shop</option>
            <option value="staff">Nhân viên</option>
          </select>
          <div className="status">
            <span className={`dot ${m.status === 'active' ? 'dot-on' : 'dot-pending'}`} />
            {m.status === 'active' ? 'Đang hoạt động' : 'Đã mời — chờ xác nhận'}
          </div>
          <div className="team-actions">
            {busyId === m.id && <span className="spinner" style={{ color: 'var(--ink-soft)' }} />}
            {m.status === 'pending' && (
              <button className="btn-icon" title="Gửi lại lời mời" aria-label="Gửi lại lời mời" onClick={() => onResend(m)} disabled={busyId === m.id}>
                <IconRefresh />
              </button>
            )}
            <button className="btn-icon" title="Xoá khỏi shop" aria-label={`Xoá ${m.name}`} onClick={() => setToRemove(m)} disabled={busyId === m.id}>
              <IconTrash />
            </button>
          </div>
        </div>
      ))}

      <form className="invite-row" onSubmit={onInvite}>
        <div className="invite-input">
          <input
            className={`input${error ? ' has-error' : ''}`}
            type="email"
            placeholder="Nhập email nhân viên cần mời"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
          />
          {error && <span className="field-error">{error}</span>}
        </div>
        <select className="input" value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
          <option value="staff">Nhân viên</option>
          <option value="owner">Chủ shop</option>
        </select>
        <button className="btn btn-primary btn-sm" type="submit" disabled={inviting || !email.trim()} style={{ height: 42 }}>
          {inviting && <span className="spinner" />}
          Gửi lời mời
        </button>
      </form>

      <ConfirmDialog
        open={!!toRemove}
        title="Xoá nhân viên?"
        message={<>Bạn chắc chắn muốn xoá <b>{toRemove?.name}</b> ({toRemove?.email}) khỏi shop? Người này sẽ không truy cập được Hộp thoại nữa.</>}
        confirmLabel="Xoá nhân viên"
        busy={!!toRemove && busyId === toRemove.id}
        onConfirm={onConfirmRemove}
        onClose={() => setToRemove(null)}
      />
    </div>
  );
}
