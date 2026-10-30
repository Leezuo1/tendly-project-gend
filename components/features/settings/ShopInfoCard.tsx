'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { DEFAULT_LOGO } from '@/components/shared/ShopProvider';
import { errorMessage, useToast } from '@/components/shared/ToastProvider';
import { TIMEZONES } from '@/lib/data/admin';
import { industries, avatarOptions, toneOptions } from '@/lib/data/workspace';
import { subscribeMockOnboarding } from '@/lib/services/mockOnboarding';
import { settingsShopApi as shopApi } from '@/lib/services/settingsData';
import type { Shop } from '@/lib/types/admin';
import { isEmail, isPhone } from '@/lib/utils/format';
import { IconEdit } from '@/components/ui/Icons';

type Errors = Partial<Record<'name' | 'email' | 'phone', string>>;

function validate(form: Shop): Errors {
  const errors: Errors = {};
  if (form.industry && (!form.name.trim() || form.name.trim().length > 80)) errors.name = 'Tên shop cần từ 1 đến 80 ký tự';
  if (form.email.trim() && !isEmail(form.email)) errors.email = 'Email không hợp lệ';
  if (form.phone.trim() && !isPhone(form.phone)) errors.phone = 'Số điện thoại không hợp lệ (VD: 090 123 4567)';
  return errors;
}

const MAX_LOGO_SIZE = 1024 * 1024; // 1MB, tránh làm đầy localStorage

export function ShopInfoCard() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState<Shop | null>(null);
  const [form, setForm] = useState<Shop | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (editing) return;
    const refresh = () => { void shopApi.get().then((s) => { setSaved(s); setForm(s); }); };
    refresh();
    return subscribeMockOnboarding(refresh);
  }, [editing]);

  if (!form || !saved) return <div className="card"><div className="skeleton" style={{ height: 220 }} /></div>;

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const avatarSymbol = form.avatar === 'initial' ? Array.from(form.name.trim())[0]?.toUpperCase() || 'T'
    : avatarOptions.find(option => option.value === form.avatar)?.symbol;
  const set = (key: keyof Shop) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [key]: e.target.value });
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const onPickLogo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('Vui lòng chọn file ảnh (PNG, JPG...)', 'error');
    if (file.size > MAX_LOGO_SIZE) return toast('Ảnh tối đa 1MB nha', 'error');
    const reader = new FileReader();
    reader.onload = () => setForm((f) => (f ? { ...f, logo: reader.result as string } : f));
    reader.readAsDataURL(file);
  };

  const onSave = async () => {
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const updated = await shopApi.update({ ...form, name: form.name.trim(), email: form.email.trim() });
      setSaved(updated);
      setForm(updated);
      setEditing(false);
      toast('Đã lưu thông tin shop');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="card-head"><h2>Thông tin tài khoản & shop</h2>
        <button type="button" className="btn-icon" aria-label="Chỉnh sửa thông tin tài khoản và shop" title="Chỉnh sửa" onClick={() => setEditing(true)}><IconEdit /></button>
      </div>
      <p className="setup-sync-note">Thông tin không gian làm việc dùng chung với bước thiết lập ban đầu và Smart Sourcing.</p>
      <fieldset disabled={!editing || saving} className="settings-fields">
      <div className="logo-row">
        <div className={`logo-circle workspace-tone-${form.avatarTone || 'coral'}`}>
          {!form.logo && avatarSymbol ? <span className="workspace-symbol" aria-label={`Biểu tượng ${form.name}`}>{avatarSymbol}</span>
            : <img src={form.logo ?? DEFAULT_LOGO} alt={form.name} className={form.logo ? 'custom' : ''} />}
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>Đổi ảnh</button>
        {form.logo && (
          <button className="btn btn-text btn-sm" onClick={() => setForm({ ...form, logo: null })}>Dùng logo mặc định</button>
        )}
        <span className="logo-hint">PNG, JPG tối đa 1MB</span>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickLogo} />
      </div>

      <div className="field-row workspace-appearance">
        <div className="field"><label htmlFor="shop-avatar">Biểu tượng workspace</label><select id="shop-avatar" value={form.avatar || 'initial'} onChange={set('avatar')}>
          {avatarOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></div>
        <div className="field"><label htmlFor="shop-tone">Màu nền biểu tượng</label><select id="shop-tone" value={form.avatarTone || 'coral'} onChange={set('avatarTone')}>
          {toneOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="shop-owner">Tên chủ shop</label>
          <input id="shop-owner" value={form.ownerName || ''} onChange={set('ownerName')} />
        </div>
      </div>
      <div className="field-row" style={{ marginTop: 16 }}>
        <div className={`field${errors.name ? ' has-error' : ''}`}>
          <label htmlFor="shop-name">Tên shop</label>
          <input id="shop-name" value={form.name} maxLength={80} onChange={set('name')} aria-invalid={!!errors.name} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </div>
        <div className={`field${errors.email ? ' has-error' : ''}`}>
          <label htmlFor="shop-email">Email liên hệ</label>
          <input id="shop-email" type="email" value={form.email} onChange={set('email')} />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </div>
      </div>
      <div className="field-row" style={{ marginTop: 16 }}>
        <div className="field"><label htmlFor="shop-industry">Ngành hàng</label>
          <select id="shop-industry" value={form.industry || ''} onChange={set('industry')}>
            <option value="" disabled>Chọn ngành hàng của shop</option>
            {form.industry && !industries.includes(form.industry) && <option>{form.industry}</option>}
            {industries.map(value => <option key={value}>{value}</option>)}
          </select>
          <span className="logo-hint">Smart Sourcing gợi ý xu hướng và nguồn hàng theo ngành này.</span>
        </div>
      </div>
      <div className="field-row" style={{ marginTop: 16 }}>
        <div className={`field${errors.phone ? ' has-error' : ''}`}>
          <label htmlFor="shop-phone">Số điện thoại</label>
          <input id="shop-phone" type="tel" value={form.phone} onChange={set('phone')} />
          {errors.phone && <span className="field-error">{errors.phone}</span>}
        </div>
        <div className="field">
          <label htmlFor="shop-tz">Múi giờ</label>
          <select id="shop-tz" value={form.timezone} onChange={set('timezone')}>
            {!TIMEZONES.includes(form.timezone) && <option>{form.timezone}</option>}
            {TIMEZONES.map((tz) => <option key={tz}>{tz}</option>)}
          </select>
        </div>
      </div>

      </fieldset>
      {editing && <div className="card-actions">
        {dirty && <span className="dirty-note">Có thay đổi chưa lưu</span>}
        <button className="btn btn-outline" onClick={() => { setForm(saved); setErrors({}); setEditing(false); }} disabled={saving}>Huỷ</button>
        <button className="btn btn-primary" onClick={onSave} disabled={!dirty || saving}>
          {saving && <span className="spinner" />}
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </div>}
    </div>
  );
}
