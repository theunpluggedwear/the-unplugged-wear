'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Button from '@storefront/components/ui/Button';
import ImageWithFallback from '@storefront/components/ui/ImageWithFallback';
import { useStore } from '@storefront/mocks/store';
import { useSession } from '@storefront/lib/session';
import { useSiteSettings } from '@storefront/lib/site-settings';
import { resendVerificationEmailAction } from '@/server/auth-actions';
import { formatPaise, formatShortDate } from '@storefront/lib/format';
import { downloadInvoicePdf } from '@storefront/lib/invoice';
import type { Order } from '@storefront/lib/types';
import { ChevronDown, Download, ShoppingBag, Truck } from 'lucide-react';
import { useAccountPage } from './AccountShell';
import {
  ORDERS_PAGE_SIZE,
  ORDER_FILTERS,
  RETURN_WINDOW_DAYS,
  OrderProgress,
  StatusPills,
  fulfillmentOf,
  hasIssue,
  itemImage,
  lineTotalPaise,
  matchesFilter,
  orderPaise,
  returnWindow,
  type OrderFilter,
} from './account-helpers';

/** /account/orders — order history with filters, details, buy again and returns. */
export default function OrdersSection() {
  const { myOrders } = useAccountPage();
  const { orders, claimable, reload, claim } = myOrders;
  const { addToCart, products } = useStore();
  const { session } = useSession();
  const { supportEmail } = useSiteSettings();
  const accountEmail = session?.email ?? '';

  const [claimNote, setClaimNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [resendNote, setResendNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [resending, setResending] = useState(false);
  const [verifyDevLink, setVerifyDevLink] = useState<string | null>(null);

  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
  const [visibleCount, setVisibleCount] = useState(ORDERS_PAGE_SIZE);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(orders[0]?.id ?? null);
  const [buyAgainOrderId, setBuyAgainOrderId] = useState<string | null>(null);
  const buyAgainTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (buyAgainTimer.current) clearTimeout(buyAgainTimer.current); }, []);

  const filteredOrders = useMemo(
    () => orders.filter((order) => matchesFilter(order, orderFilter)),
    [orders, orderFilter]
  );
  const visibleOrders = filteredOrders.slice(0, visibleCount);

  const handleResendVerification = async () => {
    if (resending) return;
    setResending(true);
    setResendNote(null);
    setVerifyDevLink(null);
    try {
      const result = await resendVerificationEmailAction({});
      if (!result.ok) {
        setResendNote({ ok: false, text: result.error.message });
        return;
      }
      if (result.data.alreadyVerified) {
        // Verified in another tab — refresh so the claim button takes over.
        await reload();
        setResendNote({ ok: true, text: 'Your email is verified. You can now add your guest orders.' });
        return;
      }
      setVerifyDevLink(result.data.devLink);
      setResendNote({
        ok: true,
        text: result.data.devLink
          ? 'Demo verification link ready - open it to confirm your email, then come back to add your guest orders.'
          : result.data.delivered
            ? 'We sent a verification link to your email. Open it, then come back to add your guest orders.'
            : 'Demo mode: no email was sent. Open the verification link printed in the dev server log, then come back to add your guest orders.',
      });
    } catch {
      setResendNote({ ok: false, text: 'Could not send the verification email just now. Please try again.' });
    } finally {
      setResending(false);
    }
  };

  const handleBuyAgain = (order: Order) => {
    order.items.forEach(({ id: _id, ...item }) => addToCart(item));
    setBuyAgainOrderId(order.id);
    if (buyAgainTimer.current) clearTimeout(buyAgainTimer.current);
    buyAgainTimer.current = setTimeout(() => setBuyAgainOrderId(null), 2000);
  };

  const changeFilter = (filter: OrderFilter) => {
    setOrderFilter(filter);
    setVisibleCount(ORDERS_PAGE_SIZE);
  };

  return (
    <section aria-labelledby="orders-heading" className="space-y-5">
      {claimable.count > 0 && (
        <div className="p-4 border border-store-card-border bg-store-cream text-sm text-store-charcoal space-y-2">
          <p>
            You have {claimable.count} order{claimable.count === 1 ? '' : 's'} placed as a guest with this email.
            {claimable.verified
              ? ' Add them here to track and manage them.'
              : ' These are legacy guest orders from before you had an account. Confirm your email first, so we know they are yours.'}
          </p>
          {claimable.verified ? (
            <Button
              variant="dark"
              size="sm"
              disabled={claiming}
              onClick={async () => {
                if (claiming) return;
                setClaiming(true);
                try {
                  const result = await claim();
                  setClaimNote({ ok: result.ok, text: result.message });
                } catch {
                  setClaimNote({ ok: false, text: 'Could not add your guest orders just now. Please try again.' });
                } finally {
                  setClaiming(false);
                }
              }}
            >
              {claiming ? 'Adding…' : 'Add them to my account'}
            </Button>
          ) : (
            <Button variant="dark" size="sm" disabled={resending} onClick={() => void handleResendVerification()}>
              {resending ? 'Sending…' : 'Resend verification email'}
            </Button>
          )}
          {resendNote && (
            <p role={resendNote.ok ? 'status' : 'alert'} className={`text-sm ${resendNote.ok ? 'text-store-charcoal' : 'text-red-700'}`}>
              {resendNote.text}
            </p>
          )}
          {verifyDevLink && (
            <p>
              <a
                href={verifyDevLink}
                className="font-medium text-store-charcoal underline underline-offset-4 decoration-store-gold hover:decoration-store-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold"
              >
                Open verification link (demo)
              </a>
            </p>
          )}
        </div>
      )}
      {claimNote && (
        <p role={claimNote.ok ? 'status' : 'alert'} className={`text-sm ${claimNote.ok ? 'text-store-charcoal' : 'text-red-700'}`}>{claimNote.text}</p>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 id="orders-heading" className="font-heading text-xl font-medium text-store-charcoal">
          Order history
        </h2>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0" role="group" aria-label="Filter orders">
          {ORDER_FILTERS.map((filter) => {
            const isActive = orderFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => changeFilter(filter.id)}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-store-gold ${
                  isActive
                    ? 'bg-store-charcoal text-white'
                    : 'border border-store-border text-store-text-secondary hover:border-store-charcoal hover:text-store-charcoal'
                }`}
              >
                {filter.label}
                <span className="ml-1.5 opacity-70 tuw-tabular-nums">
                  {orders.filter((o) => matchesFilter(o, filter.id)).length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="py-16 text-center border border-store-card-border bg-store-surface px-8">
          <p className="text-sm text-store-text-secondary">
            {orders.length === 0 ? 'You haven’t placed any orders yet.' : 'No orders match this filter.'}
          </p>
          <div className="mt-4">
            <Button variant="dark" size="sm" href="/shop">
              Explore the collection
            </Button>
          </div>
        </div>
      ) : (
        <ul className="border border-store-card-border bg-store-surface divide-y divide-store-card-border">
          {visibleOrders.map((order) => {
            const isOpen = expandedOrderId === order.id;
            const money = orderPaise(order);
            const retWindow = returnWindow(order);
            const panelId = `order-panel-${order.id}`;
            return (
              <li key={order.id}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setExpandedOrderId(isOpen ? null : order.id)}
                    className="w-full flex items-center gap-4 p-4 sm:p-5 text-left hover:bg-store-canvas transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-store-gold"
                  >
                    <span className="flex -space-x-3 shrink-0" aria-hidden="true">
                      {order.items.slice(0, 2).map((item) => (
                        <span key={item.id} className="block w-12 h-16 overflow-hidden bg-store-cream border-2 border-store-surface">
                          <ImageWithFallback src={itemImage(item, products)} alt="" fallbackText="" className="w-full h-full object-cover" />
                        </span>
                      ))}
                    </span>
                    <span className="flex-1 min-w-0 grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-store-charcoal">{order.orderNumber}</span>
                        <span className="block text-xs text-store-text-secondary mt-0.5">
                          {formatShortDate(order.date)} · {order.items.length} item{order.items.length === 1 ? '' : 's'} ·{' '}
                          <span className="tuw-tabular-nums">{formatPaise(money.total)}</span>
                        </span>
                      </span>
                      <StatusPills order={order} />
                    </span>
                    <ChevronDown
                      size={18}
                      aria-hidden="true"
                      className={`shrink-0 text-store-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                </h3>

                {isOpen && (
                  <div id={panelId} className="px-4 sm:px-5 pb-6 space-y-6">
                    <OrderProgress order={order} />

                    <ul className="divide-y divide-store-card-border border-y border-store-card-border">
                      {order.items.map((item) => (
                        <li key={item.id} className="py-4 flex gap-4">
                          <div className="w-16 h-20 overflow-hidden bg-store-cream shrink-0">
                            <ImageWithFallback src={itemImage(item, products)} alt={item.title} fallbackText="" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 flex justify-between gap-4">
                            <div>
                              <p className="text-sm font-medium text-store-charcoal">{item.title}</p>
                              <p className="text-xs text-store-text-secondary mt-0.5">
                                {item.color} · Size {item.size} · Qty {item.quantity}
                              </p>
                            </div>
                            <span className="text-sm text-store-charcoal tuw-tabular-nums">
                              {formatPaise(lineTotalPaise(item))}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="grid gap-6 sm:grid-cols-2 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-store-text-secondary mb-1.5">Delivering to</p>
                        <p className="text-store-charcoal leading-relaxed">
                          {order.shippingAddress.fullName}
                          <br />
                          <span className="text-store-text-secondary">
                            {order.shippingAddress.addressLine1}, {order.shippingAddress.city} {order.shippingAddress.postalCode}
                          </span>
                        </p>
                      </div>
                      <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-store-text-secondary tuw-tabular-nums">
                        <dt>Items</dt>
                        <dd className="text-right text-store-charcoal">{formatPaise(money.subtotal)}</dd>
                        <dt>Shipping</dt>
                        <dd className="text-right text-store-charcoal">{money.shipping ? formatPaise(money.shipping) : 'Free'}</dd>
                        {money.discount > 0 && (
                          <>
                            <dt>Discount</dt>
                            <dd className="text-right text-store-charcoal">−{formatPaise(money.discount)}</dd>
                          </>
                        )}
                        <dt className="pt-2 border-t border-store-card-border font-medium text-store-charcoal">Total</dt>
                        <dd className="pt-2 border-t border-store-card-border text-right font-medium text-store-charcoal">
                          {formatPaise(money.total)}
                        </dd>
                        <dt className="text-xs">Paid by</dt>
                        <dd className="text-right text-xs">{order.paymentMethod}</dd>
                      </dl>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <Button variant="dark" size="sm" href={`/account/orders/${encodeURIComponent(order.orderNumber)}`}>
                        View order details
                      </Button>
                      {(fulfillmentOf(order) === 'shipped' || fulfillmentOf(order) === 'delivered') && (
                        <Button variant="secondary" size="sm" href={`/track-order?ref=${encodeURIComponent(order.orderNumber)}`}>
                          <Truck size={14} aria-hidden="true" /> Track shipment
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => handleBuyAgain(order)}>
                        <ShoppingBag size={14} aria-hidden="true" />
                        {buyAgainOrderId === order.id ? 'Added to bag' : 'Buy again'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void downloadInvoicePdf(order, accountEmail, supportEmail)}>
                        <Download size={14} aria-hidden="true" /> Invoice PDF (demo)
                      </Button>
                      {retWindow && retWindow.daysLeft > 0 && (
                        <Button variant="outline" size="sm" href={`/account/returns/new?order=${encodeURIComponent(order.orderNumber)}`}>
                      Request return
                    </Button>
                      )}
                    </div>
                    <p className="text-xs text-store-text-secondary" aria-live="polite">
                      {buyAgainOrderId === order.id
                        ? `${order.items.length} item${order.items.length === 1 ? '' : 's'} added to your bag.`
                        : retWindow
                        ? retWindow.daysLeft > 0
                          ? `Returns open for ${retWindow.daysLeft} more day${retWindow.daysLeft === 1 ? '' : 's'} (until ${formatShortDate(retWindow.closesOn)}).`
                          : `The ${RETURN_WINDOW_DAYS}-day return window closed on ${formatShortDate(retWindow.closesOn)}.`
                        : fulfillmentOf(order) !== 'delivered' && !hasIssue(order)
                        ? `Returns open once your order is delivered, for ${RETURN_WINDOW_DAYS} days.`
                        : ''}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {filteredOrders.length > visibleCount && (
        <div className="flex flex-col items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setVisibleCount((n) => n + ORDERS_PAGE_SIZE)}>
            Load more orders
          </Button>
          <p className="text-xs text-store-text-secondary">
            Showing {visibleOrders.length} of {filteredOrders.length}
          </p>
        </div>
      )}
    </section>
  );
}
