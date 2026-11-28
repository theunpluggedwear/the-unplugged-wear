'use client';

import React, { useEffect, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Check, Minus, Plus, ShoppingBag } from 'lucide-react';
import { CartItem, Product, ProductColor, ProductSize } from '@storefront/lib/types';
import { useStore } from '@storefront/mocks/store';
import Button from '@storefront/components/ui/Button';
import { formatRupees } from '@storefront/lib/format';
import SizeGuideModal from './SizeGuideModal';
import ColorSwatchSelector from './ColorSwatchSelector';
import VariantPillSelector from './VariantPillSelector';
import RadioOptionSelector from './RadioOptionSelector';
import NotifyMe from './NotifyMe';
import { useLiveSizes } from '@storefront/lib/live-stock';
import { purchaseReducer } from '@storefront/lib/purchase-machine';
import { PersonalizationPanel } from '@storefront/plugins/personalization';
import {
  sizePriceINR,
  priceLabel,
  productTypeOf,
  variantLabelOf,
} from '@storefront/lib/product';

/** The server's per-line ceiling (cart schema: qty max 100). */
const MAX_LINE_QTY = 100;

export interface VariantSelectorProps {
  product: Product;
  selectedColor?: ProductColor;
  onColorChange?: (color: ProductColor) => void;
  selectedSize?: ProductSize | null;
  onSizeChange?: (size: ProductSize | null) => void;
  personalizationEnabled?: boolean;
}

