import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { getCatalog } from '@/server/catalog';
import { productForPage, resolveProductSlug } from './_lib/resolve';

// Resolve the slug on the server before the page streams: unknown products
// return a real 404, old slugs and gift cards redirect (see _lib/resolve),
// and each piece gets its own title.

// Cache Components: prerender every published product (database, cached
// with the 'products' tag); new products render on demand.
export async function generateStaticParams() {
  const { products } = await getCatalog();
  return products.length ? products.map((p) => ({ slug: p.slug })) : [{ slug: 'everyday-pullover-hoodie' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveProductSlug(slug);
  if (resolved?.kind !== 'product') return { title: 'Piece Not Found | The Unplugged Wear' };
  const { product } = resolved;
  const path = `/products/${product.slug}`;
  return {
    // APP_URL makes the canonical and share links absolute; without it Next
    // falls back to the request origin.
    ...(process.env.APP_URL ? { metadataBase: new URL(process.env.APP_URL) } : {}),
    title: `${product.title} | The Unplugged Wear`,
    description: product.description,
    alternates: { canonical: path },
    openGraph: {
      title: product.title,
      description: product.description,
      url: path,
      siteName: 'The Unplugged Wear',
      ...(product.images[0] ? { images: [{ url: product.images[0].url, alt: product.images[0].alt }] } : {}),
    },
  };
}

export default async function ProductLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await productForPage(slug);
  return children;
}
