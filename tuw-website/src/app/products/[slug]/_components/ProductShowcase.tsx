'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Heart, MapPin, RotateCcw, Truck } from 'lucide-react';
import Badge from '@storefront/components/ui/Badge';
import ProductGallery from '@storefront/components/commerce/ProductGallery';
import VariantSelector from '@storefront/components/commerce/VariantSelector';
import type { Product, ProductColor, ProductSize, ProductType } from '@storefront/lib/types';
import {
  categoryLabel,
  RETURN_WINDOW_DAYS,
  deliveryEstimate,
  isWearable,
  productTypeOf,
  priceLabel,
  sizePriceINR,
} from '@storefront/lib/product';
import { formatRupees, formatShortDate } from '@storefront/lib/format';
import { useLiveSizes } from '@storefront/lib/live-stock';
import { rupeesLabel, useSiteSettings } from '@storefront/lib/site-settings';
import { useStore } from '@storefront/mocks/store';

// The product page's one interactive island: gallery, summary, variant picker
// and buy buttons, delivery block and detail accordions. They share the
// selected colourway (the gallery follows the swatch) and the chosen size (the
// headline price follows it), so they belong together. It renders from the
// cached product; live stock arrives separately through lib/live-stock.
//
// Buy box order: what it is and what it costs → choose → buy → when it
// arrives → the details. "Printed after you order" is said once, in the
// delivery block, not repeated around the page.
const SECTION_TITLES: Record<'details' | 'material' | 'care', (type: ProductType) => string> = {
  details: () => 'Details',
  material: (type) => (isWearable(type) ? 'Fabric & weight' : 'Material'),
  care: () => 'Care',
};

const PIN_STORAGE_KEY = 'tuw_delivery_pin';

