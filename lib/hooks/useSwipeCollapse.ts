'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';

export function useSwipeCollapse(axis: 'x' | 'y' = 'y') {
  const [collapsed, setCollapsed] = useState(false);
  const gesture = useRef<{ id: number; x: number; y: number; element: HTMLElement; dragging: boolean } | null>(null);
  const suppressClick = useRef(0);

  const reset = useCallback(() => {
    const current = gesture.current;
    gesture.current = null;
    if (!current) return;
    current.element.style.removeProperty('--swipe-offset');
    delete current.element.dataset.dragging;
    if (current.element.hasPointerCapture(current.id)) current.element.releasePointerCapture(current.id);
  }, []);

  useEffect(() => {
    window.addEventListener('blur', reset);
    window.addEventListener('resize', reset);
    return () => {
      window.removeEventListener('blur', reset);
      window.removeEventListener('resize', reset);
      reset();
    };
  }, [reset]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    suppressClick.current = 0;
    if (!event.isPrimary || event.pointerType === 'mouse' || !window.matchMedia('(max-width: 880px)').matches) return;
    if ((event.target as Element).closest('input, textarea, select, [contenteditable="true"]')) return;
    reset();
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, element: event.currentTarget, dragging: false };
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    const along = axis === 'x' ? dx : dy;
    const across = axis === 'x' ? dy : dx;
    if (!current.dragging) {
      if (Math.abs(across) > 8 && Math.abs(across) >= Math.abs(along)) { reset(); return; }
      if (Math.abs(along) < 8) return;
      current.dragging = true;
      current.element.setPointerCapture(event.pointerId);
      current.element.dataset.dragging = 'true';
    }
    event.preventDefault();
    const offset = collapsed ? Math.max(0, Math.min(100, along)) : Math.min(0, Math.max(-160, along));
    current.element.style.setProperty('--swipe-offset', `${offset}px`);
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    if (current.dragging) {
      suppressClick.current = performance.now() + 350;
      const distance = axis === 'x' ? event.clientX - current.x : event.clientY - current.y;
      if (Math.abs(distance) >= 40) setCollapsed(distance < 0);
    }
    reset();
  };

  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (event.detail && performance.now() < suppressClick.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick.current = 0;
    }
  };

  const onLostPointerCapture = (event: PointerEvent<HTMLElement>) => {
    if (event.target === event.currentTarget && gesture.current?.id === event.pointerId) reset();
  };

  return { collapsed, setCollapsed, handlers: { 'data-swipe-axis': axis, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: reset, onLostPointerCapture, onClickCapture } };
}
