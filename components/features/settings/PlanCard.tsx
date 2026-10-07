'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { errorMessage, useToast } from '@/components/shared/ToastProvider';
import { billingApi } from '@/lib/services/api';
import type { Plan, Subscription } from '@/lib/types/admin';
import { formatDate, formatMoney, formatNumber } from '@/lib/utils/format';

export function PlanCard() {
  const toast = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([billingApi.getPlans(), billingApi.getSubscription()]).then(([p, s]) => {
      setPlans(p);
      setSub(s);
    });
  }, []);

  const plan = plans.find((p) => p.id === sub?.planId);
  if (!sub || !plan) return <div className="card"><div className="skeleton" style={{ height: 140 }} /></div>;

  const percent = Math.min(100, Math.round((sub.used / plan.quota) * 100));
  const isTopPlan = plans[plans.length - 1].id === plan.id;

  const openModal = () => { setSelected(plan.id); setOpen(true); };

  const onConfirm = async () => {
    setSaving(true);
    try {
      const updated = await billingApi.changePlan(selected);
      setSub(updated);
      setOpen(false);
      toast(`Đã chuyển sang ${plans.find((p) => p.id === selected)?.name}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="card-head"><h2>Gói cước hiện tại</h2></div>
      <div className="plan-top">
        <div>
          <div className="plan-name">{plan.name}</div>
          <div className="plan-price">{plan.price ? `${formatMoney(plan.price)} / tháng` : 'Miễn phí'}</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={openModal}>
          {isTopPlan ? 'Đổi gói' : 'Nâng cấp gói'}
        </button>
      </div>
      <div className="usage">
        <div className="usage-label">
          <span>Hội thoại đã dùng tháng này</span>
          <span>{formatNumber(sub.used)} / {formatNumber(plan.quota)}</span>
        </div>
        <div className="usage-bar"><div className={`usage-fill${percent >= 90 ? ' warn' : ''}`} style={{ width: `${percent}%` }} /></div>
      </div>
      <div className="plan-renew">
        {percent >= 100 ? '⚠️ Đã vượt hạn mức — AI tạm ngưng trả lời tự động. ' : ''}
        Gia hạn tự động vào {formatDate(sub.renewAt)}
      </div>

      <Modal
        open={open}
        title="Chọn gói cước"
        onClose={() => !saving && setOpen(false)}
        footer={
          <>
            <button className="btn btn-outline btn-sm" onClick={() => setOpen(false)} disabled={saving}>Huỷ</button>
            <button className="btn btn-primary btn-sm" onClick={onConfirm} disabled={saving || selected === plan.id}>
              {saving && <span className="spinner" />}
              Xác nhận đổi gói
            </button>
          </>
        }
      >
        <div className="plan-options">
          {plans.map((p) => (
            <button key={p.id} className={`plan-option${selected === p.id ? ' selected' : ''}`} onClick={() => setSelected(p.id)}>
              <span className="radio" />
              <span className="po-body">
                <span className="po-top">
                  <span>{p.name}{p.id === plan.id && <span className="current-chip">Đang dùng</span>}</span>
                  <span className="po-price">{p.price ? `${formatMoney(p.price)}/th` : 'Miễn phí'}</span>
                </span>
                <span className="po-quota" style={{ display: 'block' }}>{formatNumber(p.quota)} hội thoại / tháng</span>
                <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
              </span>
            </button>
          ))}
        </div>
        {sub.used > (plans.find((p) => p.id === selected)?.quota ?? Infinity) && (
          <p className="field-error" style={{ marginTop: 12 }}>
            Gói này có hạn mức thấp hơn số hội thoại bạn đã dùng tháng này.
          </p>
        )}
      </Modal>
    </div>
  );
}
