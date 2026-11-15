'use client';

import { Switch } from '@/components/ui/Switch';
import { AI_RULE_FIELDS, defaultAiRules, effectiveAiRules, type AiPlatform, type AiProfile, type AiRoleId } from '@/lib/services/aiConfiguration';
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
  function template() {
    const values = defaultAiRules(role);
    if (role === 'content' && platform === 'instagram') values.format = 'Caption ngắn, lợi ích nổi bật, tối đa 5 hashtag phù hợp';
    if (role === 'content' && platform === 'facebook') values.format = 'Mở đầu thu hút, 3 lợi ích chính, giá đã xác nhận và CTA nhắn tin';
    if (platform) setOverride(true, values); else onChange({ rules: values });
  }
  return <>
    {platform && <div className={styles.switchRow}><div><strong>Tùy chỉnh cho nền tảng này</strong><p>Các mục chưa tùy chỉnh sẽ dùng quy tắc mặc định.</p></div><Switch checked={override?.enabled ?? false} disabled={disabled} label="Tùy chỉnh cho nền tảng này" onChange={enabled => setOverride(enabled, override?.values ?? {})} /></div>}
    <div className={styles.templateRow}><p>Bắt đầu với mẫu có sẵn, rồi chỉnh theo shop.</p><button type="button" className="btn btn-outline btn-sm" disabled={disabled || (!!platform && !override?.enabled)} onClick={template}>Dùng mẫu gợi ý</button></div>
    {AI_RULE_FIELDS[role].map(field => {
      const customized = !!override?.enabled && Object.hasOwn(override.values, field.key);
      const off = disabled || (!!platform && !customized);
      return <div className={styles.ruleField} key={field.key}>
        <div className={styles.fieldHeading}><label htmlFor={`rule-${role}-${field.key}`}>{field.label}</label>{platform && override?.enabled && <label className={styles.checkLabel}><input type="checkbox" aria-label={`Tùy chỉnh ${field.label}`} disabled={disabled} checked={customized} onChange={event => {
          const values = { ...override.values };
          if (event.target.checked) values[field.key] = profile.rules[field.key]; else delete values[field.key];
          setOverride(true, values);
        }} />Tùy chỉnh</label>}</div>
        {field.type === 'check' ? <label className={styles.checkLabel}><input id={`rule-${role}-${field.key}`} type="checkbox" disabled={off} checked={rules[field.key] === 'yes'} onChange={event => setRule(field.key, event.target.checked ? 'yes' : 'no')} />Kiểm tra tiêu chí này</label>
          : field.type === 'number' ? <input id={`rule-${role}-${field.key}`} type="number" min={0} step={1} disabled={off} value={rules[field.key]} placeholder="Không giới hạn" onChange={event => setRule(field.key, event.target.value)} />
          : <textarea id={`rule-${role}-${field.key}`} rows={2} maxLength={500} disabled={off} value={rules[field.key]} required onChange={event => setRule(field.key, event.target.value)} />}
        {platform && !customized && <small>Dùng quy tắc mặc định</small>}
      </div>;
    })}
  </>;
}
