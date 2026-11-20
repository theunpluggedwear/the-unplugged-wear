'use client';

import { useEffect } from 'react';

// Module-scoped so every overlay in the admin app shares a single lock.
// Previously each Modal/Drawer set body.overflow = 'hidden' and reset it to
// '' on cleanup, so closing one of two overlapping overlays unlocked scroll
// behind the one still open. Ref-counting keeps the lock until the last
// overlay releases it, and restores the value that was present before the
// first lock was taken (it may not have been empty).
let lockCount = 0;
let previousOverflow = '';

/** Acquire the shared body-scroll lock. Returns an idempotent release fn. */
export function lockBodyScroll(): () => void {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount -= 1;
    if (lockCount === 0) {
      document.body.style.overflow = previousOverflow;
      previousOverflow = '';
    }
  };
}

/** Locks body scrolling while `active` is true. The previous overflow value
 * is restored only once the last active overlay releases the shared lock. */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    return lockBodyScroll();
  }, [active]);
}
