import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const TARGET_SELECTOR = [
  '.page-hero',
  '.page-heading',
  '.glass-panel',
  '.glass-card',
  '.content-panel',
  '.recipe-list-item',
  '.meal-list-item',
  '.conversation-item',
  '.message'
].join(', ');

export default function RouteSceneAnimator() {
  const location = useLocation();

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      return;
    }

    const targets = Array.from(document.querySelectorAll(TARGET_SELECTOR)).slice(0, 18);
    if (targets.length === 0) {
      return;
    }

    // Batch all style resets in a single pass without reading offsetWidth in a loop
    for (let i = 0; i < targets.length; i++) {
      targets[i].style.animation = 'none';
    }

    let rafId2 = null;
    const rafId1 = window.requestAnimationFrame(() => {
      rafId2 = window.requestAnimationFrame(() => {
        for (let i = 0; i < targets.length; i++) {
          targets[i].style.animation = `route-entrance 0.86s cubic-bezier(0.215, 0.61, 0.355, 1) ${i * 0.05}s forwards`;
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(rafId1);
      if (rafId2 !== null) {
        window.cancelAnimationFrame(rafId2);
      }
    };
  }, [location.pathname]);

  return null;
}
