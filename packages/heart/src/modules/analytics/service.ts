import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, withTransaction, type Transaction } from '../../platform/db/index.ts';
import { uuidv7 } from '../../platform/ids/index.ts';
import { AppError } from '../../platform/errors/index.ts';
import { getEmailSender } from '../../integrations/email/index.ts';

export interface AbandonedCartRow {
  id: string;
  cartId: string;
  email: string | null;
  items: Array<{ name: string; qty: number }>;
  cartTotal: number;
  abandonedAt: string;
  remindedAt: string | null;
  status: 'detected' | 'reminded' | 'converted' | 'recovered';
}

export type DashboardOrderStatus =
  | 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered'
  | 'cancelled' | 'failed' | 'refunded';

export interface DashboardSummary {
  revenueToday: number;
  ordersToday: number;
  averageOrder: number;
  conversionRate: number;
  deltas: { revenue: number; orders: number; averageOrder: number; conversion: number };
  kpiSeries: { revenue: number[]; orders: number[]; averageOrder: number[]; conversion: number[] };
  trend: Array<{ day: string; value: number; previous: number }>;
  inventoryAlerts: Array<{ name: string; unitsLeft: number; threshold: number; velocityPerDay: number }>;
  topProducts: Array<{
    name: string;
    revenue: number;
    units: number;
    price: number;
    stock: number;
    imageUrl: string | null;
    imageAlt: string | null;
  }>;
  recentOrders: Array<{ orderNumber: string; customerName: string; total: number; status: DashboardOrderStatus }>;
}

export interface ReportSummary {
  revenue: number;
  orders: number;
  aov: number;
  refunds: number;
  searches: number;
  zeroResults: number;
  topProducts: Array<{ name: string; views: number }>;
}

const num = (value: unknown) => (value === null || value === undefined ? 0 : Number(value));

const DAY_MS = 24 * 60 * 60 * 1000;

