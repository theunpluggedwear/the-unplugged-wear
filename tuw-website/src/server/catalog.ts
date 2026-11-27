import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { approvedReviews, getStorefrontCatalog, getStorefrontProductStock, searchProducts, PRODUCTS_TAG, REVIEWS_TAG, type ReviewSummary, type SearchResult } from '@tuw/heart/modules/catalog';
import type { Collection, Product, ProductSize, SizeChartData } from '@storefront/lib/types';
import '@tuw/heart/modules/personalization';

export interface Catalog {
  products: Product[];
  /** Digital gift cards: purchasable on their own PDP, never in the shop grid. */
  giftCards: Product[];
  collections: Collection[];
  sizeCharts: SizeChartData[];
}

// The published catalog (cache-components skill): same for everyone, part
// of the static shell, expired by the admin through POST /api/revalidate
// ('products') or hourly. Unlike settings there is no silent fallback — an
// empty shop would be a lie; the error page tells the truth instead.
export async function getCatalog(): Promise<Catalog> {
  'use cache';
  cacheTag(PRODUCTS_TAG);
  cacheLife('hours');
  const catalog = await getStorefrontCatalog();
  const products = catalog.products as unknown as Product[];
  return {
    // Gift cards are resolvable on their own PDP but never listed as physical products.
    products: products.filter((p) => p.productKind !== 'gift_card'),
    giftCards: products.filter((p) => p.productKind === 'gift_card'),
    collections: catalog.collections,
    sizeCharts: catalog.sizeCharts,
  };
}

/** Product by slug or old slug (renamed products keep resolving). */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { products, giftCards } = await getCatalog();
  const all = [...products, ...giftCards];
  return all.find((p) => p.slug === slug) ?? all.find((p) => p.aliases?.includes(slug)) ?? null;
}

/**
 * Live sizes for one product, read on every request. Intentionally not
 * cached: the catalogue behind it is tagged and can be hours old, and the
 * buy box is the one thing on the page that must not be. `null` when the
 * piece is no longer published or has nothing purchasable.
 */
export async function getProductStock(productId: string | undefined): Promise<ProductSize[] | null> {
  if (!productId) return null;
  return (await getStorefrontProductStock(productId)) as ProductSize[] | null;
}

/** Ranked search, cached per term for a few minutes and expired with the catalog. */
export async function cachedSearch(term: string): Promise<SearchResult> {
  'use cache';
  cacheTag(PRODUCTS_TAG);
  cacheLife('minutes');
  return searchProducts(term);
}

/** Approved reviews for one product (same for everyone). */
export async function cachedReviews(productId: string): Promise<ReviewSummary> {
  'use cache';
  cacheTag(REVIEWS_TAG);
  cacheLife('hours');
  return approvedReviews(productId);
}
