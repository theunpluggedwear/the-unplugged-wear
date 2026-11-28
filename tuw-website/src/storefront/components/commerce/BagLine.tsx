'use client';

import React from 'react';
import Link from 'next/link';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { formatRupees } from '@storefront/lib/format';
import { useStore } from '@storefront/mocks/store';
import ImageWithFallback from '@storefront/components/ui/ImageWithFallback';
import TuwEmblem from '@storefront/components/layout/TuwEmblem';
import Listbox from '@storefront/components/ui/Listbox';
import { variantLabelOf } from '@storefront/lib/product';
import type { CartItem } from '@storefront/lib/types';
import { BagPreview } from '@storefront/plugins/personalization';

/** The storefront's neutral labels for "this product has no such option". */
const NEUTRAL_COLOR = /^standard$/i;
const NEUTRAL_SIZE = /^(one size|standard)$/i;

interface BagLineProps {
  item: CartItem;
  /** Called before following a link out of the bag (e.g. to close the drawer). */
  onNavigate?: () => void;
}

/**
 * One line in the shopping bag: linked thumbnail and title, editable colour and
 * size, a roomy quantity stepper (the minus turns into remove at 1), and
 * "Save for later" / "Remove" actions whose toasts offer Undo. Lines the
 * server says can no longer be bought are greyed out with a clear note.
 */
