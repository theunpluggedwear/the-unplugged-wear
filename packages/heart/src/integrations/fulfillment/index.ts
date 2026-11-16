import 'server-only';
import { AppError } from '../../platform/errors/index.ts';
import { customAtelier, type FulfillmentPartner } from './adapters.ts';
import { createQikinkPartner } from './qikink.ts';

export * from './adapters.ts';
export * from './qikink.ts';

/**
 * One adapter per provider slug. Qikink is the real client when
 * QIKINK_CLIENT_ID / QIKINK_CLIENT_SECRET are set and the simulator otherwise,
 * so the provider row never has to change when the keys arrive.
 */
export const fulfillmentAdapters: readonly FulfillmentPartner[] = [createQikinkPartner(), customAtelier];

/** Adapter for a product's partner (products.partner_provider → slug). */
export function getFulfillmentPartner(slug: string): FulfillmentPartner {
  const partner = fulfillmentAdapters.find((a) => a.slug === slug);
  if (!partner) throw new AppError('RULE_VIOLATION', `No fulfilment adapter for "${slug}" yet (integrations phase).`);
  return partner;
}

/** True while the Qikink adapter is the simulator (no keys configured). */
export const qikinkIsSimulated = (): boolean => !process.env.QIKINK_CLIENT_ID?.trim() || !process.env.QIKINK_CLIENT_SECRET?.trim();
