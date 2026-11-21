'use client';

import { useEffect } from 'react';

/**
 * Site-wide scroll reveal for the storefront. Mounted once in the root layout,
 * it renders nothing and adapts to whatever page is showing.
 *
 * Finding what to animate ("units"): starting at `<main>`, a block is split
 * into its children while it is taller than most of the viewport or lays out
 * several sizeable items (grids, card rows). Everything else becomes one unit.
 * Leaf content (text, images, links, buttons, forms) always stays whole. This
 * works on any markup, so new pages and sections are covered automatically.
 *
 * When units move:
 * - Below the fold at first paint → hidden, then revealed once on scroll with
 *   a gentle stagger. They cannot be seen while hidden, so nothing flashes.
 * - Inserted later and already on screen (filters, search results, Load more,
 *   client-side boundaries) → animated in right away.
 * - On screen at first paint, sideways in a carousel, sticky or overlaid →
 *   left untouched.
 *
 * Media units (images, video, picture-led cards) settle from a slight zoom;
 * everything else rises softly. `data-reveal="done"` carries no styles, so each
 * element's own opacity, transforms and transitions return after the reveal.
 * Honors prefers-reduced-motion, reveals on keyboard focus, prints visible.
 * Opt out on any element (and its subtree) with `data-reveal-skip`.
 */

// Leaf content: never split.
const ATOMIC_TAGS = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A', 'BUTTON', 'IMG', 'PICTURE', 'VIDEO', 'SVG', 'svg', 'CANVAS',
  'IFRAME', 'FORM', 'TABLE', 'LABEL', 'INPUT', 'SELECT', 'TEXTAREA', 'BLOCKQUOTE', 'FIGURE', 'DL', 'PRE',
]);
const IGNORED_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'BR', 'HR', 'LINK', 'META']);
const MEDIA_TAGS = new Set(['IMG', 'PICTURE', 'VIDEO', 'FIGURE']);

// Subtrees that animate themselves or sit in overlays.
const EXCLUDED = '[data-reveal-skip], [role="dialog"], dialog, .vfr-room, .tuw-reveal-item';

const SPLIT_HEIGHT_RATIO = 0.6; // split blocks taller than 60% of the viewport
const MIN_ITEM_HEIGHT = 40; // children shorter than this are details, not items
const MIN_UNIT_HEIGHT = 8;
const MAX_DEPTH = 12;
const STAGGER_MS = 80;
const MAX_STAGGER_STEPS = 6;
const SETTLE_FALLBACK_MS = 1800;
const FRESH_INSERT_MS = 1500;

/**
 * Streamed <Suspense> boundaries hydrate after this effect runs. Touching their
 * server HTML early would surface as a hydration attribute mismatch, so only
 * nodes React has already claimed (it tags them with a fiber key) are marked;
 * later boundaries are picked up by the re-scans.
 */
function isHydrated(el: Element) {
  for (const key in el) if (key.startsWith('__reactFiber$')) return true;
  return false;
}

function isVisibleBox(rect: DOMRect) {
  return rect.width > 0 && rect.height >= MIN_UNIT_HEIGHT;
}

function isMediaUnit(el: HTMLElement) {
  if (MEDIA_TAGS.has(el.tagName)) return true;
  const media = el.querySelector('img, video, picture');
  return !!media && (el.textContent ?? '').trim().length < 40;
}

