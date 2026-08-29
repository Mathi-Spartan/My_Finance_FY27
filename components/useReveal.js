'use client';
import { useEffect } from 'react';

// Adds `.seen` to elements as they scroll into view, so the list animates as
// you move through it rather than only on first paint. Chrome and Android
// Chrome get true scroll-linked motion from CSS; this drives the fallback for
// everything else, and keeps the two in step.
export default function useReveal(deps = []) {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('seen'));
      return;
    }
    // native scroll timelines already handle it; a second animation would fight
    if (CSS.supports?.('animation-timeline: view()')) return;

    // Safety net: if neither path runs for any reason, nothing may stay hidden.
    const failsafe = setTimeout(() => {
      document.querySelectorAll('[data-reveal]:not(.seen)').forEach((el) => el.classList.add('seen'));
    }, 1400);

    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('seen');
      }),
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    const nodes = document.querySelectorAll('[data-reveal]:not(.seen)');
    nodes.forEach((n) => io.observe(n));
    return () => { clearTimeout(failsafe); io.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
