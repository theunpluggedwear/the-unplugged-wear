import { Suspense } from 'react';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { cookies } from 'next/headers';
import './globals.css';
import { Providers } from './providers';
import { getSessionSummary } from '@/server/session';
import { getStorefrontSettings } from '@/server/settings';
import { getCatalog } from '@/server/catalog';
import { getNavigation } from '@/server/nav';
import BrandIntro from '@storefront/components/layout/BrandIntro';
import ScrollReveal from '@storefront/components/layout/ScrollReveal';
import { INTRO_SEEN_KEY } from '@storefront/lib/intro';
import type { Product } from '@storefront/lib/types';

/**
 * Only the fields the client actually reads (mega-menu counts and tiles,
 * search suggestions, wishlist/bag summaries) cross into the browser. Long
 * copy, spec tables, FAQs, radio groups and partner metadata stay on the
 * server, where the shop and PDP read the full catalog themselves.
 */
function toNavProduct(product: Product): Product {
  return {
    id: product.id,
    productId: product.productId,
    slug: product.slug,
    aliases: product.aliases,
    title: product.title,
    subtitle: product.subtitle,
    category: product.category,
    audience: product.audience,
    priceINR: product.priceINR,
    compareAtPriceINR: product.compareAtPriceINR,
    images: product.images,
    colors: product.colors,
    sizes: product.sizes,
    sizeChartId: product.sizeChartId,
    productType: product.productType,
    variantLabel: product.variantLabel,
    isNew: product.isNew,
    isBestseller: product.isBestseller,
    publicationStatus: product.publicationStatus,
    priceIsDraft: product.priceIsDraft,
  } as Product;
}

// Self-hosted Outfit for headings and body (vendored from @fontsource, OFL licensed).
// next/font/local keeps Turbopack production builds deterministic with zero
// fonts.googleapis.com fetch at build/runtime (Vercel-safe).
const outfit = localFont({
  variable: '--font-outfit',
  display: 'swap',
  preload: true,
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
  src: [
    { path: './fonts/outfit-latin-300-normal.woff2', weight: '300', style: 'normal' },
    { path: './fonts/outfit-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/outfit-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/outfit-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/outfit-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: './fonts/outfit-latin-800-normal.woff2', weight: '800', style: 'normal' },
    { path: './fonts/outfit-latin-900-normal.woff2', weight: '900', style: 'normal' },
  ],
});

/**
 * Server gate for the one-time brand intro. Reading the cookie here (instead
 * of a pre-paint script mutating <html>) means a repeat visitor never receives
 * the overlay in the initial HTML — no flash, and no hydration mismatch. Kept
 * inside <Suspense> so PPR still prerenders the rest of the shell statically.
 */
async function IntroGate() {
  const store = await cookies();
  if (store.get(INTRO_SEEN_KEY)?.value === '1') return null;
  return <BrandIntro />;
}

export const metadata: Metadata = {
  title: 'The Unplugged Wear | Everyday Wear, Printed to Order',
  description:
    'Everyday hoodies, tees and objects printed with the leaping deer, made to order in Tiruppur. Nothing is printed until you order it.',
  keywords: [
    'The Unplugged Wear',
    'minimalist streetwear',
    'pullover hoodie',
    'oversized tee',
    'slow fashion India',
    'print-on-demand',
  ],
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // All cached ('settings' / 'products' / 'nav' tags) — part of the static
  // shell, not dynamic holes. The full catalog stays here on the server (the
  // shop and PDP read it directly); only the nav-sized projection below is
  // serialized for the client Header and bag/wishlist summaries.
  const settings = await getStorefrontSettings();
  const catalog = await getCatalog();
  const nav = await getNavigation();
  const navCatalog = {
    products: catalog.products.map(toNavProduct),
    sizeCharts: catalog.sizeCharts,
  };
  return (
    <html lang="en" className={outfit.variable}>
      <body className="font-sans antialiased bg-store-canvas text-store-text-primary min-h-screen">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-dark focus:text-white focus:font-semibold focus:text-xs focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-secondary-mint"
        >
          Skip to main content
        </a>
        {/* Un-awaited: read with use() inside Suspense boundaries. */}
        <Providers session={getSessionSummary()} settings={settings} catalog={navCatalog} nav={nav}>
          {/* Reads the cookie + URL; streamed so dynamic routes keep a static shell. */}
          <Suspense fallback={null}>
            <IntroGate />
          </Suspense>
          {children}
        </Providers>
        <ScrollReveal />
      </body>
    </html>
  );
}