export function percentDelta(current: number, previous: number): number {
  if (!Number.isFinite(previous) || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export interface DailyKpiRow {
  [column: string]: unknown;
  revenue: unknown;
  conversions: unknown;
  unique_visitors: unknown;
  page_views: unknown;
}

export function toKpiSeries(rows: DailyKpiRow[]): DashboardSummary['kpiSeries'] {
  const latest = [...rows].reverse().slice(-7);
  return {
    revenue: latest.map((r) => num(r.revenue)),
    orders: latest.map((r) => num(r.conversions)),
    averageOrder: latest.map((r) => {
      const orders = num(r.conversions);
      return orders > 0 ? num(r.revenue) / orders : 0;
    }),
    conversion: latest.map((r) => {
      const unique = num(r.unique_visitors);
      const denominator = Math.max(1, unique > 0 ? unique : num(r.page_views));
      return (num(r.conversions) / denominator) * 100;
    }),
  };
}

export function shiftWindow(from: Date | null, to: Date | null): { from: Date | null; to: Date | null } {
  if (!from || !to) return { from: null, to: null };
  const days = Math.max(1, Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1);
  return {
    from: new Date(from.getTime() - days * DAY_MS),
    to: new Date(from.getTime() - 1000),
  };
}

export async function listAbandonedCarts(): Promise<AbandonedCartRow[]> {
  const { rows } = await getDb().execute<{
    id: string; cart_id: string; email: string | null; items: Array<{ name: string; qty: number }>;
    cart_total: string; abandoned_at: Date; reminded_at: Date | null; status: AbandonedCartRow['status'];
  }>(sql`
    SELECT id, cart_id, email, items, cart_total, abandoned_at, reminded_at, status
    FROM abandoned_carts ORDER BY abandoned_at DESC`);
  return rows.map((r) => ({
    id: r.id, cartId: r.cart_id, email: r.email, items: r.items ?? [],
    cartTotal: num(r.cart_total), abandonedAt: new Date(r.abandoned_at).toISOString(),
    remindedAt: r.reminded_at ? new Date(r.reminded_at).toISOString() : null,
    status: r.status,
  }));
}

export async function markAbandonedReminded(id: string, actorId: string): Promise<AbandonedCartRow | null> {
  const updated = await withTransaction(async (tx) => {
    const { rows } = await tx.execute<{
      id: string; cart_id: string; email: string | null; items: Array<{ name: string; qty: number }>;
      cart_total: string; abandoned_at: Date; status: AbandonedCartRow['status'];
    }>(sql`
      UPDATE abandoned_carts SET reminded_at = now(), status = 'reminded'
      WHERE id = ${id}::uuid AND status = 'detected' AND reminded_at IS NULL
      RETURNING id, cart_id, email, items, cart_total, abandoned_at, status`);
    const r = rows[0];
    if (!r) return null;
    if (r.email) {
      await getEmailSender().send({
        to: r.email,
        subject: 'Your bag is waiting',
        template: 'cart.abandoned',
        link: '/cart',
        dedupeKey: `cart.abandoned:${r.cart_id}`,
      });
    }
    return {
      id: r.id, cartId: r.cart_id, email: r.email, items: r.items ?? [],
      cartTotal: num(r.cart_total), abandonedAt: new Date(r.abandoned_at).toISOString(),
      remindedAt: new Date().toISOString(), status: r.status,
    };
  });
  if (!updated) throw new AppError('CONFLICT', 'This reminder was already sent or the cart is no longer detected.');
  return updated;
}

export async function detectAbandonedCarts(hoursIdle = 24): Promise<number> {
  const { rows } = await getDb().execute<{ n: number }>(sql`
    WITH inserted AS (
      INSERT INTO abandoned_carts (id, cart_id, user_id, email, items, cart_total, abandoned_at)
      SELECT gen_random_uuid(), c.id, c.user_id, u.email,
        COALESCE(jsonb_agg(jsonb_build_object('name', ci.product_name, 'qty', ci.qty)), '[]'::jsonb),
        COALESCE(sum(ci.unit_price * ci.qty), 0),
        c.last_activity_at
      FROM carts c
      JOIN cart_items ci ON ci.cart_id = c.id
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.status = 'active' AND c.last_activity_at < now() - (${hoursIdle} || ' hours')::interval
      GROUP BY c.id, c.user_id, u.email, c.last_activity_at
      ON CONFLICT (cart_id) DO NOTHING
      RETURNING id
    )
    SELECT count(*)::int AS n FROM inserted`);
  return rows[0]?.n ?? 0;
}

export async function markAbandonedConverted(tx: Transaction, cartId: string): Promise<void> {
  await tx.execute(sql`
    UPDATE abandoned_carts
    SET status = CASE WHEN status = 'reminded' THEN 'recovered' ELSE 'converted' END
    WHERE cart_id = ${cartId}::uuid AND status IN ('detected', 'reminded')`);
}

export interface DateRangeFilter {
  from?: string | null;
  to?: string | null;
}

function rangeBounds(range?: DateRangeFilter): { from: Date | null; to: Date | null } {
  const from = range?.from ? new Date(`${range.from}T00:00:00+05:30`) : null;
  const to = range?.to ? new Date(`${range.to}T23:59:59+05:30`) : null;
  return {
    from: from && !Number.isNaN(from.getTime()) ? from : null,
    to: to && !Number.isNaN(to.getTime()) ? to : null,
  };
}

function dashboardWindows(range?: DateRangeFilter) {
  const { from, to } = rangeBounds(range);
  const prev = shiftWindow(from, to);
  const trendLimit = from && to ? sql`LIMIT 35` : sql`LIMIT 7`;
  const paymentWindow = from && to
    ? sql`AND paid_at >= ${from} AND paid_at <= ${to}`
    : from ? sql`AND paid_at >= ${from}` : to ? sql`AND paid_at <= ${to}` : sql``;
  const refundWindow = from && to
    ? sql`AND created_at >= ${from} AND created_at <= ${to}`
    : from ? sql`AND created_at >= ${from}` : to ? sql`AND created_at <= ${to}` : sql``;
  const orderWindow = from && to
    ? sql`AND created_at >= ${from} AND created_at <= ${to}`
    : from ? sql`AND created_at >= ${from}` : to ? sql`AND created_at <= ${to}` : sql``;
  const joinedOrderWindow = from && to
    ? sql`AND o.created_at >= ${from} AND o.created_at <= ${to}`
    : from ? sql`AND o.created_at >= ${from}` : to ? sql`AND o.created_at <= ${to}` : sql``;
  const dailyWindow = from && to
    ? sql`AND date >= ${from} AND date <= ${to}`
    : from ? sql`AND date >= ${from}` : to ? sql`AND date <= ${to}` : sql``;
  const prevPaymentWindow = prev.from && prev.to
    ? sql`AND paid_at >= ${prev.from} AND paid_at <= ${prev.to}` : sql``;
  const prevRefundWindow = prev.from && prev.to
    ? sql`AND created_at >= ${prev.from} AND created_at <= ${prev.to}` : sql``;
  const prevOrderWindow = prev.from && prev.to
    ? sql`AND created_at >= ${prev.from} AND created_at <= ${prev.to}` : sql``;
  const prevDailyWindow = prev.from && prev.to
    ? sql`AND date >= ${prev.from} AND date <= ${prev.to}` : sql``;
  return {
    paymentWindow, refundWindow, orderWindow, joinedOrderWindow, dailyWindow,
    prevPaymentWindow, prevRefundWindow, prevOrderWindow, prevDailyWindow, trendLimit,
  };
}

export type DashboardKpis = Pick<DashboardSummary,
  'revenueToday' | 'ordersToday' | 'averageOrder' | 'conversionRate' | 'deltas' | 'kpiSeries'>;

export async function getDashboardKpis(range?: DateRangeFilter): Promise<DashboardKpis> {
  const db = getDb();
  const w = dashboardWindows(range);
  const [kpi, prevKpi, kpiRows, sessions, conversions, prevConversions] = await Promise.all([
    db.execute<{ revenue: string; orders: string }>(sql`
      SELECT
        COALESCE((SELECT sum(amount) FROM payments WHERE status IN ('captured','refunded') ${w.paymentWindow}), 0)
        - COALESCE((SELECT sum(amount) FROM refunds WHERE true ${w.refundWindow}), 0) AS revenue,
        (SELECT count(*) FROM orders WHERE payment_status = 'paid' ${w.orderWindow}) AS orders`),
    db.execute<{ revenue: string; orders: string }>(sql`
      SELECT
        COALESCE((SELECT sum(amount) FROM payments WHERE status IN ('captured','refunded') ${w.prevPaymentWindow}), 0)
        - COALESCE((SELECT sum(amount) FROM refunds WHERE true ${w.prevRefundWindow}), 0) AS revenue,
        (SELECT count(*) FROM orders WHERE payment_status = 'paid' ${w.prevOrderWindow}) AS orders`),
    db.execute<DailyKpiRow>(sql`
      SELECT revenue, conversions, unique_visitors, page_views
      FROM daily_stats WHERE true ${w.dailyWindow} ORDER BY date DESC ${w.trendLimit}`),
    db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM analytics_sessions`),
    db.execute<{ n: number }>(sql`SELECT COALESCE(sum(conversions), 0)::int AS n FROM daily_stats WHERE true ${w.dailyWindow}`),
    db.execute<{ n: number }>(sql`SELECT COALESCE(sum(conversions), 0)::int AS n FROM daily_stats WHERE true ${w.prevDailyWindow}`),
  ]);
  const revenue = num(kpi.rows[0]?.revenue);
  const orders = num(kpi.rows[0]?.orders);
  const averageOrder = orders > 0 ? revenue / orders : 0;
  const sessionCount = sessions.rows[0]?.n ?? 0;
  const conversionRate = sessionCount > 0 ? (num(conversions.rows[0]?.n) / sessionCount) * 100 : 0;
  const prevRevenue = num(prevKpi.rows[0]?.revenue);
  const prevOrders = num(prevKpi.rows[0]?.orders);
  return {
    revenueToday: revenue,
    ordersToday: orders,
    averageOrder,
    conversionRate,
    deltas: {
      revenue: percentDelta(revenue, prevRevenue),
      orders: percentDelta(orders, prevOrders),
      averageOrder: percentDelta(averageOrder, prevOrders > 0 ? prevRevenue / prevOrders : 0),
      conversion: percentDelta(conversionRate, sessionCount > 0 ? (num(prevConversions.rows[0]?.n) / sessionCount) * 100 : 0),
    },
    kpiSeries: toKpiSeries(kpiRows.rows),
  };
}

export async function getDashboardSales(range?: DateRangeFilter): Promise<DashboardSummary['trend']> {
  const db = getDb();
  const w = dashboardWindows(range);
  const [trend, prevTrend] = await Promise.all([
    db.execute<{ day: string; value: string }>(sql`
      SELECT to_char(date, 'DD Mon') AS day, revenue AS value
      FROM daily_stats WHERE true ${w.dailyWindow} ORDER BY date DESC ${w.trendLimit}`),
    db.execute<{ value: string }>(sql`
      SELECT revenue AS value FROM daily_stats WHERE true ${w.prevDailyWindow}
      ORDER BY date DESC ${w.trendLimit}`),
  ]);
  const previous = prevTrend.rows.map((r) => num(r.value));
  return trend.rows.map((r, i) => ({ day: r.day, value: num(r.value), previous: previous[i] ?? 0 })).reverse();
}

export async function getDashboardProducts(range?: DateRangeFilter): Promise<DashboardSummary['topProducts']> {
  const db = getDb();
  const w = dashboardWindows(range);
  const { rows } = await db.execute<{
    name: string; revenue: string; units: string; price: string; stock: string;
    image_url: string | null; image_alt: string | null;
  }>(sql`
    SELECT oi.product_name AS name, sum(oi.line_total) AS revenue, sum(oi.qty) AS units,
      COALESCE(max(p.price), 0) AS price, COALESCE(max(p.stock), 0) AS stock,
      max(img.url) AS image_url, max(img.alt) AS image_alt
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    LEFT JOIN LATERAL (
      SELECT pi.url, pi.alt FROM product_images pi
      WHERE pi.product_id = p.id AND pi.variant_id IS NULL
      ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1
    ) img ON true
    WHERE o.payment_status = 'paid' ${w.joinedOrderWindow}
    GROUP BY p.id, oi.product_name ORDER BY revenue DESC LIMIT 5`);
  return rows.map((r) => ({
    name: r.name, revenue: num(r.revenue), units: num(r.units), price: num(r.price), stock: num(r.stock),
    imageUrl: r.image_url ?? null, imageAlt: r.image_alt ?? null,
  }));
}

export async function getDashboardInventory(): Promise<DashboardSummary['inventoryAlerts']> {
  const db = getDb();
  const [alerts, velocity] = await Promise.all([
    db.execute<{ product_id: string; name: string; units_left: number; threshold: number }>(sql`
      SELECT p.id AS product_id, p.name, p.stock AS units_left,
        COALESCE(p.low_stock_threshold, 5) AS threshold
      FROM products p
      WHERE p.status = 'active' AND p.stock <= COALESCE(p.low_stock_threshold, 5)
      ORDER BY p.stock ASC LIMIT 5`),
    db.execute<{ product_id: string; velocity: string }>(sql`
      SELECT oi.product_id, COALESCE(sum(oi.qty), 0)::numeric / 7 AS velocity
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.payment_status = 'paid' AND o.created_at >= now() - interval '7 days'
      GROUP BY oi.product_id`),
  ]);
  const byProduct = new Map(velocity.rows.map((r) => [r.product_id, num(r.velocity)]));
  return alerts.rows.map((r) => ({
    name: r.name, unitsLeft: r.units_left, threshold: r.threshold,
    velocityPerDay: byProduct.get(r.product_id) ?? 0,
  }));
}

export async function getDashboardRecent(range?: DateRangeFilter): Promise<DashboardSummary['recentOrders']> {
  const db = getDb();
  const w = dashboardWindows(range);
  const { rows } = await db.execute<{
    order_number: string; customer_name: string; total: string; status: DashboardOrderStatus;
  }>(sql`
    SELECT order_number,
      COALESCE(NULLIF(guest_name, ''), 'Customer') AS customer_name,
      grand_total AS total, status
    FROM orders WHERE true ${w.orderWindow} ORDER BY created_at DESC LIMIT 6`);
  return rows.map((r) => ({
    orderNumber: r.order_number, customerName: r.customer_name, total: num(r.total), status: r.status,
  }));
}

export async function getDashboardSummary(range?: DateRangeFilter): Promise<DashboardSummary> {
  const [kpis, trend, topProducts, inventoryAlerts, recentOrders] = await Promise.all([
    getDashboardKpis(range),
    getDashboardSales(range),
    getDashboardProducts(range),
    getDashboardInventory(),
    getDashboardRecent(range),
  ]);
  return { ...kpis, trend, topProducts, inventoryAlerts, recentOrders };
}

export type ReportKpis = Pick<ReportSummary, 'revenue' | 'orders' | 'aov' | 'refunds'>;
export type ReportDemand = Pick<ReportSummary, 'searches' | 'zeroResults'>;

export async function getReportKpis(): Promise<ReportKpis> {
  const db = getDb();
  const [sales, refunds] = await Promise.all([
    db.execute<{ revenue: string; orders: string }>(sql`
      SELECT COALESCE(sum(grand_total), 0) AS revenue, count(*) AS orders
      FROM orders WHERE payment_status = 'paid'`),
    db.execute<{ amount: string }>(sql`SELECT COALESCE(sum(amount), 0) AS amount FROM refunds`),
  ]);
  const revenue = num(sales.rows[0]?.revenue);
  const orders = num(sales.rows[0]?.orders);
  return { revenue, orders, aov: orders > 0 ? revenue / orders : 0, refunds: num(refunds.rows[0]?.amount) };
}

export async function getReportSearchDemand(): Promise<ReportDemand> {
  const { rows } = await getDb().execute<{ searches: string; zero: string }>(sql`
    SELECT count(*) AS searches, count(*) FILTER (WHERE hits = 0) AS zero FROM search_terms`);
  return { searches: num(rows[0]?.searches), zeroResults: num(rows[0]?.zero) };
}

export async function getReportTopProducts(): Promise<ReportSummary['topProducts']> {
  const { rows } = await getDb().execute<{ name: string; views: string }>(sql`
    SELECT p.name, count(*) AS views FROM product_views pv
    JOIN products p ON p.id = pv.product_id
    GROUP BY p.name ORDER BY views DESC LIMIT 10`);
  return rows.map((r) => ({ name: r.name, views: num(r.views) }));
}

export async function getReportSummary(): Promise<ReportSummary> {
  const [kpis, demand, topProducts] = await Promise.all([
    getReportKpis(), getReportSearchDemand(), getReportTopProducts(),
  ]);
  return { ...kpis, ...demand, topProducts };
}

export async function getAbandonedStats(): Promise<{
  atRisk: number; recoverableValue: number; recoveryRate: number;
}> {
  const { rows } = await getDb().execute<{
    at_risk: number; recoverable: string; total: number; converted: number;
  }>(sql`
    SELECT count(*) FILTER (WHERE status = 'detected')::int AS at_risk,
      COALESCE(sum(cart_total) FILTER (WHERE status = 'detected'), 0) AS recoverable,
      count(*)::int AS total,
      count(*) FILTER (WHERE status IN ('converted','recovered'))::int AS converted
    FROM abandoned_carts`);
  const total = num(rows[0]?.total);
  return {
    atRisk: num(rows[0]?.at_risk),
    recoverableValue: num(rows[0]?.recoverable),
    recoveryRate: total > 0 ? (num(rows[0]?.converted) / total) * 100 : 0,
  };
}

export async function rollupDaily(): Promise<number> {
  const { rows } = await getDb().execute<{ n: number }>(sql`
    WITH rolled AS (
      INSERT INTO daily_stats (id, date, page_views, unique_visitors, conversions, revenue)
      SELECT ${uuidv7()}::uuid, current_date,
        (SELECT count(*) FROM page_views WHERE ts::date = current_date),
        (SELECT count(DISTINCT session_id) FROM page_views WHERE ts::date = current_date),
        (SELECT count(*) FROM orders WHERE payment_status = 'paid' AND created_at::date = current_date),
        (SELECT COALESCE(sum(amount), 0) FROM payments WHERE status = 'captured' AND paid_at::date = current_date)
      ON CONFLICT (date) DO UPDATE SET
        page_views = EXCLUDED.page_views, unique_visitors = EXCLUDED.unique_visitors,
        conversions = EXCLUDED.conversions, revenue = EXCLUDED.revenue
      RETURNING date
    )
    SELECT count(*)::int AS n FROM rolled`);
  return rows[0]?.n ?? 0;
}
