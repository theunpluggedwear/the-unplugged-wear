import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import Header from '@storefront/components/layout/Header';
import Footer from '@storefront/components/layout/Footer';
import Breadcrumb from '@storefront/components/ui/Breadcrumb';
import DynamicDataTable from '@storefront/components/commerce/DynamicDataTable';
import DynamicAccordionFaq from '@storefront/components/commerce/DynamicAccordionFaq';
import RelatedProductsSection from '@storefront/components/commerce/RelatedProductsSection';
import ProductReviews from '@storefront/components/commerce/ProductReviews';
import { EditorialFeatureSplit } from '@storefront/components/editorial';
import { cachedReviews, getCatalog } from '@/server/catalog';
import { cmsProductFaqs } from '@/server/cms';
import { getStorefrontSettings } from '@/server/settings';
import type { Product, ProductSpecTable, ProductType } from '@storefront/lib/types';
import {
  categoryLabel,
  isPlaceholderImage,
  isWearable,
  productTypeOf,
  relatedProductsFor,
  variantLabelOf,
} from '@storefront/lib/product';
import LiveStock from './_components/LiveStock';
import ProductShowcase from './_components/ProductShowcase';
import { productForPage } from './_lib/resolve';

const BRAND = 'The Unplugged Wear';

/**
 * Product + breadcrumb data for search engines (schema.org JSON-LD). Prices
 * and availability come from the cached catalogue; sample photos are left out
 * so a placeholder is never advertised as the product.
 */
function structuredData(product: Product, categoryName: string, rating: { average: number; count: number } | null) {
  const base = (process.env.APP_URL ?? '').replace(/\/$/, '');
  const absolute = (path: string) => (/^https?:\/\//.test(path) ? path : `${base}${path}`);
  const url = absolute(`/products/${product.slug}`);
  const prices = [product.priceINR, ...product.sizes.map((s) => s.priceINR ?? product.priceINR)];
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const availability =
    product.sizes.length === 0 || product.sizes.some((s) => s.inStock) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
  const images = product.images.filter((img) => !isPlaceholderImage(img.alt)).map((img) => absolute(img.url));

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.title,
      description: product.description,
      url,
      ...(images.length ? { image: images } : {}),
      brand: { '@type': 'Brand', name: BRAND },
      category: categoryName,
      offers:
        low === high
          ? { '@type': 'Offer', price: low.toFixed(2), priceCurrency: 'INR', availability, url, itemCondition: 'https://schema.org/NewCondition' }
          : { '@type': 'AggregateOffer', lowPrice: low.toFixed(2), highPrice: high.toFixed(2), offerCount: product.sizes.length, priceCurrency: 'INR', availability, url },
      ...(rating
        ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: rating.average.toFixed(1), reviewCount: rating.count, bestRating: 5, worstRating: 1 } }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { name: 'Home', path: '/' },
        { name: 'Shop', path: '/shop' },
        { name: categoryName, path: `/shop?category=${product.category}` },
        { name: product.title, path: `/products/${product.slug}` },
      ].map((crumb, i) => ({ '@type': 'ListItem', position: i + 1, name: crumb.name, item: absolute(crumb.path) })),
    },
  ];
}

// Server-rendered from the cached catalogue (see lib/live-stock for the one
// dynamic part). The only interactive island on the page is ProductShowcase.

