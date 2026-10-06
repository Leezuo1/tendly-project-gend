'use client';

import { useEffect } from 'react';

export function useScrollReveal() {
  useEffect(() => {
    // Nav scroll effect
    const nav = document.getElementById('nav');
    const handleScroll = () => {
      if (nav) nav.classList.toggle('scrolled', window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);

    // Scroll reveal with IntersectionObserver
    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -60px 0px',
      threshold: 0.15,
    };

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, observerOptions);

    const elementsToReveal = document.querySelectorAll(
      '.reveal, .reveal-left, .reveal-right, .reveal-scale'
    );
    elementsToReveal.forEach((el) => {
      revealObserver.observe(el);
    });

    // Trigger reveal for hero elements on mount
    document
      .querySelectorAll('.hero .reveal, .hero .reveal-left, .hero .reveal-right')
      .forEach((el) => {
        el.classList.add('visible');
      });

    // Smooth scroll for anchor links
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (anchor) {
        const href = anchor.getAttribute('href');
        if (href && href.length > 1) {
          const dest = document.querySelector(href);
          if (dest) {
            e.preventDefault();
            dest.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleAnchorClick);
      revealObserver.disconnect();
    };
  }, []);
}
