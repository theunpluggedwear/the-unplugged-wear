/**
 * Ref-counted body scroll lock shared by overlays (Modal, Drawer, ...).
 *
 * Each `lockBodyScroll()` call returns an idempotent unlock. The original inline
 * `overflow` value is captured once and restored only when the last overlay
 * unlocks, so closing one overlay cannot unlock the page behind another.
 */
let lockCount = 0;
let originalOverflow: string | null = null;

export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') return () => {};

  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.style.overflow = originalOverflow ?? '';
      originalOverflow = null;
    }
  };
}