// Spec table for products that don't carry a hand-written one.
function specTableFor(product: Product, type: ProductType): ProductSpecTable {
  const rows: Record<string, string>[] = [
    { spec: 'Product', value: categoryLabel(product.category) },
    {
      spec: `${variantLabelOf(product)}s`,
      value: product.sizes.map((s) => s.size).join(', ') || 'One size',
    },
    { spec: 'Colours', value: product.colors.map((c) => c.name).join(', ') || '—' },
  ];
  if (product.weightGrams) rows.push({ spec: 'Approximate weight', value: `${product.weightGrams} g` });
  if (product.printAreas?.length) rows.push({ spec: 'Print areas', value: product.printAreas.join(', ') });
  rows.push({ spec: 'Made', value: 'Printed after you order by our print partner in India' });
  // Same wording as the Fabric / Material section above, so the two never disagree.
  rows.push({ spec: isWearable(type) ? 'Fabric composition' : 'Material', value: product.composition?.trim() || 'To be confirmed (draft)' });
  if (product.taxRatePercent) rows.push({ spec: 'GST', value: `${product.taxRatePercent}% (included in price)` });
  if (product.hsnCode) rows.push({ spec: 'HSN code', value: product.hsnCode });
  return {
    title: 'Specifications',
    description: 'From our print partner’s base-product sheet.',
    columns: [
      { key: 'spec', label: 'Specification', align: 'left' },
      { key: 'value', label: 'Detail', align: 'left' },
    ],
    rows,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await productForPage(slug);
  const { products } = await getCatalog();
  const settings = await getStorefrontSettings();
  const scopedFaqs = product.productId ? await cmsProductFaqs(product.productId, product.categoryId) : [];
  // The CMS can return the product's own questions too: show each one once.
  const seen = new Set<string>();
  const faqs = [
    ...(product.faqs ?? []),
    ...scopedFaqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer })),
  ].filter((f) => {
    const keys = [`id:${f.id}`, `q:${f.question.trim().toLowerCase()}`];
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  });

  const type = productTypeOf(product);
  const categoryName = categoryLabel(product.category);
  const specTable = product.specTable ?? specTableFor(product, type);
  const related = relatedProductsFor(product, products);
  // Approved reviews (cached, tag 'reviews'): the rating under the title and in search data.
  const reviewSummary = product.productId ? await cachedReviews(product.productId).catch(() => null) : null;
  const rating = reviewSummary && reviewSummary.count > 0 ? { average: reviewSummary.average, count: reviewSummary.count } : null;
  const jsonLd = JSON.stringify(structuredData(product, categoryName, rating)).replace(/</g, '\\u003c');

  return (
    <div className="min-h-screen flex flex-col bg-store-canvas">
      <Header />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <main className="flex-1 w-full max-w-screen-2xl mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-10 pb-28 lg:pb-10">
        <div className="mb-6">
          <Breadcrumb
            items={[
              { label: 'Home', href: '/' },
              { label: 'Shop', href: '/shop' },
              { label: categoryName, href: `/shop?category=${product.category}` },
              { label: product.title },
            ]}
          />
        </div>

        <ProductShowcase product={product} rating={rating} personalizationEnabled={settings.personalizationEnabled} />

        {/* Stock, read fresh per request and handed to the buy box above. */}
        <Suspense fallback={null}>
          <LiveStock slug={product.slug} productId={product.productId} />
        </Suspense>

        <section className="my-16 pt-8 border-t border-store-card-border">
          <DynamicDataTable table={specTable} />
        </section>

        {/* Real reviews only: delivered orders, approved by staff. */}
        {product.productId && <ProductReviews productId={product.productId} productTitle={product.title} />}

        {related.length > 0 && (
          <RelatedProductsSection
            products={related}
            title="Pairs well with"
            catalogLink={`/shop?category=${product.category}`}
            catalogLabel={`More ${categoryName}`}
          />
        )}

        <EditorialFeatureSplit
          title="Printed when you order."
          eyebrow="How it’s made"
          description="Nothing is printed ahead of time. Your piece is made after you order by our print partner in India, so there’s no unsold stock waiting in a warehouse."
          imageSrc="/images/editorial/products-made-with-love.png"
        />

        {faqs.length > 0 && (
          <DynamicAccordionFaq
            faqs={faqs}
            eyebrow="Questions"
            title="Frequently asked questions"
            description="How this piece is printed, sized and delivered."
          />
        )}

        <section className="relative my-16 overflow-hidden bg-store-deep-teal text-white min-h-64 flex items-center justify-center text-center p-8 sm:p-14">
          <div className="relative z-10 max-w-2xl space-y-4">
            <h2 className="tuw-h2 text-white">Explore the collection</h2>
            <p className="text-sm text-white/80 leading-relaxed max-w-lg mx-auto">
              Hoodies, tees and everyday objects, each carrying the leaping deer.
            </p>
            <div className="pt-2">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white text-store-charcoal font-medium text-xs uppercase tracking-wider hover:bg-store-cream transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
              >
                Shop all
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
