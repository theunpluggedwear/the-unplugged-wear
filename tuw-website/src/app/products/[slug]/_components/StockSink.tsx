'use client';

import { useEffect, useRef } from 'react';
import { publishStock } from '@storefront/lib/live-stock';
import type { ProductSize } from '@storefront/lib/types';

// Invisible: hands the streamed live sizes to the buy box that is already on
// screen. No markup, so it cannot shift the layout.
export default function StockSink({ slug, sizes }: { slug: string; sizes: ProductSize[] }) {
  // The streamed prop is normally stable, but a re-render with an equivalent
  // fresh array must not re-publish (that would notify every subscriber and
  // churn the buy box for no reason). Compare by value, keyed by slug.
  const lastPublished = useRef<string | null>(null);
  useEffect(() => {
    const signature = `${slug}::${JSON.stringify(sizes)}`;
    if (lastPublished.current === signature) return;
    lastPublished.current = signature;
    publishStock(slug, sizes);
  }, [slug, sizes]);
  return null;
}
