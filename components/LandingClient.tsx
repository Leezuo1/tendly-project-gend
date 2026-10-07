'use client';
import { useEffect } from 'react';

export default function LandingClient() {
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
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, observerOptions);

    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach((el) => {
      revealObserver.observe(el);
    });

    // Trigger reveal for hero elements on load
    document.querySelectorAll('.hero .reveal, .hero .reveal-left, .hero .reveal-right').forEach((el) => {
      el.classList.add('visible');
    });

    // Stats counter animation
    const statNumbers = document.querySelectorAll('.stat-number');
    let animatedStats = false;
    const statsObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !animatedStats) {
          animatedStats = true;
          statNumbers.forEach((el) => {
            const target = parseInt(el.getAttribute('data-target') || '0');
            const duration = 2000;
            const startTime = performance.now();
            function animate(currentTime: number) {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              (el as HTMLElement).textContent = Math.floor(eased * target).toLocaleString();
              if (progress < 1) requestAnimationFrame(animate);
              else (el as HTMLElement).textContent = target.toLocaleString();
            }
            requestAnimationFrame(animate);
          });
        }
      });
    }, { threshold: 0.3 });
    statNumbers.forEach((el) => statsObserver.observe(el));

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const href = (anchor as HTMLAnchorElement).getAttribute('href');
        if (href) {
          const target = document.querySelector(href);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      revealObserver.disconnect();
      statsObserver.disconnect();
    };
  }, []);

  return null;
}
