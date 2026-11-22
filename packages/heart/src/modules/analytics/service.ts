import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, withTransaction } from '../../platform/db/index.ts';
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

export interface DashboardSummary {
  revenueToday: number;
  ordersToday: number;
  averageOrder: number;
  conversionRate: number;
  trend: Array<{ day: string; value: number }>;
  inventoryAlerts: Array<{ name: string; unitsLeft: number; threshold: number }>;
  topProducts: Array<{ name: string; revenue: number; units: number }>;
  recentOrders: Array<{ orderNumber: string; customerName: string; total: number; status: string }>;
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
    SELECT count(*)::int AS n FROM (
      INSERT INTO abandoned_carts (id, cart_id, user_id, email, items, cart_total, abandoned_at)
      SELECT ${uuidv7()}::uuid, c.id, c.user_id, u.email,
        COALESCE(jsonb_agg(jsonb_build_object('name', ci.product_name, 'qty', ci.qty)), '[]'::jsonb),
        COALESCE(sum(ci.unit_price * ci.qty), 0),
        c.last_activity_at
      FROM carts c
      JOIN cart_items ci ON ci.cart_id = c.id
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.status = 'active' AND c.last_activity_at < now() - (${hoursIdle} || ' hours')::interval
      GROUP BY c.id, c.user_id, u.email, c.last_activity_at
      ON CONFLICT (cart_id) DO NOTHING
    ) inserted`);
  return rows[0]?.n ?? 0;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const db = getDb();
  const [kpi, trend, alerts, top, recent] = await Promise.all([
    db.execute<{ revenue: string; orders: string }>(sql`
      SELECT
        COALESCE((SELECT sum(amount) FROM payments WHERE status IN ('captured','refunded')), 0)
        - COALESCE((SELECT sum(amount) FROM refunds), 0) AS revenue,
        (SELECT count(*) FROM orders WHERE payment_status = 'paid') AS orders`),
    db.execute<{ day: string; value: string }>(sql`
      SELECT to_char(date, 'DD Mon') AS day, revenue AS value FROM daily_stats ORDER BY date DESC LIMIT 7`),
    db.execute<{ name: string; units_left: number; threshold: number }>(sql`
      SELECT name, stock AS units_left, COALESCE(low_stock_threshold, 5) AS threshold
      FROM products WHERE status = 'active' AND stock <= COALESCE(low_stock_threshold, 5)
      ORDER BY stock ASC LIMIT 5`),
    db.execute<{ name: string; revenue: string; units: string }>(sql`
      SELECT oi.product_name AS name, sum(oi.line_total) AS revenue, sum(oi.qty) AS units
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.payment_status = 'paid'
      GROUP BY oi.product_name ORDER BY revenue DESC LIMIT 5`),
    db.execute<{ order_number: string; customer_name: string; total: string; status: string }>(sql`
      SELECT order_number,
        COALESCE(NULLIF(guest_name, ''), 'Customer') AS customer_name,
        grand_total AS total, status
      FROM orders ORDER BY created_at DESC LIMIT 6`),
  ]);
  const revenue = num(kpi.rows[0]?.revenue);
  const orders = num(kpi.rows[0]?.orders);
  const sessions = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM analytics_sessions`);
  const conversions = await db.execute<{ n: number }>(sql`SELECT COALESCE(sum(conversions), 0)::int AS n FROM daily_stats`);
  const sessionCount = sessions.rows[0]?.n ?? 0;
  return {
    revenueToday: revenue,
    ordersToday: orders,
    averageOrder: orders > 0 ? revenue / orders : 0,
    conversionRate: sessionCount > 0 ? ((conversions.rows[0]?.n ?? 0) / sessionCount) * 100 : 0,
    trend: trend.rows.map((r) => ({ day: r.day, value: num(r.value) })).reverse(),
    inventoryAlerts: alerts.rows.map((r) => ({ name: r.name, unitsLeft: r.units_left, threshold: r.threshold })),
    topProducts: top.rows.map((r) => ({ name: r.name, revenue: num(r.revenue), units: num(r.units) })),
    recentOrders: recent.rows.map((r) => ({ orderNumber: r.order_number, customerName: r.customer_name, total: num(r.total), status: r.status })),
  };
}

export async function getReportSummary(): Promise<ReportSummary> {
  const db = getDb();
  const [sales, refunds, search, views] = await Promise.all([
    db.execute<{ revenue: string; orders: string }>(sql`
      SELECT COALESCE(sum(grand_total), 0) AS revenue, count(*) AS orders
      FROM orders WHERE payment_status = 'paid'`),
    db.execute<{ amount: string }>(sql`SELECT COALESCE(sum(amount), 0) AS amount FROM refunds`),
    db.execute<{ searches: string; zero: string }>(sql`
      SELECT count(*) AS searches, count(*) FILTER (WHERE hits = 0) AS zero FROM search_terms`),
    db.execute<{ name: string; views: string }>(sql`
      SELECT p.name, count(*) AS views FROM product_views pv
      JOIN products p ON p.id = pv.product_id
      GROUP BY p.name ORDER BY views DESC LIMIT 10`),
  ]);
  const revenue = num(sales.rows[0]?.revenue);
  const orders = num(sales.rows[0]?.orders);
  return {
    revenue,
    orders,
    aov: orders > 0 ? revenue / orders : 0,
    refunds: num(refunds.rows[0]?.amount),
    searches: num(search.rows[0]?.searches),
    zeroResults: num(search.rows[0]?.zero),
    topProducts: views.rows.map((r) => ({ name: r.name, views: num(r.views) })),
  };
}

export async function rollupDaily(): Promise<number> {
  const { rows } = await getDb().execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM (
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
    ) rolled`);
  return rows[0]?.n ?? 0;
}
