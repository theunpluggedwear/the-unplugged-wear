'use client';
import { formatRupees } from '@storefront/lib/format';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ShoppingBag, ShieldCheck, Check } from 'lucide-react';
import { useCartDrawer, useStore } from '@storefront/mocks/store';
import Drawer from '@storefront/components/ui/Drawer';
import Button from '@storefront/components/ui/Button';
import BagLine from '@storefront/components/commerce/BagLine';
import BagPromoCode from '@storefront/components/commerce/BagPromoCode';
import Skeleton from '@storefront/components/ui/Skeleton';
import type { CartItem } from '@storefront/lib/types';

const LEAVE_MS = 320;

/** Lines that are "the same piece" even if the server swaps a temporary id for a real one. */
const signature = (line: CartItem) => `${line.productId}|${line.color}|${line.size}|${line.giftRecipientEmail ?? ''}`;

type DisplayedLine = { item: CartItem; key: string; leaving: boolean };

/**
 * The bag's lines plus, for a moment, the ones just removed, so a removal can
 * fold away instead of vanishing. Render keys stay stable when an optimistic
 * line's temporary id is replaced by the server's, so nothing re-animates.
 */
function useDisplayedLines(cart: CartItem[]): DisplayedLine[] {
  const keys = useRef(new Map<string, string>());
  const previous = useRef<CartItem[]>(cart);
  const [leaving, setLeaving] = useState<{ item: CartItem; key: string; index: number }[]>([]);
  const timers = useRef<number[]>([]);

  const ids = new Set(cart.map((line) => line.id));
  for (const line of cart) {
    if (keys.current.has(line.id)) continue;
    const replaced = previous.current.find((old) => !ids.has(old.id) && signature(old) === signature(line));
    keys.current.set(line.id, (replaced && keys.current.get(replaced.id)) ?? line.id);
  }

  useEffect(() => {
    const before = previous.current;
    previous.current = cart;
    const currentIds = new Set(cart.map((line) => line.id));
    const currentSignatures = new Set(cart.map(signature));
    const gone = before
      .map((item, index) => ({ item, index, key: keys.current.get(item.id) ?? item.id }))
      .filter(({ item }) => !currentIds.has(item.id) && !currentSignatures.has(signature(item)));
    if (gone.length === 0) return;
    setLeaving((list) => [...list, ...gone]);
    const goneKeys = new Set(gone.map((g) => g.key));
    timers.current.push(window.setTimeout(() => {
      setLeaving((list) => list.filter((entry) => !goneKeys.has(entry.key)));
      gone.forEach(({ item }) => keys.current.delete(item.id));
    }, LEAVE_MS));
  }, [cart]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const shown: DisplayedLine[] = cart.map((item) => ({ item, key: keys.current.get(item.id) ?? item.id, leaving: false }));
  const liveKeys = new Set(shown.map((line) => line.key));
  for (const entry of leaving) {
    if (liveKeys.has(entry.key)) continue; // restored (e.g. Undo) before it finished leaving
    shown.splice(Math.min(entry.index, shown.length), 0, { item: entry.item, key: entry.key, leaving: true });
  }
  return shown;
}

export default function CartDrawer() {
  const isCartDrawerOpen = useCartDrawer();
  const {
    cart,
    bagReady,
    bagError,
    refreshBag,
    setIsCartDrawerOpen,
    cartSubtotal,
    shippingFee,
    freeShippingThreshold,
    freeShippingRemaining,
    discountAmount,
  } = useStore();

  const total = cartSubtotal - discountAmount + shippingFee;
  const lines = useDisplayedLines(cart);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const showSummary = !bagError && bagReady && cart.length > 0;
  // Lines the server says can't be bought as they stand; checkout would refuse them.
  const blockedLines = cart.filter((line) => line.maxQty !== undefined && line.quantity > line.maxQty).length;
  // Celebrate free delivery only at the moment it unlocks, not on every open.
  const unlocked = freeShippingRemaining <= 0;
  const wasUnlocked = useRef(unlocked);
  const [justUnlocked, setJustUnlocked] = useState(false);
  useEffect(() => {
    if (unlocked && !wasUnlocked.current && cart.length > 0) {
      setJustUnlocked(true);
      const timer = window.setTimeout(() => setJustUnlocked(false), 1600);
      wasUnlocked.current = unlocked;
      return () => window.clearTimeout(timer);
    }
    wasUnlocked.current = unlocked;
  }, [unlocked, cart.length]);
  const freeShippingProgress = Math.min(
    100,
    Math.max(0, ((freeShippingThreshold - freeShippingRemaining) / freeShippingThreshold) * 100),
  );


  return (
    <Drawer
      isOpen={isCartDrawerOpen}
      onClose={() => setIsCartDrawerOpen(false)}
      position="right"
      maxWidth="max-w-md"
      title="Your bag"
      subtitle={
        <>
          {showSummary && (
            <span className="block text-store-charcoal font-medium">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          )}
          <span className="block">Printed to order in 2–3 business days</span>
        </>
      }
      bodyClassName="px-6 py-5"
      footer={showSummary ? (
        <div className="border-t border-store-card-border bg-white px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-4">
          {/* Free delivery progress */}
          <div aria-live="polite">
            <p className="flex items-center gap-1.5 text-xs font-medium text-store-charcoal">
              {unlocked ? (
                <>
                  <span
                    className={`inline-flex w-4 h-4 items-center justify-center rounded-full bg-store-gold text-white ${justUnlocked ? 'tuw-unlock-pop' : ''}`}
                    aria-hidden="true"
                  >
                    <Check size={10} strokeWidth={3} />
                  </span>
                  <span>Free delivery unlocked</span>
                </>
              ) : (
                <span>
                  <span className="font-semibold tuw-tabular-nums">{formatRupees(freeShippingRemaining)}</span> away from free delivery
                </span>
              )}
            </p>
            <div
              className="mt-2 h-[3px] w-full rounded-full bg-store-card-border overflow-hidden"
              role="progressbar"
              aria-label="Progress towards free delivery"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(freeShippingProgress)}
            >
              <div
                className={`h-full rounded-full transition-[width,background-color] duration-700 ease-out ${unlocked ? 'bg-store-gold' : 'bg-store-charcoal'} ${justUnlocked ? 'tuw-unlock-shine' : ''}`}
                style={{ width: `${freeShippingProgress}%` }}
              />
            </div>
          </div>

          {/* Promo code */}
          <BagPromoCode />

          {/* Summary */}
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between text-store-muted">
              <dt>Subtotal</dt>
              <dd className="tuw-tabular-nums">{formatRupees(cartSubtotal)}</dd>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-store-success">
                <dt>Discount</dt>
                <dd className="tuw-tabular-nums">−{formatRupees(discountAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between text-store-muted">
              <dt>Shipping · Standard</dt>
              <dd className="tuw-tabular-nums">{shippingFee === 0 ? 'Free' : formatRupees(shippingFee)}</dd>
            </div>
            <div className="flex items-end justify-between pt-2.5 mt-1 border-t border-store-card-border">
              <dt className="text-base font-semibold text-store-charcoal">
                Total
                <span className="block text-[11px] font-normal text-store-muted">Inclusive of GST</span>
              </dt>
              <dd className="text-lg font-semibold text-store-charcoal tuw-tabular-nums">{formatRupees(total)}</dd>
            </div>
          </dl>

          {/* Actions */}
          <div className="space-y-2.5">
            {blockedLines > 0 ? (
              <>
                <Button variant="dark" size="lg" fullWidth disabled aria-describedby="bag-blocked-note">
                  Proceed to Checkout
                </Button>
                <p id="bag-blocked-note" role="status" className="text-center text-xs text-store-terracotta">
                  {blockedLines === 1 ? 'One item needs' : `${blockedLines} items need`} your attention above before checkout.
                </p>
              </>
            ) : (
              <Button
                variant="dark"
                size="lg"
                fullWidth
                href="/checkout"
                onClick={() => setIsCartDrawerOpen(false)}
                icon={<ArrowRight size={16} />}
                iconPosition="right"
              >
                Proceed to Checkout
              </Button>
            )}
            <Link
              href="/cart"
              onClick={() => setIsCartDrawerOpen(false)}
              className="block text-center text-xs font-medium text-store-charcoal underline underline-offset-4 decoration-store-card-border hover:decoration-store-charcoal transition-colors py-1"
            >
              View full bag
            </Link>
            <p className="flex items-center justify-center gap-1.5 text-xs text-store-muted">
              <ShieldCheck size={14} className="text-store-success" aria-hidden="true" />
              <span>Secure checkout — you confirm the payment</span>
            </p>
          </div>
        </div>
      ) : undefined}
    >
      {bagError ? (
        <div className="flex flex-col items-center justify-center h-full text-center py-16" role="alert">
          <p className="text-sm text-store-text-secondary max-w-xs">{bagError}</p>
          <div className="mt-5">
            <Button variant="secondary" size="md" onClick={() => void refreshBag()}>Try again</Button>
          </div>
        </div>
      ) : !bagReady ? (
        <div aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading your bag…</span>
          <div className="divide-y divide-store-card-border -my-5">
            {[0, 1].map((row) => (
              <div key={row} className="py-5 flex gap-4" aria-hidden="true">
                <Skeleton className="w-24 h-28 shrink-0" />
                <div className="flex-1 flex flex-col gap-2 pt-1">
                  <div className="flex justify-between gap-6">
                    <Skeleton className="h-4 w-2/3 rounded" />
                    <Skeleton className="h-4 w-14 shrink-0 rounded" />
                  </div>
                  <Skeleton className="h-3 w-1/3 rounded" />
                  <Skeleton variant="circle" className="mt-auto w-28 h-10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center py-16">
          <div className="w-16 h-16 rounded-full bg-store-cream flex items-center justify-center text-store-muted mb-4">
            <ShoppingBag size={28} />
          </div>
          <h4 className="text-base font-semibold text-store-charcoal">Your bag is empty</h4>
          <p className="text-sm text-store-muted max-w-xs mt-1 leading-relaxed">
            Discover our hoodies, tees and everyday pieces.
          </p>
          <div className="mt-6">
            <Button
              variant="dark"
              size="md"
              onClick={() => setIsCartDrawerOpen(false)}
              href="/shop"
            >
              Explore Collection
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Cart Item List */}
          <div className="divide-y divide-store-card-border -my-5">
            {lines.map(({ item, key, leaving }, index) => (
              <div
                key={key}
                className={`tuw-bag-row ${leaving ? 'tuw-bag-row-leaving' : 'tuw-bag-row-enter'}`}
                style={{ animationDelay: `${Math.min(index, 5) * 45}ms` }}
                inert={leaving}
                aria-hidden={leaving || undefined}
              >
                <div className={leaving ? 'min-h-0 overflow-hidden' : 'min-h-0'}>
                  <BagLine item={item} onNavigate={() => setIsCartDrawerOpen(false)} />
                </div>
              </div>
            ))}
          </div>

        </div>
      )}
    </Drawer>
  );
}
