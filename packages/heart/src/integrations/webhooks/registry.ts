import 'server-only';
import type { WebhookProvider } from './types.ts';
import { razorpayWebhookProvider } from './razorpay.ts';

const providers = new Map<string, WebhookProvider>(
  [razorpayWebhookProvider].map((p) => [p.slug, p]),
);

/** A webhook adapter by URL slug; adding a new provider = one more entry here. */
export function getWebhookProvider(slug: string): WebhookProvider | null {
  return providers.get(slug) ?? null;
}
