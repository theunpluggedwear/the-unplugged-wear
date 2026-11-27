'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { useSiteSettings } from '@storefront/lib/site-settings';
import { Toaster, toast as sonnerToast } from 'sonner';
import BrandToast, { type BrandToastProps } from '@storefront/components/ui/BrandToast';

// Every storefront toast uses the branded card.
const showToast = (props: Omit<BrandToastProps, 'id'>) =>
  sonnerToast.custom((id) => <BrandToast id={id} {...props} />);
import { Product, CartItem } from '@storefront/lib/types';
import { useBag } from '@storefront/lib/bag';
import { previewDiscountAction } from '@/server/order-actions';
import { formatPaise } from '@storefront/lib/format';
import type { DiscountRule } from '@tuw/heart/modules/orders';
import type { SizeChartData } from '@storefront/lib/types';
import type { Navigation } from '@/server/nav';
import type { NavItem } from '@storefront/components/layout/navigation';

/**
 * What crosses the Server → Client boundary. The shop and PDP read the full
 * catalog on the server; the provider only needs the pieces the header's
 * mega-menu, search suggestions and bag summaries resolve against.
 */
export interface NavCatalog {
  products: Product[];
  sizeCharts: SizeChartData[];
}

/** Sonner renders toasts directly; this is only the caller-facing shape. */
export type PromoApplyOptions = { quiet?: boolean; onError?: (message: string) => void };

export type ToastInput = {
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  description?: string;
};

interface StoreContextType {
  // Products (nav-sized projection from the root layout — TL-BE-05)
  products: Product[];
  hiddenCategories: string[];
  menuItems: NavItem[];
  sizeCharts: SizeChartData[];
  getProductBySlug: (slug: string) => Product | undefined;