export default function VariantSelector({
  product,
  selectedColor: controlledColor,
  onColorChange,
  selectedSize: controlledSize,
  onSizeChange,
  personalizationEnabled = false,
}: VariantSelectorProps) {
  const router = useRouter();
  const { addToCart, buyNow, sizeCharts } = useStore();

  const productType = productTypeOf(product);
  const variantLabel = variantLabelOf(product);
  // The chart staff linked to this product, if any.
  const sizeChart = sizeCharts.find((c) => c.id === product.sizeChartId) ?? null;

  // Stock arrives from the page's live read (see LiveStock) and replaces the
  // cached catalogue's sizes once it lands; until then the cached values show.
  const sizes = useLiveSizes(product.slug, product.sizes);

  const hasColors = Boolean(product.colors && product.colors.length > 0);
  const hasSizes = sizes.length > 0;
  const hasRadioGroups = Boolean(product.radioGroups && product.radioGroups.length > 0);

  const [internalColor, setInternalColor] = useState<ProductColor | undefined>(
    hasColors ? product.colors![0] : undefined
  );
  const [internalSize, setInternalSize] = useState<ProductSize | null>(
    // Never guess a size for the shopper; a lone option starts selected
    // (so a sold-out one shows "notify me" straight away).
    sizes.length === 1 ? sizes[0]! : null
  );

  const selectedColor = controlledColor !== undefined ? controlledColor : internalColor;
  // Re-read the chosen size from the live list so its stock and tier price
  // refresh with the stream, while the selection itself is preserved.
  const chosenSize = controlledSize !== undefined ? controlledSize : internalSize;
  const selectedSize = chosenSize ? sizes.find((s) => s.size === chosenSize.size) ?? chosenSize : null;

  // Track active radio option selections per group
  const [selectedRadioValues, setSelectedRadioValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (product.radioGroups) {
      product.radioGroups.forEach((g) => {
        initial[g.groupKey] = g.defaultValue || g.options[0]?.id || '';
      });
    }
    return initial;
  });

  const [requestedQty, setRequestedQty] = useState(1);
  const [personalizationActive, setPersonalizationActive] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [purchase, dispatchPurchase] = useReducer(purchaseReducer, { kind: 'idle' });
  const buying = purchase.kind === 'buying';
  const added = purchase.kind === 'added';
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (addedTimer.current) clearTimeout(addedTimer.current); }, []);
  const sizeGroupRef = useRef<HTMLDivElement>(null);

  // Quantity can never pass what the chosen size has in stock (or the bag's
  // per-line limit). Derived, so a size change or a fresh stock read that
  // lowers the ceiling corrects it without an effect.
  const maxQty = Math.max(1, Math.min(selectedSize ? selectedSize.stockCount : MAX_LINE_QTY, MAX_LINE_QTY));
  const quantity = Math.min(requestedQty, maxQty);
  const atMax = quantity >= maxQty && selectedSize !== null;

  const soldOut = hasSizes && (selectedSize ? !selectedSize.inStock : sizes.every((s) => !s.inStock));


  // Calculate cumulative price delta from selected radio options
  const radioDeltaINR = (product.radioGroups || []).reduce((acc, group) => {
    const selectedOptionId =
      selectedRadioValues[group.groupKey] || group.defaultValue || group.options[0]?.id;
    const option = group.options.find((o) => o.id === selectedOptionId);
    return acc + (option?.priceDeltaINR || 0);
  }, 0);

  // Price tiers: the chosen size's own price (see lib/product sizePriceINR).
  const effectiveUnitPriceINR = sizePriceINR({ ...product, sizes }, selectedSize?.size) + radioDeltaINR;

  const handleColorSelect = (color: ProductColor) => {
    if (onColorChange) {
      onColorChange(color);
    } else {
      setInternalColor(color);
    }
  };

  const handleSizeSelect = (size: ProductSize) => {
    setValidationError(null);
    if (onSizeChange) {
      onSizeChange(size);
    } else {
      setInternalSize(size);
    }
  };

  const handleRadioSelect = (groupKey: string, optionId: string) => {
    setSelectedRadioValues((prev) => ({
      ...prev,
      [groupKey]: optionId,
    }));
  };

  /** Validate the choice; on failure say why and take the shopper to the size picker. */
  const ready = (): boolean => {
    if (!hasSizes) return true;
    const problem = !selectedSize
      ? `Please choose a ${variantLabel.toLowerCase()} to continue.`
      : !selectedSize.inStock
      ? `This ${variantLabel.toLowerCase()} is currently sold out.`
      : null;
    setValidationError(problem);
    if (problem) {
      const group = sizeGroupRef.current;
      const box = group?.getBoundingClientRect();
      if (group && box && (box.top < 80 || box.bottom > window.innerHeight)) {
        group.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'center',
        });
      }
      group?.querySelector<HTMLButtonElement>('[role="radio"]')?.focus({ preventScroll: true });
    }
    return !problem;
  };

  const lineItem = (): Omit<CartItem, 'id'> => {
    const activeImage =
      (selectedColor && product.images.find((img) => img.color === selectedColor.value)?.url) ||
      product.images[0]?.url ||
      '';

    const chosenRadioOptions = (product.radioGroups || []).map((group) => {
      const optionId =
        selectedRadioValues[group.groupKey] || group.defaultValue || group.options[0]?.id;
      const option = group.options.find((o) => o.id === optionId);
      return {
        groupKey: group.groupKey,
        groupLabel: group.label,
        optionId: option?.id || '',
        optionLabel: option?.label || '',
        priceDeltaINR: option?.priceDeltaINR,
      };
    });

    return {
      productId: product.id,
      title: product.title,
      color: selectedColor ? selectedColor.name : 'Standard',
      size: selectedSize ? selectedSize.size : 'One Size',
      priceINR: effectiveUnitPriceINR,
      priceMinorINR: Math.round(effectiveUnitPriceINR * 100),
      quantity,
      image: activeImage,
      selectedRadioOptions: chosenRadioOptions.length > 0 ? chosenRadioOptions : undefined,
    };
  };

  const handleAddToCart = () => {
    if (!ready()) return;
    addToCart(lineItem());
    dispatchPurchase({ type: 'ADD' });
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => dispatchPurchase({ type: 'RESET' }), 1800);
  };

  /** Take the shopper to the size buttons without an error (phone bar). */
  const goToSizes = () => {
    const group = sizeGroupRef.current ?? document.getElementById('purchase-actions');
    group?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    });
    group?.querySelector<HTMLButtonElement>('[role="radio"]')?.focus({ preventScroll: true });
  };

  // Phone buy bar: appears once the main buttons scroll out of view.
  const purchaseRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [showBar, setShowBar] = useState(false);
  useEffect(() => {
    setMounted(true);
    const target = purchaseRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      setShowBar(!entry!.isIntersecting && entry!.boundingClientRect.bottom < 0);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  const needsSize = hasSizes && !selectedSize;
  const barPrice = selectedSize || !hasSizes ? formatRupees(effectiveUnitPriceINR) : priceLabel({ ...product, sizes });

  // Buy now goes straight to checkout with exactly this item: no drawer, and
  // an identical bag line is set to this quantity rather than added to again.
  const handleBuyNow = async () => {
    if (buying || !ready()) return;
    dispatchPurchase({ type: 'BUY' });
    const ok = await buyNow(lineItem()).catch(() => false);
    if (ok) router.push('/checkout');
    else dispatchPurchase({ type: 'RESET' }); // the bag already showed why
  };


  return (
    <div className="flex flex-col gap-6">
      {/* 1. Dynamic Color Swatch Selector (Omitted if no colors defined) */}
      {hasColors && (
        <ColorSwatchSelector
          colors={product.colors}
          selectedColor={selectedColor}
          onSelect={handleColorSelect}
          label="Colour:"
        />
      )}

      {/* 2. Dynamic Variant Pill Selector (Omitted if no sizes defined) */}
      {hasSizes && (
        <div ref={sizeGroupRef} className="scroll-mt-28">
        <VariantPillSelector
          sizes={sizes}
          selectedSize={selectedSize}
          onSelect={handleSizeSelect}
          label={`${variantLabel}:`}
          onSizeGuideClick={sizeChart ? () => setIsSizeGuideOpen(true) : undefined}
          sizeGuideLabel="Size guide"
          validationError={validationError}
        />
        </div>
      )}

      {hasSizes && selectedSize && !selectedSize.inStock && product.productId && (
        <NotifyMe
          key={`${selectedColor?.name ?? ''}|${selectedSize.size}`}
          productId={product.productId}
          color={selectedColor?.name}
          size={selectedSize.size}
        />
      )}

      {/* 3. Dynamic Radio Option Selectors (Omitted if no radioGroups defined) */}
      {hasRadioGroups && (
        <div className="space-y-4 pt-1">
          {product.radioGroups!.map((group) => (
            <RadioOptionSelector
              key={group.groupKey}
              group={group}
              selectedValue={selectedRadioValues[group.groupKey]}
              onSelect={(optId) => handleRadioSelect(group.groupKey, optId)}
            />
          ))}
        </div>
      )}

      {personalizationEnabled && product.monogram && product.productKind !== 'gift_card' ? (
        <PersonalizationPanel
          productId={product.productId ?? product.id}
          productName={product.title}
          maxChars={product.monogram.maxChars}
          printAreas={product.printAreas}
          color={selectedColor?.name}
          size={selectedSize?.size}
          priceINR={effectiveUnitPriceINR}
          image={product.images[0]?.url ?? ''}
          disabled={soldOut}
          onActiveChange={setPersonalizationActive}
          onAdded={() => dispatchPurchase({ type: 'ADD' })}
        />
      ) : null}

      {/* 4. Quantity, then the two buy buttons stacked full width */}
      {!soldOut && (
        <div className="flex items-center justify-between gap-4">
          <span id="pdp-qty-label" className="text-xs font-semibold uppercase tracking-wider text-store-text-secondary">
            Quantity
          </span>
          <div className="inline-flex items-center h-10 border border-store-card-border bg-store-surface" role="group" aria-labelledby="pdp-qty-label">
            <button
              type="button"
              onClick={() => setRequestedQty(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
              className="w-10 h-full flex items-center justify-center text-store-charcoal hover:bg-store-cream cursor-pointer disabled:text-store-text-secondary disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-store-gold"
            >
              <Minus size={14} aria-hidden="true" />
            </button>
            <span className="w-10 text-center text-sm font-medium text-store-charcoal tuw-tabular-nums" aria-live="polite" aria-label={`Quantity ${quantity}`}>
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setRequestedQty(Math.min(maxQty, quantity + 1))}
              disabled={atMax}
              aria-label="Increase quantity"
              className="w-10 h-full flex items-center justify-center text-store-charcoal hover:bg-store-cream cursor-pointer disabled:text-store-text-secondary disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-store-gold"
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {!personalizationActive && (
      <div id="purchase-actions" ref={purchaseRef} className="space-y-3 scroll-mt-28">
        {atMax && maxQty > 1 && (
          <p className="text-xs text-store-text-secondary text-right" role="status">
            {maxQty < MAX_LINE_QTY
              ? `Only ${maxQty} available in ${selectedSize?.size}.`
              : `You can add up to ${MAX_LINE_QTY} at a time.`}
          </p>
        )}

        {soldOut ? (
          // Sold out: nothing to buy; the notify-me form above is the next step.
          <button
            type="button"
            disabled
            className="w-full h-14 px-6 rounded-full border border-store-card-border bg-store-canvas text-store-text-secondary font-medium text-xs uppercase tracking-wider cursor-not-allowed"
          >
            {selectedSize ? `Sold out in ${selectedSize.size}` : 'Sold out'}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleAddToCart}
              className="w-full h-14 px-6 rounded-full bg-store-cta text-white hover:bg-store-cta-hover transition-colors inline-flex items-center justify-center gap-2.5 font-medium text-xs uppercase tracking-wider shadow-sm cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold focus-visible:ring-offset-2"
            >
              {added ? <Check size={18} aria-hidden="true" /> : <ShoppingBag size={18} aria-hidden="true" />}
              <span aria-live="polite">{added ? 'Added to bag' : 'Add to bag'}</span>
              {!added && (
                <>
                  <span aria-hidden="true" className="opacity-50">·</span>
                  <span className="text-sm tracking-normal tuw-tabular-nums">{formatRupees(effectiveUnitPriceINR * quantity)}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void handleBuyNow()}
              disabled={buying}
              className="w-full h-14 px-6 rounded-full border border-store-charcoal bg-transparent text-store-charcoal hover:bg-store-charcoal hover:text-white transition-colors font-medium text-xs uppercase tracking-wider cursor-pointer disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold focus-visible:ring-offset-2"
            >
              {buying ? 'Going to checkout…' : 'Buy now'}
            </button>
          </>
        )}
      </div>
      )}

      {hasSizes && sizeChart && (
        <SizeGuideModal
          isOpen={isSizeGuideOpen}
          onClose={() => setIsSizeGuideOpen(false)}
          chart={sizeChart}
          sizeHeader={product.variantLabel}
          sizes={sizes.map((s) => s.size)}
        />
      )}

      {/* Phone buy bar. Portalled to <body> so no animated ancestor can pin
          it to the page instead of the screen. Adds straight to the bag once
          a size is chosen; otherwise it takes the shopper to the sizes. */}
      {mounted &&
        createPortal(
          <div
            className={`lg:hidden fixed inset-x-0 bottom-0 z-40 bg-store-surface border-t border-store-card-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3 transition-transform duration-300 motion-reduce:transition-none ${
              showBar ? 'translate-y-0' : 'translate-y-full'
            }`}
            inert={!showBar}
            aria-label="Buy this piece"
            role="region"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-store-charcoal truncate">{product.title}</p>
              <p className="text-sm text-store-text-secondary tuw-tabular-nums truncate">
                {barPrice}
                {selectedColor && hasColors ? ` · ${selectedColor.name}` : ''}
                {selectedSize && sizes.length > 1 ? ` · ${selectedSize.size}` : ''}
              </p>
            </div>
            {soldOut ? (
              <button
                type="button"
                onClick={goToSizes}
                className="h-11 px-5 rounded-full border border-store-charcoal text-store-charcoal text-xs font-medium uppercase tracking-wider cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
              >
                Sold out · Notify me
              </button>
            ) : needsSize ? (
              <button
                type="button"
                onClick={goToSizes}
                className="h-11 px-5 rounded-full bg-store-cta text-white text-xs font-medium uppercase tracking-wider cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
              >
                Choose {variantLabel.toLowerCase()}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAddToCart}
                className="h-11 px-5 rounded-full bg-store-cta text-white text-xs font-medium uppercase tracking-wider cursor-pointer inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
              >
                {added ? <Check size={14} aria-hidden="true" /> : <ShoppingBag size={14} aria-hidden="true" />}
                {added ? 'Added' : 'Add to bag'}
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
