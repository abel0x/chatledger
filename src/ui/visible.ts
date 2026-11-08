import type { Action } from 'svelte/action';

const callbacks = new WeakMap<Element, () => void>();
let observer: IntersectionObserver | null = null;

function shared(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        observer?.unobserve(e.target);
        callbacks.get(e.target)?.();
        callbacks.delete(e.target);
      }
    },
    { rootMargin: '600px 0px' },
  );
  return observer;
}

/** Calls back once, shortly before the element scrolls into view. */
export const visible: Action<Element, () => void> = (node, callback) => {
  callbacks.set(node, callback);
  shared().observe(node);
  return {
    destroy() {
      callbacks.delete(node);
      observer?.unobserve(node);
    },
  };
};
