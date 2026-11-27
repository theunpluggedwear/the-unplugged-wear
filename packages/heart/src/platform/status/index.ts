export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'failed', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_PAYMENT_STATUSES = ['paid', 'pending', 'failed', 'refunded'] as const;
export type OrderPaymentStatus = (typeof ORDER_PAYMENT_STATUSES)[number];

export const PROVIDER_PAYMENT_STATUSES = ['pending', 'authorized', 'captured', 'failed', 'refunded'] as const;
export type ProviderPaymentStatus = (typeof PROVIDER_PAYMENT_STATUSES)[number];

export const FULFILLMENT_STATUSES = ['pending', 'submitted', 'on_hold', 'in_production', 'shipped', 'delivery_exception', 'delivered', 'rto_initiated', 'returned', 'cancelled', 'failed'] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

export const RETURN_STATUSES = ['requested', 'approved', 'rejected', 'pickup_scheduled', 'in_transit', 'received', 'inspected', 'completed', 'cancelled', 'disputed'] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const NOTIFICATION_KINDS = ['order', 'cart', 'inventory', 'payment', 'system', 'marketing', 'refund'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
  failed: ['confirmed', 'cancelled'],
  refunded: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return (ORDER_TRANSITIONS[from] as readonly string[]).includes(to);
}

export const ORDER_PAYMENT_TRANSITIONS: Record<OrderPaymentStatus, readonly OrderPaymentStatus[]> = {
  pending: ['paid', 'failed', 'refunded'],
  paid: ['refunded'],
  failed: [],
  refunded: [],
};

export function canTransitionOrderPayment(from: OrderPaymentStatus, to: OrderPaymentStatus): boolean {
  return (ORDER_PAYMENT_TRANSITIONS[from] as readonly string[]).includes(to);
}

export const REFUND_TRANSITIONS: Record<string, readonly string[]> = {
  processing: ['completed', 'rejected'],
  completed: [],
  rejected: [],
};

export function canTransitionRefund(from: string, to: string): boolean {
  return (REFUND_TRANSITIONS[from] ?? []).includes(to);
}

export const RETURN_TRANSITIONS: Record<ReturnStatus, readonly ReturnStatus[]> = {
  requested: ['approved', 'rejected', 'cancelled'],
  approved: ['pickup_scheduled', 'in_transit', 'completed', 'cancelled'],
  pickup_scheduled: ['in_transit', 'cancelled'],
  in_transit: ['received', 'cancelled'],
  received: ['inspected', 'completed'],
  inspected: ['completed', 'disputed'],
  disputed: ['completed'],
  completed: [],
  rejected: [],
  cancelled: [],
};

const LEGACY_FULFILLMENT: Record<string, FulfillmentStatus> = {
  queued: 'pending',
  printing: 'in_production',
  submission_failed: 'failed',
};

export function normalizeLegacyFulfillment(value: string): FulfillmentStatus | null {
  const normalized = value.trim().toLowerCase();
  if ((FULFILLMENT_STATUSES as readonly string[]).includes(normalized)) return normalized as FulfillmentStatus;
  return LEGACY_FULFILLMENT[normalized] ?? null;
}

export function paymentStatusForProvider(status: ProviderPaymentStatus): OrderPaymentStatus {
  if (status === 'authorized' || status === 'captured') return 'paid';
  return status;
}
