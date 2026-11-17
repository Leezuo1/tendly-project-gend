'use client';

import { useState } from 'react';
import type { StaffLabelAction } from '@/lib/services/contextTagRules';
import type { ContextTagRule } from '@/lib/types/contextTags';
import type { ConversationTag } from '@/lib/types/inbox';

interface LabelBarProps {
  tags: ConversationTag[];
  rules: ContextTagRule[];
  /** Gửi đúng một thao tác; máy chủ áp lên nhãn đang lưu nên máy này không ghi đè nhãn người khác vừa đổi. */
  onChange: (action: StaffLabelAction) => Promise<void>;
  disabled?: boolean;
}

/** Nhãn của hội thoại ngay trên ô nhập tin: nhân viên dán thêm từ bộ nhãn của shop hoặc gỡ nhãn ngữ cảnh sai. */
export function LabelBar({ tags, rules, onChange, disabled }: LabelBarProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = disabled || saving;
  const choices = rules.filter(rule => rule.enabled && !tags.some(tag => tag.id === rule.id));
  const apply = async (action: StaffLabelAction) => {
    setSaving(true); setOpen(false);
    try { await onChange(action); } finally { setSaving(false); }
  };

  return (
    <div className="label-bar" role="group" aria-label="Nhãn hội thoại" onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>
      {tags.map(tag => (
        <span key={tag.id ?? `${tag.kind}-${tag.label}`} className={`tag tag-${tag.type}`}>
          {tag.label}{tag.source === 'ai' && tag.kind === 'context' && <small className="label-bar-ai">AI</small>}
          {tag.kind === 'context' && tag.id && (
            <button type="button" className="label-bar-remove" aria-label={`Gỡ nhãn ${tag.label}`} disabled={busy}
              onClick={() => void apply({ type: tag.source === 'staff' ? 'removeStaff' : 'hideRule', id: tag.id! })}>×</button>
          )}
        </span>
      ))}
      <div className="label-bar-add">
        <button type="button" className="label-bar-toggle" aria-label="Thêm nhãn" aria-expanded={open}
          disabled={busy || !choices.length}
          onClick={() => setOpen(value => !value)}>+ Nhãn</button>
        {open && (
          <div className="label-bar-menu" role="group" aria-label="Chọn nhãn để thêm">
            {choices.map(rule => (
              <button key={rule.id} type="button" className={`tag tag-${rule.type}`}
                onClick={() => void apply({ type: 'add', id: rule.id })}>{rule.label}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
