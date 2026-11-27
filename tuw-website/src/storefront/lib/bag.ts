'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { asyncReducer, initialAsync } from './async-state';
import type { CartLine } from '@tuw/heart/modules/cart';
import {
  addToBagAction, approveBagPreviewAction, changeBagVariantAction, clearBagAction, getBagAction, removeFromBagAction, setBagQtyAction, setWishlistAction,
} from '@/server/cart-actions';
import type { CartItem } from './types';

// The bag and wishlist from the database (TL-BE-07). Changes show at once
// and are sent one at a time, in order; the server's answer then replaces
// the optimistic version, and a refusal reloads the truth.

type Result<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

const toItem = (l: CartLine): CartItem => ({
  id: l.id,
  productId: l.productId,
  title: l.title,
  color: l.color ?? 'Standard',
  size: l.size ?? 'One size',
  priceINR: l.unitPaise / 100,
  priceMinorINR: l.unitPaise,
  quantity: l.qty,
  image: l.image ?? '',
  maxQty: l.maxQty,
  slug: l.slug ?? undefined,
  productKind: l.productKind,
  giftRecipientName: l.personalization?.recipientName,
  giftRecipientEmail: l.personalization?.recipientEmail,
  giftMessage: l.personalization?.message,
  monogram: l.personalization?.monogram,
  placement: l.personalization?.placement,
  previewImageUrl: l.previewImageUrl ?? undefined,
  previewApproved: l.previewApproved,
});

/** The storefront's neutral labels mean "no such axis" to the server. */
const axis = (value: string | undefined, neutral: RegExp) => (value && !neutral.test(value) ? value : undefined);

