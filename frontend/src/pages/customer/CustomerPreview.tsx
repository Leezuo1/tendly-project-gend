import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import './customer.css';

interface Props {
  note: string;
  onReset?: () => void;
  resetLabel?: string;
  variant?: 'widget' | 'mail';
  children: ReactNode;
}

/** Khung chung cho các trang "góc nhìn khách hàng" */
export function CustomerPreview({ note, onReset, resetLabel = 'Làm mới', variant = 'widget', children }: Props) {
  return (
    <div className={variant === 'mail' ? 'mail-page' : 'preview-page'}>
      <div className="backdrop-note">
        <span>{note}</span>
        <span className="note-actions">
          {onReset && <button className="note-btn" onClick={onReset}>↻ {resetLabel}</button>}
          <Link className="note-btn" to="/cau-hinh-ai">← Trang quản trị</Link>
        </span>
      </div>
      {variant === 'widget' && (
        <div className="host-page" aria-hidden="true">
          <div className="host-bar" />
          <div className="host-body" />
        </div>
      )}
      {children}
    </div>
  );
}
