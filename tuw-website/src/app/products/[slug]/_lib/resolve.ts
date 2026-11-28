import { notFound, permanentRedirect } from 'next/navigation';
import { getCatalog } from '@/server/catalog';
import type { Product } from '@storefront/lib/types';

type Resolved =
  | { kind: 'product'; product: Product; canonicalPath: string | null }
  | { kind: 'gift_card' }
  | null;

/**
 * Find what a /products/[slug] address points at. A product's own slug wins
 * over another product's old alias. `canonicalPath` is set when the address
 * isn't the product's current one (an old alias, or different letter case).
 */
export async function resolveProductSlug(slug: string): Promise<Resolved> {
  const key = slug.toLowerCase();
  const { products, giftCards } = await getCatalog();
  const bySlug = (p: Product) => p.slug.toLowerCase() === key;
  const byAlias = (p: Product) => p.aliases?.some((alias) => alias.toLowerCase() === key) ?? false;

  const product = products.find(bySlug) ?? products.find(byAlias);
  if (product) {
    return { kind: 'product', product, canonicalPath: product.slug === slug ? null : `/products/${product.slug}` };
  }
  // Gift cards are bought on /gift-cards; they have no product page of their own.
  if (giftCards.some((g) => bySlug(g) || byAlias(g))) return { kind: 'gift_card' };
  return null;
}

/** The product for this address, or the right response: 404, or a permanent redirect. */
export async function productForPage(slug: string): Promise<Product> {
  const resolved = await resolveProductSlug(slug);
  if (!resolved) notFound();
  if (resolved.kind === 'gift_card') permanentRedirect('/gift-cards');
  if (resolved.canonicalPath) permanentRedirect(resolved.canonicalPath);
  return resolved.product;
}
