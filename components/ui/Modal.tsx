'use client';

import React, { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconClose } from './Icons';

interface ModalProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({ open, title, onClose, children, footer, width = 520 }: ModalProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const titleId = useId();
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current(); }
      if (e.key !== 'Tab') return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]') ?? []).filter(el => el.getClientRects().length && !el.matches(':disabled'));
      const first = controls[0], last = controls.at(-1);
      if (!first) { e.preventDefault(); dialog.current?.focus(); }
      else if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  // render tại chỗ (không portal ra body) để vẫn nằm trong .admin-root / .customer-root và nhận CSS đã scope
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ maxWidth: width }}>
        <div className="modal-head">
          <h3 id={titleId}>{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Đóng"><IconClose /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Xác nhận', busy, onConfirm, onClose }: ConfirmProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      width={420}
      footer={
        <>
          <button className="btn btn-outline btn-sm" onClick={onClose} disabled={busy}>Huỷ</button>
          <button className="btn btn-danger btn-sm" onClick={onConfirm} disabled={busy}>
            {busy && <span className="spinner" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 14, color: 'var(--ink-soft)' }}>{message}</p>
    </Modal>
  );
}