export default function BagLine({ item, onNavigate }: BagLineProps) {
  const { products, updateQuantity, updateCartItemVariant, removeFromCart, saveForLater } = useStore();

  const product = products.find((p) => p.id === item.productId || p.productId === item.productId);
  const slug = item.slug ?? product?.slug;
  const href = slug ? `/products/${slug}` : undefined;
  const isGiftCard = item.productKind === 'gift_card' || product?.productKind === 'gift_card';

  const unavailable = item.maxQty === 0;
  const overLimit = !unavailable && item.maxQty !== undefined && item.quantity > item.maxQty;
  const atMax = item.maxQty !== undefined && item.quantity >= item.maxQty;

  const showColor = !NEUTRAL_COLOR.test(item.color);
  const showSize = !NEUTRAL_SIZE.test(item.size);
  const colorChoices = product?.colors ?? [];
  const sizeChoices = product?.sizes ?? [];
  const sizeLabel = product ? variantLabelOf(product) : 'Size';
  const editable = !isGiftCard && !unavailable;

  const chooseColor = (name: string) => {
    if (name === item.color) return;
    const choice = colorChoices.find((c) => c.name === name);
    const image = product?.images.find(
      (img) => img.color === choice?.value || img.color?.toLowerCase() === name.toLowerCase(),
    )?.url;
    updateCartItemVariant(item.id, { color: name, ...(image ? { image } : {}) });
  };
  const chooseSize = (size: string) => {
    if (size !== item.size) updateCartItemVariant(item.id, { size });
  };

  const placeholder = (
    <div className="w-full h-full flex items-center justify-center bg-store-cream" role="img" aria-label={item.title}>
      <TuwEmblem className="w-10 h-auto text-store-card-border" />
    </div>
  );

  const thumbnail = (
    <div className="w-24 h-28 rounded-lg overflow-hidden bg-store-cream border border-store-card-border">
      <ImageWithFallback src={item.image || undefined} alt={item.title} className="w-full h-full object-cover" fallback={placeholder} />
    </div>
  );

  return (
    <div className={`py-5 flex gap-4 ${unavailable ? 'opacity-60' : ''}`}>
      {href ? (
        <Link href={href} onClick={onNavigate} className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-store-charcoal" tabIndex={-1} aria-hidden="true">
          {thumbnail}
        </Link>
      ) : (
        <div className="shrink-0">{thumbnail}</div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Title + line total */}
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-sm font-semibold text-store-charcoal leading-snug">
            {href ? (
              <Link href={href} onClick={onNavigate} className="hover:underline underline-offset-4 decoration-store-card-border">
                {item.title}
              </Link>
            ) : (
              item.title
            )}
          </h4>
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-store-charcoal tuw-tabular-nums">{formatRupees(item.priceINR * item.quantity)}</p>
            {item.quantity > 1 && (
              <p className="text-[11px] text-store-muted tuw-tabular-nums">{formatRupees(item.priceINR)} each</p>
            )}
          </div>
        </div>

        {/* Gift cards and unavailable lines show their details as text */}
        {(isGiftCard || unavailable) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-store-muted">
            {isGiftCard ? (
              <span>Gift card{item.giftRecipientName ? ` for ${item.giftRecipientName}` : ''}</span>
            ) : (
              <>
                {showColor && <span>{item.color}</span>}
                {showColor && showSize && <span aria-hidden="true">·</span>}
                {showSize && <span>{item.size}</span>}
              </>
            )}
          </div>
        )}

        <BagPreview item={item} />

        {item.selectedRadioOptions && item.selectedRadioOptions.length > 0 && (
          <div className="text-xs text-store-muted mt-1 space-y-0.5">
            {item.selectedRadioOptions.map((opt) => (
              <div key={opt.groupKey}>
                {opt.groupLabel}: <span className="font-medium text-store-charcoal">{opt.optionLabel}</span>
              </div>
            ))}
          </div>
        )}

        {/* Availability notes */}
        {unavailable && (
          <p className="mt-2 text-xs font-medium text-store-terracotta">No longer available — remove it to check out.</p>
        )}
        {overLimit && (
          <p className="mt-2 text-xs font-medium text-store-terracotta">Only {item.maxQty} available — please lower the quantity.</p>
        )}

        {/* Colour, size and quantity — changed right here, like checkout */}
        <div className="mt-auto pt-3 flex flex-wrap items-center gap-2">
          {editable && showColor && (
            <Listbox
              label={`Colour for ${item.title}`}
              value={item.color}
              onChange={chooseColor}
              options={(colorChoices.length ? colorChoices : [{ name: item.color, value: item.color, hex: '#D9D4C7' }]).map((c) => ({
                value: c.name,
                label: c.name,
                swatch: c.hex,
              }))}
            />
          )}
          {editable && showSize && (
            <Listbox
              label={sizeLabel}
              showLabel
              value={item.size}
              onChange={chooseSize}
              options={(sizeChoices.length ? sizeChoices : [{ size: item.size, inStock: true, stockCount: 1 }]).map((sz) => ({
                value: sz.size,
                label: sz.size,
                disabled: !sz.inStock && sz.size !== item.size,
                note: sz.inStock ? undefined : 'Sold out',
              }))}
            />
          )}
          {!unavailable && (
            <div
              className="inline-flex items-center h-8 border border-store-card-border bg-store-surface text-xs text-store-charcoal"
              role="group"
              aria-label={`Quantity of ${item.title}`}
            >
              <button
                type="button"
                onClick={() => (item.quantity <= 1 ? removeFromCart(item.id) : updateQuantity(item.id, item.quantity - 1))}
                aria-label={item.quantity <= 1 ? `Remove ${item.title}` : `Decrease quantity of ${item.title}`}
                className="w-8 h-full flex items-center justify-center text-store-text-secondary hover:text-store-charcoal transition-colors cursor-pointer"
              >
                {item.quantity <= 1 ? <Trash2 size={12} /> : <Minus size={12} />}
              </button>
              <span className="w-6 text-center font-medium tuw-tabular-nums" aria-live="polite">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                disabled={atMax}
                title={atMax ? 'No more available' : undefined}
                aria-label={`Increase quantity of ${item.title}`}
                className="w-8 h-full flex items-center justify-center text-store-text-secondary hover:text-store-charcoal transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Line actions */}
        <div className="mt-2 flex items-center gap-4 text-xs font-medium whitespace-nowrap">
          {!isGiftCard && !unavailable && (
            <button
              type="button"
              onClick={() => saveForLater(item.id)}
              className="text-store-muted hover:text-store-charcoal underline-offset-4 hover:underline cursor-pointer py-1.5"
            >
              Save for later<span className="sr-only">: {item.title}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => removeFromCart(item.id)}
            className="text-store-muted hover:text-store-charcoal underline-offset-4 hover:underline cursor-pointer py-1.5"
          >
            Remove<span className="sr-only"> {item.title}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
