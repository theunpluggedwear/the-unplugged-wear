import 'server-only';

export type WebhookKind =
  | 'payment_captured'
  | 'payment_failed'
  | 'refund_created'
  | 'refund_processed'
  | 'refund_failed'
  | 'authorization'
  | 'pending'
  | 'downtime'
  | 'refund_speed_changed'
  | 'dispute'
  | 'unknown';

export interface NormalizedWebhookEvent {
  provider: string;
  providerEventId: string;
  eventType: string;
  kind: WebhookKind;
  raw: unknown;
  providerOrderId?: string;
  providerPaymentId?: string;
  providerRefundId?: string;
  amountPaise?: number;
  currency?: string;
  status?: string;
  occurredAt?: string;
}

export interface WebhookProvider {
  slug: string;
  /** Verify the raw body against provider headers. Never parse before this. */
  verify(rawBody: string, headers: Headers): boolean;
  /** Convert provider payload into our internal shape. Return null for unusable payloads. */
  normalize(rawBody: string, headers: Headers): NormalizedWebhookEvent | null;
}