function AccordionItem({
  id,
  title,
  isOpen,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-store-card-border">
      <h3>
        <button
          type="button"
          id={`${id}-trigger`}
          aria-expanded={isOpen}
          aria-controls={`${id}-panel`}
          onClick={onToggle}
          className="w-full py-4 text-left flex items-center justify-between text-sm font-medium text-store-charcoal cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
        >
          {title}
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : 'text-store-text-secondary'}`}
          />
        </button>
      </h3>
      {isOpen && (
        <div
          id={`${id}-panel`}
          role="region"
          aria-labelledby={`${id}-trigger`}
          className="pb-4 text-sm text-store-text-secondary leading-relaxed"
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** Delivery date check. Remembers the last PIN on this device. */
function DeliveryCheck() {
  const [pin, setPin] = useState('');
  const [checkedPin, setCheckedPin] = useState<string | null>(null);
  const estimate = checkedPin ? deliveryEstimate(checkedPin) : null;

  // Read after hydration so server and client render the same first frame.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PIN_STORAGE_KEY);
      if (saved && /^\d{6}$/.test(saved)) {
        setPin(saved);
        setCheckedPin(saved);
      }
    } catch {
      /* storage blocked: the field just starts empty */
    }
  }, []);

  const check = (event: React.FormEvent) => {
    event.preventDefault();
    const value = pin.trim();
    setCheckedPin(value);
    if (deliveryEstimate(value)) {
      try {
        window.localStorage.setItem(PIN_STORAGE_KEY, value);
      } catch {
        /* not remembered, still checked */
      }
    }
  };

  return (
    <div className="space-y-2">
      <form className="space-y-1.5" onSubmit={check}>
        <label htmlFor="pdp-pin" className="block text-xs font-medium text-store-charcoal">
          Check delivery date
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPin size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-store-text-secondary" />
            <input
              id="pdp-pin"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              placeholder="6-digit PIN code"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              aria-describedby="pdp-pin-result"
              className="w-full h-11 pl-9 pr-3 border border-store-input-border bg-store-surface text-sm text-store-charcoal placeholder:text-store-text-secondary focus:outline-none focus:border-store-charcoal"
            />
          </div>
          <button
            type="submit"
            className="h-11 px-5 border border-store-charcoal text-store-charcoal text-xs font-medium uppercase tracking-wider hover:bg-store-charcoal hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
          >
            Check
          </button>
        </div>
      </form>
      <p id="pdp-pin-result" className="text-sm" aria-live="polite">
        {checkedPin === null ? null : estimate ? (
          <span className="text-store-charcoal">
            Arrives in {checkedPin} by{' '}
            <strong className="font-medium">
              {formatShortDate(estimate.earliest)} – {formatShortDate(estimate.latest)}
            </strong>{' '}
            <span className="text-store-text-secondary">(demo estimate)</span>
          </span>
        ) : (
          <span className="text-store-terracotta">Enter a valid 6-digit PIN code.</span>
        )}
      </p>
    </div>
  );
}

/** The single place the page explains printing, delivery and returns. */
function DeliveryAndReturns({ wearable }: { wearable: boolean }) {
  const { freeThresholdPaise } = useSiteSettings().shipping;
  return (
    <section aria-labelledby="pdp-delivery-heading" className="p-4 sm:p-5 bg-store-cream border border-store-card-border space-y-4">
      <h2 id="pdp-delivery-heading" className="text-sm font-medium text-store-charcoal">
        Delivery &amp; returns
      </h2>
      <ul className="space-y-2.5 text-sm text-store-text-secondary">
        <li className="flex gap-2.5">
          <Truck size={16} aria-hidden="true" className="shrink-0 mt-0.5 text-store-charcoal" />
          <span>
            Printed for you in 2–3 business days, then shipped with tracking across India. Free delivery on orders over{' '}
            {rupeesLabel(freeThresholdPaise)}.
          </span>
        </li>
        <li className="flex gap-2.5">
          <RotateCcw size={16} aria-hidden="true" className="shrink-0 mt-0.5 text-store-charcoal" />
          <span>
            {wearable
              ? `Exchange unworn pieces with tags within ${RETURN_WINDOW_DAYS} days of delivery. `
              : 'Replaced if it arrives damaged or misprinted (draft policy). '}
            <Link
              href="/policies/returns"
              className="text-store-charcoal underline underline-offset-4 decoration-store-gold hover:decoration-store-charcoal"
            >
              Returns policy
            </Link>
          </span>
        </li>
      </ul>
      <div className="pt-4 border-t border-store-card-border">
        <DeliveryCheck />
      </div>
    </section>
  );
}

/** "★★★★☆ 4.6 · 12 reviews" under the title; jumps to the reviews. Only when real reviews exist. */
function RatingSummary({ average, count }: { average: number; count: number }) {
  const rounded = Math.round(average);
  const label = `Rated ${average.toFixed(1)} out of 5 from ${count} review${count === 1 ? '' : 's'}. Read the reviews`;
  return (
    <a
      href="#reviews"
      aria-label={label}
      className="group mt-2 inline-flex items-center gap-2 text-sm text-store-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
    >
      <span aria-hidden="true" className="tracking-tight">
        <span className="text-store-gold">{'★'.repeat(rounded)}</span>
        <span className="text-store-card-border">{'★'.repeat(5 - rounded)}</span>
      </span>
      <span aria-hidden="true" className="tuw-tabular-nums">{average.toFixed(1)}</span>
      <span aria-hidden="true" className="text-store-text-secondary underline underline-offset-4 decoration-store-card-border group-hover:decoration-store-charcoal">
        {count} review{count === 1 ? '' : 's'}
      </span>
    </a>
  );
}

/**
 * Sticky offset for the details panel. A panel shorter than the screen sticks
 * just under the header; a taller one scrolls with the page until its bottom
 * is in view and sticks there, so nothing in it is ever out of reach.
 */
function useStickyTop(ref: React.RefObject<HTMLElement | null>, headerOffset = 96, bottomGap = 24) {
  const [top, setTop] = useState(headerOffset);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setTop(Math.min(headerOffset, window.innerHeight - el.offsetHeight - bottomGap));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [ref, headerOffset, bottomGap]);
  return top;
}

/** Heart beside the title: saves the piece to the wishlist (toast confirms, with a link). */
function WishlistButton({ productId, title }: { productId: string; title: string }) {
  const { isInWishlist, toggleWishlist } = useStore();
  const saved = isInWishlist(productId);
  return (
    <button
      type="button"
      onClick={() => toggleWishlist(productId)}
      aria-label={saved ? `Remove ${title} from wishlist` : `Save ${title} to wishlist`}
      aria-pressed={saved}
      title={saved ? 'Saved to your wishlist' : 'Save to wishlist'}
      className="shrink-0 w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-store-charcoal hover:bg-store-cream transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
    >
      <Heart size={20} aria-hidden="true" className={saved ? 'fill-store-gold text-store-gold' : ''} />
    </button>
  );
}

export default function ProductShowcase({
  product,
  rating = null,
  personalizationEnabled = false,
}: {
  product: Product;
  /** Approved reviews only; null hides the summary. */
  rating?: { average: number; count: number } | null;
  personalizationEnabled?: boolean;
}) {
  const [selectedColor, setSelectedColor] = useState<ProductColor | undefined>(
    product.colors && product.colors.length > 0 ? product.colors[0] : undefined
  );
  // No size is picked for the shopper (a guessed size becomes a wrong order),
  // unless there is only one to choose from.
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(
    product.sizes.length === 1 ? product.sizes[0]! : null
  );
  const [openSection, setOpenSection] = useState<string | null>('details');
  const liveSizes = useLiveSizes(product.slug, product.sizes);
  // Headline price follows the chosen size; "From ₹…" until one is chosen.
  const headlinePrice =
    selectedSize && liveSizes.some((s) => s.size === selectedSize.size)
      ? formatRupees(sizePriceINR({ ...product, sizes: liveSizes }, selectedSize.size))
      : priceLabel({ ...product, sizes: liveSizes });

  const type = productTypeOf(product);
  const wearable = isWearable(type);
  const categoryName = categoryLabel(product.category);
  const activeColor = selectedColor || product.colors[0];
  const toggle = (name: string) => setOpenSection(openSection === name ? null : name);
  const panelRef = useRef<HTMLDivElement>(null);
  const stickyTop = useStickyTop(panelRef);

  return (
    // Desktop: photos fill the left half out to the page edge; the details sit
    // in a narrow column centred in the right half and stay in view.
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-0 items-start">
      <div className="lg:-ml-12">
        <ProductGallery
          images={product.images}
          title={product.title}
          videoUrl={product.videoUrl}
          selectedColorValue={activeColor?.value}
          colors={product.colors}
        />
      </div>

      <div
        ref={panelRef}
        style={{ '--panel-top': `${stickyTop}px` } as React.CSSProperties}
        className="w-full lg:max-w-[30rem] lg:mx-auto lg:px-8 xl:px-0 flex flex-col gap-6 lg:sticky lg:top-(--panel-top) lg:pt-10"
      >
        {/* 1. What it is and what it costs */}
        <div>
          <div className="flex items-center justify-between gap-4 mb-2">
            <p className="text-xs uppercase tracking-wider text-store-text-secondary">
              <Link href={`/shop?category=${product.category}`} className="hover:text-store-charcoal">
                {categoryName}
              </Link>
            </p>
            <WishlistButton productId={product.id} title={product.title} />
          </div>
          <h1 className="tuw-h1 text-store-charcoal">
            {product.title}
          </h1>
          <p className="text-sm text-store-text-secondary mt-1.5">{product.subtitle}</p>
          {rating && <RatingSummary average={rating.average} count={rating.count} />}

          <div className="flex flex-wrap items-baseline gap-3 mt-4">
            <span className="text-2xl font-medium text-store-charcoal tuw-tabular-nums" aria-live="polite">
              {headlinePrice}
            </span>
            {product.compareAtPriceINR && product.compareAtPriceINR > product.priceINR && (
              <span className="text-base text-store-text-secondary line-through tuw-tabular-nums">
                ₹{product.compareAtPriceINR.toLocaleString('en-IN')}
              </span>
            )}
            {product.sustainabilityBadge && <Badge variant="outline">{product.sustainabilityBadge}</Badge>}
          </div>
          <p className="text-xs text-store-text-secondary mt-1.5">
            Inclusive of all taxes{product.taxRatePercent ? ` (GST ${product.taxRatePercent}%)` : ''}
            {product.priceIsDraft ? ' · Draft price, to be confirmed' : ''}
          </p>
        </div>

        {/* 2. Choose and buy */}
        <div className="pt-5 border-t border-store-card-border">
          <VariantSelector
            product={product}
            selectedColor={activeColor}
            onColorChange={setSelectedColor}
            selectedSize={selectedSize}
            onSizeChange={setSelectedSize}
            personalizationEnabled={personalizationEnabled}
          />
        </div>

        {/* 3. When it arrives, and what if it doesn't fit */}
        <DeliveryAndReturns wearable={wearable} />

        {/* 4. The details */}
        <div className="border-t border-store-card-border">
          <AccordionItem id="pdp-details" title={SECTION_TITLES.details(type)} isOpen={openSection === 'details'} onToggle={() => toggle('details')}>
            <p className="text-store-charcoal">{product.description}</p>
            {product.details.length > 0 && (
              <ul className="mt-3 space-y-1.5 list-disc list-inside">
                {product.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
          </AccordionItem>
          <AccordionItem id="pdp-material" title={SECTION_TITLES.material(type)} isOpen={openSection === 'material'} onToggle={() => toggle('material')}>
            <p className="text-store-charcoal">{product.composition}</p>
            {product.weightGrams && <p className="mt-1">Approximate weight: {product.weightGrams} g.</p>}
          </AccordionItem>
          <AccordionItem id="pdp-care" title={SECTION_TITLES.care(type)} isOpen={openSection === 'care'} onToggle={() => toggle('care')}>
            <ul className="space-y-1.5 list-disc list-inside">
              {product.careInstructions.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </AccordionItem>
        </div>
      </div>
    </div>
  );
}
