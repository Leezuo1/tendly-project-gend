'use client';

import { IconEdit } from '@/components/ui/Icons';
import { AI_PLATFORMS, AI_RULE_FIELDS, defaultAiRules, effectiveAiRules, type AiPlatform, type AiProfile, type AiRoleId } from '@/lib/services/aiConfiguration';
import styles from './ai-configuration.module.css';

/** Bộ quy tắc của một AI: bản mặc định, hoặc bản tùy chỉnh riêng cho một nền tảng. Dùng chung cho mọi AI. */
export function RuleFields({ role, profile, platform, disabled, onChange }: {
  role: AiRoleId; profile: AiProfile; platform?: AiPlatform; disabled?: boolean; onChange: (patch: Partial<AiProfile>) => void;
}) {
  const override = platform ? profile.platformRules[platform] : undefined;
  const rules = effectiveAiRules(profile, platform);
  const setOverride = (enabled: boolean, values: Record<string, string>) => onChange({ platformRules: { ...profile.platformRules, [platform!]: { enabled, values } } });
  function setRule(key: string, value: string) {
    if (!platform) onChange({ rules: { ...profile.rules, [key]: value } });
    else setOverride(true, { ...override?.values, [key]: value });
  }
  // Một nút bút chì mở toàn bộ quy tắc của nền tảng để chỉnh; ô nào chưa có giá trị riêng được điền sẵn bằng quy tắc mặc định.
  const customize = () => setOverride(true, Object.fromEntries(AI_RULE_FIELDS[role].map(field => [field.key, override?.values[field.key] ?? profile.rules[field.key]])));
  // Sau khi bật, ô quy tắc đầu tiên mới được mở khóa ở lần vẽ kế tiếp nên đợi một khung hình rồi mới đưa con trỏ vào.
  const edit = () => {
    if (!override?.enabled) customize();
    requestAnimationFrame(() => document.getElementById(`rule-${role}-${AI_RULE_FIELDS[role][0].key}`)?.focus());
  };
  function template() {
    const values = defaultAiRules(role);
    if (role === 'content' && platform === 'instagram') values.format = 'Caption ngắn, lợi ích nổi bật, tối đa 5 hashtag phù hợp';
    if (role === 'content' && platform === 'facebook') values.format = 'Mở đầu thu hút, 3 lợi ích chính, giá đã xác nhận và CTA nhắn tin';
    if (platform) setOverride(true, values); else onChange({ rules: values });
  }
  return <>
    {platform && <div className={styles.switchRow}><div><strong>Quy tắc cho {AI_PLATFORMS[platform]}</strong><p>{override?.enabled ? 'Đang dùng quy tắc riêng. Chỉnh các ô bên dưới.' : 'Đang dùng quy tắc mặc định. Bấm bút chì để chỉnh riêng cho nền tảng này.'}</p></div>
      <div className={styles.rowActions}>{override?.enabled && <button type="button" className="btn btn-text btn-sm" disabled={disabled} onClick={() => setOverride(false, override.values)}>Dùng lại mặc định</button>}
        <button type="button" className={styles.pencil} data-active={!!override?.enabled} aria-label={`Tùy chỉnh toàn bộ quy tắc cho ${AI_PLATFORMS[platform]}`} title="Tùy chỉnh toàn bộ quy tắc" disabled={disabled} onClick={edit}><IconEdit width={18} height={18} /></button></div></div>}
    <div className={styles.templateRow}><p>Bắt đầu với mẫu có sẵn, rồi chỉnh theo shop.</p><button type="button" className="btn btn-outline btn-sm" disabled={disabled || (!!platform && !override?.enabled)} onClick={template}>Dùng mẫu gợi ý</button></div>
    {AI_RULE_FIELDS[role].map(field => {
      const off = disabled || (!!platform && !override?.enabled);
      return <div className={styles.ruleField} key={field.key}>
        <div className={styles.fieldHeading}><label htmlFor={`rule-${role}-${field.key}`}>{field.label}</label></div>
        {field.type === 'check' ? <label className={styles.checkLabel}><input id={`rule-${role}-${field.key}`} type="checkbox" disabled={off} checked={rules[field.key] === 'yes'} onChange={event => setRule(field.key, event.target.checked ? 'yes' : 'no')} />Kiểm tra tiêu chí này</label>
          : field.type === 'number' ? <input id={`rule-${role}-${field.key}`} type="number" min={0} step={1} disabled={off} value={rules[field.key]} placeholder="Không giới hạn" onChange={event => setRule(field.key, event.target.value)} />
          : <textarea id={`rule-${role}-${field.key}`} rows={2} maxLength={500} disabled={off} value={rules[field.key]} required onChange={event => setRule(field.key, event.target.value)} />}
      </div>;
    })}
  </>;
}
