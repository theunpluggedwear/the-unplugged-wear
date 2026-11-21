'use client';

import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { ProductSize } from './types';

// A tiny client-side channel for the product page's live stock read.
//
// The page body is cached, so it renders from the cached catalogue and its
// sizes can be up to an hour old. A small Suspense hole on the page streams
// the fresh sizes in and publishes them here; the already-hydrated buy box
// subscribes and re-renders. That keeps the static shell static while the
// add-to-bag button still tells the truth about stock.
//
// Both the published values and their listeners are keyed by slug: publishing
// stock for one product must not re-render the buy box of another, and a
// getSnapshot that closes over a fresh `fallback` array would change identity
// on every render (React warns "The result of getSnapshot should be cached"
// and can loop). The fallback is pinned for the lifetime of this subscriber.
const published = new Map<string, ProductSize[]>();
const listeners = new Map<string, Set<() => void>>();

export function publishStock(slug: string, sizes: ProductSize[]): void {
  published.set(slug, sizes);
  listeners.get(slug)?.forEach((listener) => listener());
}

function subscribe(slug: string, listener: () => void): () => void {
  let set = listeners.get(slug);
  if (!set) {
    set = new Set();
    listeners.set(slug, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(slug);
  };
}

/** Live sizes for `slug` once published; the cached ones before that. */
export function useLiveSizes(slug: string, fallback: ProductSize[]): ProductSize[] {
  // Pin one fallback reference per slug. `fallback` is usually the cached
  // catalogue array, but a caller may pass derived data (a fresh array on each
  // render); returning that directly from getSnapshot would make every render
  // see a new snapshot and trigger an endless re-render / React warning.
  const pinned = useRef<{ slug: string; sizes: ProductSize[] }>({ slug, sizes: fallback });
  if (pinned.current.slug !== slug) {
    pinned.current = { slug, sizes: fallback };
  }
  const stableFallback = pinned.current.sizes;

  const subscribeToSlug = useCallback((listener: () => void) => subscribe(slug, listener), [slug]);
  const getSnapshot = useCallback(() => published.get(slug) ?? stableFallback, [slug, stableFallback]);
  const getServerSnapshot = useCallback(() => stableFallback, [stableFallback]);

  return useSyncExternalStore(subscribeToSlug, getSnapshot, getServerSnapshot);
}
