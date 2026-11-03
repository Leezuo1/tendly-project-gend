'use client';

import { useEffect } from 'react';

// Content is visible without script; `data-js` switches the hidden-until-seen state on.
export function LandingMotion() {
  useEffect(() => {
    const root = document.getElementById('landing-root');
    if (!root) return;
    root.dataset.js = '1';
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        (e.target as HTMLElement).dataset.in = '1';
        io.unobserve(e.target);
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    // A clipped-away element can read as not intersecting, so the shutter watches its parent.
    const parents = new Map<Element, HTMLElement>();
    root.querySelectorAll<HTMLElement>('[data-shutter]').forEach(el => { if (el.parentElement) parents.set(el.parentElement, el); });
    const seen = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = parents.get(e.target);
        if (el) el.dataset.in = '1';
        seen.unobserve(e.target);
      }
    }, { threshold: 0.12 });
    parents.forEach((_, p) => seen.observe(p));
    root.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));

    // Page progress for the header bar; a short drift on the hero photo while the hero is on screen.
    const hero = root.querySelector<HTMLElement>('[data-parallax]');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      root.style.setProperty('--sp', String(max > 0 ? scrollY / max : 0));
      if (hero) hero.style.setProperty('--py', reduce.matches ? '0' : String(-Math.min(scrollY, innerHeight) * 0.12));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);

    return () => {
      io.disconnect(); seen.disconnect(); cancelAnimationFrame(raf);
      removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll);
      delete root.dataset.js;
    };
  }, []);
  return null;
}