export function useBag(opts: { session: unknown; onError: (title: string, message: string) => void }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [load, dispatchLoad] = useReducer(asyncReducer<{ signedIn: boolean }>, initialAsync);
  const ready = load.kind === 'success';
  const error = load.kind === 'error' ? load.message : null;
  const signedIn = load.kind === 'success' ? load.data.signedIn : false;
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  /** Optimistic changes sent but not yet answered, oldest first. */
  const pending = useRef<((prev: CartItem[]) => CartItem[])[]>([]);
  const onError = useRef(opts.onError);
  onError.current = opts.onError;

  // A ref mirrors the wishlist so a toggle computes its target from the latest
  // value, not from a render's stale closure. Every write goes through this
  // helper so state and ref can never drift apart.
  const wishlistRef = useRef<string[]>([]);
  const applyWishlist = useCallback((next: string[]) => {
    wishlistRef.current = next;
    setWishlist(next);
  }, []);

  const refreshBag = useCallback(async () => {
    try {
      const result = await getBagAction({});
      if (!result.ok) {
        dispatchLoad({ type: 'FAIL', message: result.error.message });
        return;
      }
      setCart(result.data.lines.map(toItem));
      applyWishlist(result.data.wishlist);
      dispatchLoad({ type: 'SUCCESS', data: { signedIn: result.data.signedIn } });
    } catch (cause) {
      dispatchLoad({ type: 'FAIL', message: cause instanceof Error ? cause.message : 'Could not load your bag.' });
    }
  }, [applyWishlist]);

  // On load, and again whenever sign-in or sign-out refreshes the session.
  useEffect(() => { void refreshBag(); }, [opts.session, refreshBag]);

  /** Optimistic change now, server call in turn; the server's lines win. */
  const send = useCallback((optimistic: (prev: CartItem[]) => CartItem[], call: () => Promise<Result<CartLine[]>>, failTitle: string) => {
    setCart(optimistic);
    pending.current.push(optimistic);
    const settle = () => { pending.current = pending.current.filter((op) => op !== optimistic); };
    const next = queue.current.then(async () => {
      const result = await call().finally(settle);
      if (result.ok) {
        // The server's lines win, with changes still waiting in the queue
        // replayed on top, so an older reply never undoes a newer click.
        const server = result.data.map(toItem);
        setCart(pending.current.reduce((lines, op) => op(lines), server));
      } else {
        onError.current(failTitle, result.error.message);
        await refreshBag();
      }
      return result.ok;
    });
    queue.current = next.catch(() => undefined);
    return next;
  }, [refreshBag]);

  const addToCart = useCallback((item: Omit<CartItem, 'id'>) => {
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    return send(
      (prev) => {
        const twin = prev.find((i) => i.productId === item.productId && i.color === item.color && i.size === item.size && i.monogram === item.monogram && i.previewImageUrl === item.previewImageUrl);
        return twin ? prev.map((i) => (i === twin ? { ...i, quantity: i.quantity + item.quantity } : i)) : [...prev, { ...item, id: tempId }];
      },
      () => addToBagAction({
        productId: item.productId,
        color: axis(item.color, /^standard$/i),
        size: axis(item.size, /^one size$/i),
        qty: item.quantity,
        ...(item.giftRecipientEmail ? {
          personalization: {
            recipientName: item.giftRecipientName,
            recipientEmail: item.giftRecipientEmail,
            message: item.giftMessage,
          },
        } : item.monogram ? {
          personalization: {
            ...(item.monogram ? { monogram: item.monogram } : {}),
            ...(item.placement ? { placement: item.placement } : {}),
          },
          previewImageUrl: item.previewImageUrl,
        } : {}),
      }),
      'Could not add to bag',
    );
  }, [send]);

  const updateQuantity = useCallback((id: string, qty: number) => send(
    (prev) => (qty <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i))),
    () => setBagQtyAction({ lineId: id, qty: Math.max(0, qty) }),
    'Could not change the quantity',
  ), [send]);

  const updateCartItemVariant = useCallback((id: string, changes: { color?: string; size?: string; image?: string }) => send(
    (prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)),
    () => changeBagVariantAction({ lineId: id, color: axis(changes.color, /^standard$/i), size: axis(changes.size, /^one size$/i) }),
    'Could not change that item',
  ), [send]);

  const removeLine = useCallback((id: string) => send(
    (prev) => prev.filter((i) => i.id !== id),
    () => removeFromBagAction({ lineIds: [id] }),
    'Could not remove that item',
  ), [send]);

  const clearCart = useCallback(() => send(() => [], () => clearBagAction({}), 'Could not empty the bag'), [send]);

  /**
   * Queue a wishlist change. When `saved` is omitted the target is toggled from
   * the ref (the latest committed value), so two clicks in one tick cannot both
   * resolve to "save". The server calls still run one at a time, in order.
   */
  const setSaved = useCallback((productId: string, saved?: boolean) => {
    const current = wishlistRef.current;
    const isSaved = current.includes(productId);
    const target = saved ?? !isSaved;
    applyWishlist(target
      ? (isSaved ? current : [productId, ...current])
      : current.filter((id) => id !== productId));

    const task = queue.current.then(async () => {
      try {
        const result = await setWishlistAction({ productId, saved: target });
        if (result.ok) applyWishlist(result.data);
        else {
          onError.current('Could not update your wishlist', result.error.message);
          await refreshBag();
        }
        return result.ok;
      } catch (cause) {
        onError.current('Could not update your wishlist', cause instanceof Error ? cause.message : 'Please try again.');
        await refreshBag();
        return false;
      }
    });
    queue.current = task.catch(() => undefined);
    return task;
  }, [applyWishlist, refreshBag]);

  const isWishlistSaved = useCallback((productId: string) => wishlistRef.current.includes(productId), []);

  const addPersonalisedToCart = useCallback(async (item: Omit<CartItem, 'id'>) => {
    const result = await addToBagAction({
      productId: item.productId,
      color: axis(item.color, /^standard$/i),
      size: axis(item.size, /^one size$/i),
      qty: item.quantity,
      personalization: {
        ...(item.monogram ? { monogram: item.monogram } : {}),
        ...(item.placement ? { placement: item.placement } : {}),
      },
      previewImageUrl: item.previewImageUrl,
    });
    if (!result.ok) {
      onError.current('Could not add to bag', result.error.message);
      await refreshBag();
      return null;
    }
    await refreshBag();
    return result.data.find((l) => l.previewImageUrl === item.previewImageUrl && l.personalization?.monogram === item.monogram)?.id ?? null;
  }, [refreshBag]);

  const approvePreviewFor = useCallback((lineId: string) => send(
    (prev) => prev.map((i) => (i.id === lineId ? { ...i, previewApproved: true } : i)),
    () => approveBagPreviewAction({ lineId }),
    'Could not approve the preview',
  ), [send]);

  return { cart, wishlist, signedIn, ready, error, refreshBag, addToCart, addPersonalisedToCart, approvePreviewFor, updateQuantity, updateCartItemVariant, removeLine, clearCart, setSaved, isWishlistSaved };
}
