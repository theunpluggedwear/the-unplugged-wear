import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, type Transaction } from '../../platform/db/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import { toPaise } from '../../platform/money/index.ts';
import { demoTemplateFor, designFieldsFromOrderItem, hasPersonalizationDesignFields } from '../personalization/index.ts';
import { qikinkIsSimulated } from '../../integrations/fulfillment/index.ts';
import type { FulfillmentOrderInput, FulfillmentOrderLine } from '../../integrations/fulfillment/index.ts';

// Who prints an order line (DOC/backend/16 §1, §6). A product names its
// partner (products.partner_provider → integration_providers.slug); each
// variant maps to that partner's SKU in provider_product_mappings. While the
// Qikink adapter is the simulator a missing mapping falls back to our own SKU
// and the row records that it did — with real keys the fallback is refused,
// because Qikink would print the wrong item.

type Db = Transaction | ReturnType<typeof getDb>;

export interface ProviderRow {
  id: string;
  slug: string;
  name: string;
  environment: 'sandbox' | 'live';
  isActive: boolean;
  capabilities: Record<string, unknown>;
  settings: Record<string, unknown>;
}

type ProviderSql = { id: string; slug: string; name: string; environment: 'sandbox' | 'live'; is_active: boolean; capabilities: Record<string, unknown> | null; settings: Record<string, unknown> | null };

const toProvider = (r: ProviderSql): ProviderRow => ({
  id: r.id, slug: r.slug, name: r.name, environment: r.environment,
  isActive: r.is_active, capabilities: r.capabilities ?? {}, settings: r.settings ?? {},
});

export async function fulfillmentProviders(db: Db = getDb()): Promise<ProviderRow[]> {
  const { rows } = await db.execute<ProviderSql>(sql`SELECT id, slug, name, environment, is_active, capabilities, settings
    FROM integration_providers WHERE category = 'fulfillment' ORDER BY is_active DESC, name`);
  return rows.map(toProvider);
}

export async function providerBySlug(slug: string, db: Db = getDb()): Promise<ProviderRow | null> {
  const { rows } = await db.execute<ProviderSql>(sql`SELECT id, slug, name, environment, is_active, capabilities, settings
    FROM integration_providers WHERE slug = ${slug}`);
  return rows[0] ? toProvider(rows[0]) : null;
}

export interface PlannedLine extends FulfillmentOrderLine {
  orderItemId: string;
  productName: string;
  /** Qikink was sent our own SKU because the simulator has no mapping. */
  usedFallbackSku: boolean;
}

export interface PlannedGroup {
  provider: ProviderRow;
  lines: PlannedLine[];
  costPaise: number | null;
}

export interface SkippedGroup {
  slug: string;
  reason: string;
}

export interface PlannedOrder {
  orderId: string;
  orderNumber: string;
  gateway: 'prepaid' | 'cod';
  codAmountPaise: number | null;
  totalPaise: number;
  shipTo: FulfillmentOrderInput['shipTo'];
  groups: PlannedGroup[];
  skipped: SkippedGroup[];
}

type OrderSql = {
  id: string; order_number: string; payment_status: 'pending' | 'paid' | 'failed' | 'refunded'; grand_total: string;
  shipping_address: Record<string, string>; cod: boolean; email: string;
};

type LineSql = {
  id: string; variant_id: string | null; sku: string; product_name: string; qty: number; unit_price: string;
  partner_provider: string | null; provider_sku: string | null; provider_payload: Record<string, unknown> | null; unit_cost: string | null;
  personalization: Record<string, unknown> | null; preview_image_url: string | null; product_type: string | null;
};

/**
 * Everything one order needs to go to its partner(s). Throws when the order is
 * not paid (prepaid) — COD orders are submitted unpaid by design.
 */