export default function ScrollReveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    // Nodes React inserted after mount, with when they arrived.
    const insertedAt = new WeakMap<Node, number>();
    let initialScanDone = false;

    const isFreshInsert = (el: HTMLElement) => {
      const now = performance.now();
      for (let node: HTMLElement | null = el; node && node.tagName !== 'MAIN'; node = node.parentElement) {
        const at = insertedAt.get(node);
        if (at !== undefined) return now - at < FRESH_INSERT_MS;
      }
      return false;
    };

    const reveal = (el: HTMLElement, delayMs = 0) => {
      if (el.dataset.reveal !== 'pending') return;
      observer.unobserve(el);
      if (delayMs) el.style.transitionDelay = `${delayMs}ms`;
      el.dataset.reveal = 'shown';
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        el.removeEventListener('transitionend', onEnd);
        el.dataset.reveal = 'done';
        el.style.removeProperty('transition-delay');
        delete el.dataset.revealKind;
      };
      const onEnd = (event: TransitionEvent) => {
        if (event.target === el && event.propertyName === 'opacity') finish();
      };
      el.addEventListener('transitionend', onEnd);
      window.setTimeout(finish, SETTLE_FALLBACK_MS + delayMs);
    };

    const revealInOrder = (els: HTMLElement[]) => {
      els
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left)
        .forEach(({ el }, index) => reveal(el, Math.min(index, MAX_STAGGER_STEPS) * STAGGER_MS));
    };

    const observer = new IntersectionObserver(
      (entries) => revealInOrder(entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement)),
      { rootMargin: '0px 0px -8% 0px', threshold: 0 },
    );

    const shouldSplit = (el: HTMLElement, rect: DOMRect, style: CSSStyleDeclaration, depth: number) => {
      if (depth >= MAX_DEPTH || ATOMIC_TAGS.has(el.tagName) || el.childElementCount === 0) return false;
      if (style.position === 'sticky') return true; // never move a sticky column itself
      if (rect.height > window.innerHeight * SPLIT_HEIGHT_RATIO) return true;
      if (!style.display.includes('grid') && !style.display.includes('flex')) return false;
      let items = 0;
      for (const child of el.children) {
        if (child.getBoundingClientRect().height >= MIN_ITEM_HEIGHT && ++items >= 2) return true;
      }
      return false;
    };

    const collect = (parent: Element, depth: number, units: HTMLElement[]) => {
      for (const child of parent.children) {
        if (!(child instanceof HTMLElement) && !(child instanceof SVGElement)) continue;
        const el = child as HTMLElement;
        if (IGNORED_TAGS.has(el.tagName) || el.dataset.reveal || el.matches(EXCLUDED)) continue;
        if (!isHydrated(el)) continue; // retried on a later scan
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.position === 'fixed' || style.position === 'absolute') continue;
        const rect = el.getBoundingClientRect();
        if (!isVisibleBox(rect)) continue;
        if (shouldSplit(el, rect, style, depth)) collect(el, depth + 1, units);
        else units.push(el);
      }
    };

    const scan = () => {
      const units: HTMLElement[] = [];
      document.querySelectorAll('main').forEach((main) => {
        if (!main.closest(EXCLUDED)) collect(main, 0, units);
      });

      const enterNow: HTMLElement[] = [];
      for (const el of units) {
        const rect = el.getBoundingClientRect();
        const sideways = rect.left >= window.innerWidth || rect.right <= 0; // off-screen carousel slide
        const onScreen = rect.top < window.innerHeight && rect.bottom > 0 && !sideways;
        if (sideways) {
          el.dataset.reveal = 'done';
          continue;
        }
        if (isMediaUnit(el)) el.dataset.revealKind = 'media';
        if (onScreen) {
          if (initialScanDone && isFreshInsert(el)) {
            el.dataset.reveal = 'pending';
            enterNow.push(el);
          } else {
            el.dataset.reveal = 'done';
            delete el.dataset.revealKind;
          }
        } else {
          el.dataset.reveal = 'pending';
          observer.observe(el);
        }
      }
      initialScanDone = true;

      if (enterNow.length) {
        // Commit the hidden state for one frame so the transition runs.
        requestAnimationFrame(() => requestAnimationFrame(() => revealInOrder(enterNow)));
      }
    };

    // Re-scan after client navigation, streamed or re-rendered content and
    // route visibility changes, throttled so busy DOM updates stay cheap.
    let timer: number | undefined;
    const scheduleScan = () => {
      if (timer !== undefined) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        scan();
      }, 120);
    };
    const mutations = new MutationObserver((records) => {
      const now = performance.now();
      for (const record of records) record.addedNodes.forEach((node) => insertedAt.set(node, now));
      scheduleScan();
    });

    // Never leave keyboard focus inside an invisible block.
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      const pending = target?.closest<HTMLElement>('[data-reveal="pending"]');
      if (pending) reveal(pending);
    };

    scan();
    mutations.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden'],
    });
    document.addEventListener('focusin', onFocusIn);
    window.addEventListener('scroll', scheduleScan, { passive: true });
    window.addEventListener('resize', scheduleScan);
    window.addEventListener('load', scheduleScan);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', scheduleScan);
      window.removeEventListener('resize', scheduleScan);
      window.removeEventListener('load', scheduleScan);
      mutations.disconnect();
      observer.disconnect();
      document.removeEventListener('focusin', onFocusIn);
      document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
        el.removeAttribute('data-reveal');
        delete el.dataset.revealKind;
        el.style.removeProperty('transition-delay');
      });
    };
  }, []);

  return null;
}
