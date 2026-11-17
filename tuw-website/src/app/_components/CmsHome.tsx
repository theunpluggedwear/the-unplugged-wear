'use client';

import Link from 'next/link';
import ProductCard from '@storefront/components/commerce/ProductCard';
import type { CmsSection } from '@/server/cms';
import type { Product } from '@storefront/lib/types';
import type { PostSummary } from '@tuw/heart/modules/marketing';

type Props = {
  sections: CmsSection[];
  products: Product[];
  posts: PostSummary[];
};

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export default function CmsHome({ sections, products, posts }: Props) {
  return (
    <div>
      {sections.map((section) => {
        const content = section.content ?? {};
        const settings = section.settings ?? {};
        if (section.type === 'hero') {
          const slides = Array.isArray(content.slides) ? content.slides as Record<string, unknown>[] : [];
          const slide = slides[0] ?? {};
          const title = text(slide.title) || section.title || 'The Unplugged Wear';
          return (
            <section key={section.id} aria-label="Hero" className="relative w-full bg-primary-dark text-white py-24 sm:py-32">
              <div className="max-w-4xl mx-auto px-4 text-center">
                <h1 className="font-heading text-4xl sm:text-5xl font-medium">{title}</h1>
                {text(slide.subtitle) && <p className="mt-4 text-white/70">{text(slide.subtitle)}</p>}
                <div className="mt-8 flex justify-center gap-6">
                  {Array.isArray(slide.ctas) && (slide.ctas as Record<string, unknown>[]).map((cta, i) => (
                    <Link key={i} href={text(cta.href) || '/shop'} className="text-xs uppercase tracking-widest underline underline-offset-4">
                      {text(cta.label) || 'Shop'}
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          );
        }
        if (section.type === 'banner') {
          return (
            <section key={section.id} aria-label={section.title || 'Banner'} className="bg-store-deep-teal text-white py-16">
              <div className="max-w-5xl mx-auto px-4">
                <h2 className="text-3xl font-semibold">{section.title || text(content.title)}</h2>
                {text(content.body) && <p className="mt-3 text-white/70">{text(content.body)}</p>}
                {text(content.ctaHref) && <Link href={text(content.ctaHref)} className="mt-6 inline-block text-sm underline">{text(content.ctaLabel) || 'Read more'}</Link>}
              </div>
            </section>
          );
        }
        if (section.type === 'featured_products') {
          const ids = Array.isArray(content.productIds) ? content.productIds.map(String) : [];
          const chosen = ids.length ? products.filter((p) => ids.includes(p.productId ?? p.id)) : products.slice(0, 8);
          return (
            <section key={section.id} className="py-20 max-w-7xl mx-auto px-4">
              <h2 className="text-3xl font-semibold text-store-charcoal">{section.title || 'Explore the Collection'}</h2>
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {chosen.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            </section>
          );
        }
        if (section.type === 'blog_teaser') {
          return (
            <section key={section.id} className="py-20 max-w-7xl mx-auto px-4">
              <h2 className="text-3xl font-semibold text-store-charcoal">{section.title || 'From the Journal'}</h2>
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <Link key={post.id} href={`/journal/${post.slug}`} className="rounded-2xl border border-store-card-border bg-store-card p-6 hover:border-store-charcoal">
                    <h3 className="text-lg font-medium">{post.title}</h3>
                    {post.excerpt && <p className="mt-2 text-sm text-store-text-secondary">{post.excerpt}</p>}
                  </Link>
                ))}
              </div>
            </section>
          );
        }
        if (section.type === 'brands') {
          const brands = Array.isArray(content.brands) ? content.brands.map(String) : [];
          return (
            <section key={section.id} className="py-12 border-y border-store-card-border">
              <div className="max-w-7xl mx-auto px-4 flex flex-wrap gap-6 text-sm text-store-text-secondary">
                {(brands.length ? brands : ['Cotton', 'Slow living', 'Printed to order']).map((b) => <span key={b}>{b}</span>)}
              </div>
            </section>
          );
        }
        if (section.type === 'testimonial') {
          return (
            <section key={section.id} className="py-16 bg-store-cream">
              <blockquote className="max-w-3xl mx-auto px-4 text-center text-lg italic text-store-charcoal">
                “{text(content.quote) || section.title || 'A quieter way to get dressed.'}”
              </blockquote>
              {text(content.author) && <p className="mt-3 text-center text-xs text-store-muted">{text(content.author)} — draft, unverified</p>}
            </section>
          );
        }
        return null;
      })}
    </div>
  );
}