export async function planOrder(orderId: string, db: Db = getDb()): Promise<PlannedOrder> {
  const { rows: [order] } = await db.execute<OrderSql>(sql`
    SELECT o.id, o.order_number, o.payment_status, o.grand_total, o.shipping_address,
           COALESCE(o.guest_email, u.email, '') AS email,
           EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.method = 'cod') AS cod
    FROM orders o LEFT JOIN users u ON u.id = o.placed_by_user_id
    WHERE o.id = ${orderId}`);
  if (!order) throw new AppError('NOT_FOUND', 'That order does not exist.');
  if (!order.cod && order.payment_status !== 'paid') {
    throw new AppError('RULE_VIOLATION', 'Only a paid or cash-on-delivery order can go to the print partner.');
  }
  const { rows: lines } = await db.execute<LineSql>(sql`
    SELECT oi.id, oi.variant_id, oi.sku, oi.product_name, oi.qty, oi.unit_price,
           p.partner_provider, p.product_type, oi.personalization, oi.preview_image_url,
           m.provider_sku, m.provider_payload, m.unit_cost
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    LEFT JOIN integration_providers ip ON ip.slug = p.partner_provider
    LEFT JOIN provider_product_mappings m ON m.variant_id = oi.variant_id AND m.provider_id = ip.id AND m.is_active
    WHERE oi.order_id = ${orderId} AND p.product_kind <> 'gift_card'
    ORDER BY oi.created_at, oi.id`);
  if (!lines.length) throw new AppError('RULE_VIOLATION', 'This order has no printable lines (gift cards are sent separately).');

  const providers = new Map((await fulfillmentProviders(db)).map((p) => [p.slug, p]));
  const simulated = qikinkIsSimulated();
  const groups = new Map<string, PlannedGroup>();
  const skipped: SkippedGroup[] = [];

  for (const line of lines) {
    const slug = line.partner_provider ?? 'custom_atelier';
    const provider = providers.get(slug);
    if (!provider) { skipped.push({ slug, reason: `No ${slug} row in the provider registry.` }); continue; }
    if (!provider.isActive) { skipped.push({ slug, reason: `${provider.name} is switched off in Settings → Integrations.` }); continue; }
    let sku = line.provider_sku ?? '';
    let usedFallbackSku = false;
    if (!sku && provider.slug === 'qikink' && simulated) { sku = line.sku; usedFallbackSku = true; }
    if (!sku) { skipped.push({ slug, reason: `${line.product_name} (${line.sku}) has no ${provider.name} partner SKU.` }); continue; }
    const group = groups.get(slug) ?? { provider, lines: [], costPaise: 0 };
    const payload = { ...(line.provider_payload ?? {}) };
    if (slug === 'qikink' && line.personalization && !hasPersonalizationDesignFields(payload)) {
      Object.assign(payload, designFieldsFromOrderItem({
        orderItemId: line.id,
        personalization: line.personalization,
        previewImageUrl: line.preview_image_url,
        template: simulated ? demoTemplateFor(line.product_type) : null,
      }));
    }
    group.lines.push({
      orderItemId: line.id, productName: line.product_name, sku, quantity: line.qty,
      unitPricePaise: toPaise(line.unit_price), payload, usedFallbackSku,
    });
    if (line.unit_cost === null) group.costPaise = null;
    else if (group.costPaise !== null) group.costPaise += toPaise(line.unit_cost) * line.qty;
    groups.set(slug, group);
  }

  const address = order.shipping_address ?? {};
  const totalPaise = toPaise(order.grand_total);
  return {
    orderId: order.id,
    orderNumber: order.order_number,
    gateway: order.cod ? 'cod' : 'prepaid',
    codAmountPaise: order.cod ? totalPaise : null,
    totalPaise,
    shipTo: {
      name: address.fullName ?? 'Customer',
      line1: address.line1 ?? '',
      line2: address.line2 ?? null,
      city: address.city ?? '',
      state: address.state ?? '',
      postalCode: address.postalCode ?? '',
      phone: address.phone ?? '',
      email: order.email, // Qikink requires one on every create call
      country: address.country ?? 'India',
    },
    groups: [...groups.values()],
    skipped,
  };
}

/** Qikink order_number ≤ 15 chars, no dashes (DOC/backend/16 §6). */
export function externalRef(orderNumber: string, attempt = 0): string {
  const base = orderNumber.replace(/[^A-Za-z0-9]/g, '');
  if (attempt === 0) return base.slice(0, 15);
  return `${base.slice(0, 13)}${attempt.toString(36).toUpperCase().slice(-2)}`;
}
