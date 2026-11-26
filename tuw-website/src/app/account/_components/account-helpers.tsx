'use client';

// Shared pieces for the account section pages (orders, addresses, returns, profile).

import React from 'react';
import Badge from '@storefront/components/ui/Badge';
import { formatShortDate } from '@storefront/lib/format';
import type { Address, CartItem, Product, FulfillmentStatus, Order, PaymentStatus } from '@storefront/lib/types';

export type OrderFilter = 'all' | 'in_progress' | 'delivered' | 'issues';

export const ORDERS_PAGE_SIZE = 6;
export { RETURN_WINDOW_DAYS } from '@storefront/lib/product';
import { RETURN_WINDOW_DAYS } from '@storefront/lib/product';
export const DAY_MS = 24 * 60 * 60 * 1000;

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  paid: 'Paid',
  pending: 'Payment pending',
  failed: 'Payment failed',
  refunded: 'Refunded',
};

export const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  queued: 'Queued for print',
  printing: 'Printing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  submission_failed: 'Print submission failed',
  cancelled: 'Cancelled',
};

// Fulfilment progress steps; queued orders sit on "Placed".
const PROGRESS_STEPS = ['Placed', 'Printing', 'Shipped', 'Delivered'] as const;
const PROGRESS_INDEX: Partial<Record<FulfillmentStatus, number>> = {
  queued: 0,
  printing: 1,
  shipped: 2,
  delivered: 3,
};

export const ORDER_FILTERS: { id: OrderFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'issues', label: 'Refunds & issues' },
];

export const ADDRESS_LABELS = ['Home', 'Work', 'Friend', 'Other'] as const;

export type AddressForm = Omit<Address, 'id' | 'country'> & { id: string | null; otherLabel: string };

export const EMPTY_ADDRESS_FORM: AddressForm = {
  id: null,
  label: 'Home',
  otherLabel: '',
  fullName: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  phone: '',
  isDefault: false,
};


export const paymentOf = (order: Order): PaymentStatus => order.paymentStatus ?? 'paid';
export const fulfillmentOf = (order: Order): FulfillmentStatus => order.fulfillmentStatus ?? 'queued';

export const hasIssue = (order: Order) =>
  paymentOf(order) === 'failed' ||
  paymentOf(order) === 'refunded' ||
  fulfillmentOf(order) === 'submission_failed';

export function matchesFilter(order: Order, filter: OrderFilter) {
  switch (filter) {
    case 'in_progress':
      return !hasIssue(order) && fulfillmentOf(order) !== 'delivered';
    case 'delivered':
      return fulfillmentOf(order) === 'delivered' && !hasIssue(order);
    case 'issues':
      return hasIssue(order);
    default:
      return true;
  }
}

// Money in integer paise. Order shipping/discount are stored in whole rupees.
export const lineTotalPaise = (item: CartItem) =>
  (item.priceMinorINR ?? Math.round(item.priceINR * 100)) * item.quantity;
export function orderPaise(order: Order) {
  const subtotal = order.items.reduce((sum, item) => sum + lineTotalPaise(item), 0);
  const shipping = order.shippingINR * 100;
  const discount = order.discountINR * 100;
  return { subtotal, shipping, discount, total: subtotal + shipping - discount };
}

// Catalogue photo for an order line; falls back to the image saved on the order.
export function itemImage(item: CartItem, products: Product[]) {
  const product = products.find((p) => p.id === item.productId);
  const photo =
    product?.images.find((img) => img.color === item.color)?.url ?? product?.images[0]?.url;
  return photo || item.image;
}

// Returns open once delivered (estimated delivery date as the delivered day).
export function returnWindow(order: Order) {
  if (fulfillmentOf(order) !== 'delivered' || hasIssue(order)) return null;
  const deliveredOn = new Date(order.estimatedDelivery ?? order.date);
  const closesOn = new Date(deliveredOn.getTime() + RETURN_WINDOW_DAYS * DAY_MS);
  const daysLeft = Math.ceil((closesOn.getTime() - Date.now()) / DAY_MS);
  return { closesOn, daysLeft };
}


export function StatusPills({ order }: { order: Order }) {
  const payment = paymentOf(order);
  const fulfillment = fulfillmentOf(order);
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge variant={payment === 'failed' ? 'error' : payment === 'paid' ? 'outline' : 'neutral'}>
        {PAYMENT_LABELS[payment]}
      </Badge>
      <Badge
        variant={
          fulfillment === 'submission_failed' ? 'error' : fulfillment === 'delivered' ? 'dark' : 'neutral'
        }
      >
        {FULFILLMENT_LABELS[fulfillment]}
      </Badge>
    </span>
  );
}

export function OrderProgress({ order }: { order: Order }) {
  const step = PROGRESS_INDEX[fulfillmentOf(order)];
  if (step === undefined || hasIssue(order)) {
    return (
      <p className="text-sm text-store-text-secondary border-l-2 border-store-terracotta pl-3">
        {fulfillmentOf(order) === 'submission_failed'
          ? 'We couldn’t send this order to print. Our team will contact you before anything is charged again.'
          : paymentOf(order) === 'refunded'
          ? 'This order was refunded and will not be printed.'
          : 'Payment didn’t go through, so this order is on hold.'}
      </p>
    );
  }
  return (
    <div>
      <ol className="grid grid-cols-4 gap-1.5" aria-label="Order progress">
        {PROGRESS_STEPS.map((label, idx) => (
          <li key={label} aria-current={idx === step ? 'step' : undefined}>
            <span className={`block h-1 ${idx <= step ? 'bg-store-charcoal' : 'bg-store-card-border'}`} />
            <span
              className={`block mt-2 text-xs ${
                idx <= step ? 'text-store-charcoal font-medium' : 'text-store-text-secondary'
              }`}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
      {order.estimatedDelivery && fulfillmentOf(order) !== 'delivered' && (
        <p className="mt-3 text-xs text-store-text-secondary">
          Expected by {formatShortDate(order.estimatedDelivery)}
          {order.carrier ? ` · ${order.carrier}` : ''}
        </p>
      )}
    </div>
  );
}