  // Cart
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  /** Personalisation plugin: add a previewed line and return its id for approval. */
  addPersonalisedToCart: (item: Omit<CartItem, 'id'>) => Promise<string | null>;
  approvePreviewFor: (lineId: string) => Promise<boolean>;
  /**
   * Buy now: make the bag hold exactly this item and quantity, without
   * opening the drawer. An identical line is set to the quantity instead of
   * being added to again. Resolves false if the server refused.
   */
  buyNow: (item: Omit<CartItem, 'id'>) => Promise<boolean>;
  updateQuantity: (id: string, qty: number) => void;
  /** Change a bag line's colour/size; merges with an identical line if one exists. */
  updateCartItemVariant: (id: string, changes: { color?: string; size?: string; image?: string }) => void;
  removeFromCart: (id: string) => void;
  /** Move a bag line to the wishlist (signed-in shoppers); the toast offers Undo. */
  saveForLater: (id: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  shippingFee: number;
  freeShippingThreshold: number;
  freeShippingRemaining: number;
  promoCode: string;
  discountAmount: number;
  /** `quiet` skips the toasts and reports a refusal through `onError` instead (for inline messages). */
  applyPromoCode: (code: string, opts?: PromoApplyOptions) => Promise<boolean>;
  removePromoCode: () => void;
  /** Stable setter; the open flag lives in its own subscription so opening the
   * drawer does not re-render every useStore consumer. */
  setIsCartDrawerOpen: (open: boolean) => void;

  /** Bag hydration state, exposed so list pages can show loading/error instead
   * of a misleading empty bag. */
  bagReady: boolean;
  bagError: string | null;

  // Wishlist
  wishlist: string[]; // product IDs
  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;

  // Toasts (Sonner is mounted once by the provider)
  addToast: (toast: ToastInput) => void;

  /** Reload the bag and wishlist from the database (after an order is placed). */
  refreshBag: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | null>(null);

const linePaise = (item: CartItem) => item.priceMinorINR ?? item.priceINR * 100;

// The cart drawer is UI-only state. Keeping it outside the data context means
// opening/closing it re-renders just the drawer, not every bag/catalog consumer.
let cartDrawerOpen = false;
const drawerListeners = new Set<() => void>();
const subscribeDrawer = (listener: () => void) => {
  drawerListeners.add(listener);
  return () => { drawerListeners.delete(listener); };
};
const drawerSnapshot = () => cartDrawerOpen;
const setIsCartDrawerOpen = (open: boolean) => {
  if (cartDrawerOpen === open) return;
  cartDrawerOpen = open;
  drawerListeners.forEach((listener) => listener());
};
export function useCartDrawer() {
  return useSyncExternalStore(subscribeDrawer, drawerSnapshot, drawerSnapshot);
}

export function StoreProvider({ children, catalog, nav, session }: { children: React.ReactNode; session?: unknown; catalog: NavCatalog; nav: Navigation }) {
  const STORE_PRODUCTS = catalog.products;
  // Fees come from admin Settings (store_settings). The bag, wishlist and
  // orders live in the database (useBag / useMyOrders); promo codes are still
  // held locally.
  const { shipping } = useSiteSettings();
  const FREE_SHIPPING_THRESHOLD_PAISE = shipping.freeThresholdPaise;
  const STANDARD_SHIPPING_FEE_PAISE = shipping.standardFeePaise;
  const [products, setProducts] = useState<Product[]>(STORE_PRODUCTS);
  // A fresh catalog (admin edit → revalidated layout) replaces the baseline.
  useEffect(() => { setProducts(catalog.products); }, [catalog.products]);
  const [promoCode, setPromoCode] = useState<string>('');
  const [promoRule, setPromoRule] = useState<DiscountRule | null>(null);
  const [promoMinPaise, setPromoMinPaise] = useState<number | null>(null);

  const lastToastRef = useRef<{ key: string; time: number } | null>(null);

  const addToast = useCallback((toast: ToastInput) => {
    const key = `${toast.title}:${toast.description || ''}`;
    const now = Date.now();
    if (lastToastRef.current && lastToastRef.current.key === key && now - lastToastRef.current.time < 800) {
      return;
    }
    lastToastRef.current = { key, time: now };

    // Rendered by Sonner's <Toaster> below (brand-styled, stacked, swipe-to-dismiss).
    showToast({ title: toast.title, description: toast.description, tone: toast.type });
  }, []);

  // Bag and wishlist from the database.
  const bag = useBag({ session, onError: (title, message) => showToast({ title, description: message, tone: 'error' }) });
  const { cart, wishlist, updateQuantity, updateCartItemVariant, clearCart } = bag;

  const addToCart = useCallback((item: Omit<CartItem, 'id'>) => {
    void bag.addToCart(item);
    // Opening the bag drawer is the confirmation; a toast on top of it would cover the checkout button.
    setIsCartDrawerOpen(true);
  }, [bag.addToCart]);

  const buyNow = useCallback(async (item: Omit<CartItem, 'id'>) => {
    const twin = cart.find((i) => i.productId === item.productId && i.color === item.color && i.size === item.size
      && i.monogram === item.monogram && i.previewImageUrl === item.previewImageUrl);
    if (!twin) return bag.addToCart(item);
    if (twin.quantity === item.quantity) return true;
    return bag.updateQuantity(twin.id, item.quantity);
  }, [cart, bag.addToCart, bag.updateQuantity]);

  /** Put a removed line back exactly as it was (variant, quantity, gift details). */
  const restoreLine = useCallback((item: CartItem) => {
    const { id: _removedId, maxQty: _maxQty, ...line } = item;
    void bag.addToCart(line);
  }, [bag.addToCart]);

  const removeFromCart = useCallback((id: string) => {
    const item = cart.find((i) => i.id === id);
    void bag.removeLine(id).then((ok) => {
      if (!ok || !item) return;
      showToast({
        title: 'Removed from bag',
        description: item.title,
        image: item.image || undefined,
        tone: 'info',
        action: { label: 'Undo', onClick: () => restoreLine(item) },
      });
    });
  }, [cart, bag.removeLine, restoreLine]);

  const saveForLater = useCallback((id: string) => {
    const item = cart.find((i) => i.id === id);
    if (!item) return;
    if (!bag.signedIn) {
      const next = typeof window === 'undefined' ? '/' : window.location.pathname;
      showToast({ title: 'Sign in to save pieces', description: 'Your wishlist is kept with your account.', image: item.image || undefined, tone: 'info', action: { label: 'Sign in', href: `/login?next=${encodeURIComponent(next)}` } });
      return;
    }
    void (async () => {
      const saved = await bag.setSaved(item.productId, true);
      if (!saved) return;
      const removed = await bag.removeLine(id);
      if (!removed) return;
      showToast({
        title: 'Saved for later',
        description: `${item.title} is in your wishlist.`,
        image: item.image || undefined,
        action: { label: 'Undo', onClick: () => restoreLine(item) },
      });
    })();
  }, [cart, bag.signedIn, bag.setSaved, bag.removeLine, restoreLine]);

  const totals = useMemo(() => {
    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    const subtotalPaise = cart.reduce((acc, item) => acc + linePaise(item) * item.quantity, 0);
    const discountPaise = !promoRule || (promoMinPaise !== null && subtotalPaise < promoMinPaise) ? 0
      : promoRule.type === 'percent' ? Math.round((subtotalPaise * promoRule.percent) / 100) : Math.min(subtotalPaise, promoRule.paise);
    const eligiblePaise = subtotalPaise - discountPaise;
    const shippingFeePaise = subtotalPaise === 0 || eligiblePaise >= FREE_SHIPPING_THRESHOLD_PAISE ? 0 : STANDARD_SHIPPING_FEE_PAISE;
    return {
      cartCount,
      cartSubtotal: subtotalPaise / 100,
      discountAmount: discountPaise / 100,
      shippingFee: shippingFeePaise / 100,
      freeShippingRemaining: Math.max(0, FREE_SHIPPING_THRESHOLD_PAISE - eligiblePaise) / 100,
    };
  }, [cart, promoRule, promoMinPaise, FREE_SHIPPING_THRESHOLD_PAISE, STANDARD_SHIPPING_FEE_PAISE]);
  const { cartCount, cartSubtotal, discountAmount, shippingFee, freeShippingRemaining } = totals;

  /** Checked on the server against the bag; the order total is decided again at checkout. */
  const applyPromoCode = useCallback(async (code: string, opts?: PromoApplyOptions): Promise<boolean> => {
    let result: Awaited<ReturnType<typeof previewDiscountAction>>;
    try {
      result = await previewDiscountAction({ code });
    } catch {
      result = { ok: false, error: { message: 'We could not check that code just now. Please try again.' } } as typeof result;
    }
    if (result.ok) {
      setPromoCode(result.data.code);
      setPromoRule(result.data.rule);
      setPromoMinPaise(result.data.minOrderPaise);
      if (!opts?.quiet) addToast({ type: 'success', title: 'Code applied', description: `${result.data.code} takes ${formatPaise(result.data.discountPaise)} off this bag.` });
      return true;
    }
    if (opts?.quiet) opts.onError?.(result.error.message);
    else addToast({ type: 'error', title: 'Code not applied', description: result.error.message });
    return false;
  }, [addToast]);

  const removePromoCode = useCallback(() => {
    setPromoCode('');
    setPromoRule(null);
    setPromoMinPaise(null);
  }, []);

  // Wishlist: customers only, so a guest's heart asks them to sign in.
  const toggleWishlist = useCallback((productId: string) => {
    const product = products.find((p) => p.id === productId);
    const name = product?.title ?? 'This piece';
    const image = product?.images[0]?.url;
    if (!bag.signedIn) {
      const next = typeof window === 'undefined' ? '/' : window.location.pathname;
      showToast({ title: 'Sign in to save pieces', description: 'Your wishlist is kept with your account.', image, tone: 'info', action: { label: 'Sign in', href: `/login?next=${encodeURIComponent(next)}` } });
      return;
    }
    // Read the latest committed value (the ref inside useBag), not this render's
    // closure, so two fast clicks always toggle in opposite directions.
    const wasSaved = bag.isWishlistSaved(productId);
    void bag.setSaved(productId).then((ok) => {
      if (!ok) return;
      if (wasSaved) {
        showToast({ title: 'Removed from wishlist', description: name, image, tone: 'info', action: { label: 'Undo', onClick: () => void bag.setSaved(productId, true) } });
      } else {
        showToast({ title: 'Saved to wishlist', description: name, image, action: { label: 'View', href: '/account/wishlist' } });
      }
    });
  }, [products, bag.signedIn, bag.setSaved, bag.isWishlistSaved]);

  const isInWishlist = useCallback(
    (productId: string) => wishlist.includes(productId),
    [wishlist]
  );

  // Addresses live in the real address book now (storefront/lib/account, TL-BE-03).

  const getProductBySlug = useCallback((slug: string) =>
    products.find(
      (p) =>
        p.slug.toLowerCase() === slug.toLowerCase() ||
        p.aliases?.some((a) => a.toLowerCase() === slug.toLowerCase())
    ), [products]);

  // One value object per data change only: toasts are handled by Sonner and the
  // drawer flag lives in its own subscription, so neither invalidates this.
  const storeValue = useMemo<StoreContextType>(() => ({
    products,
    hiddenCategories: nav.hiddenCategories,
    menuItems: nav.menuItems,
    sizeCharts: catalog.sizeCharts,
    getProductBySlug,
    cart,
    addToCart,
    addPersonalisedToCart: bag.addPersonalisedToCart,
    approvePreviewFor: bag.approvePreviewFor,
    buyNow,
    updateQuantity,
    updateCartItemVariant,
    removeFromCart,
    saveForLater,
    clearCart,
    cartCount,
    cartSubtotal,
    shippingFee,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD_PAISE / 100,
    freeShippingRemaining,
    promoCode,
    discountAmount,
    applyPromoCode,
    removePromoCode,
    setIsCartDrawerOpen,
    bagReady: bag.ready,
    bagError: bag.error,
    wishlist,
    toggleWishlist,
    isInWishlist,
    addToast,
    refreshBag: bag.refreshBag,
  }), [
    products, nav.hiddenCategories, nav.menuItems,
    catalog.sizeCharts, getProductBySlug, cart, addToCart, bag.addPersonalisedToCart, bag.approvePreviewFor, buyNow, updateQuantity, updateCartItemVariant,
    removeFromCart, saveForLater, clearCart, cartCount, cartSubtotal, shippingFee, FREE_SHIPPING_THRESHOLD_PAISE,
    freeShippingRemaining, promoCode, discountAmount, applyPromoCode, removePromoCode,
    bag.ready, bag.error, wishlist, toggleWishlist, isInWishlist, addToast,
    bag.refreshBag,
  ]);

  return (
    <StoreContext.Provider value={storeValue}>
      {children}

      {/* Small toasts near the top edge, over the announcement bar. */}
      <Toaster position="top-center" offset={{ top: 12 }} mobileOffset={{ top: 8 }} duration={3000} visibleToasts={3} gap={6} />
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return ctx;
}
