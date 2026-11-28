export const instant = false;
import { adminListOrders, type AdminOrderTab } from '@tuw/heart/modules/orders';
import { session } from '@/server/session';
import OrdersView from './_components/OrdersView';

const TABS: AdminOrderTab[] = ['all', 'unfulfilled', 'unpaid', 'cancelled', 'finished'];
const positiveInt = (value: string | undefined, fallback: number, max: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : fallback;
};




export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string; page?: string; perPage?: string; open?: string }> }) {
  const claims = await session.requireStaff('order.view', '/orders');
  const params = await searchParams;
  const tab: AdminOrderTab = TABS.includes(params.tab as AdminOrderTab) ? (params.tab as AdminOrderTab) : 'all';
  const page = positiveInt(params.page, 1, 100_000);
  const perPage = positiveInt(params.perPage, 10, 5000);
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const initial = await adminListOrders({ q: q || undefined, tab, page, perPage });
  const openOrder = params.open && /^[A-Z0-9-]{5,30}$/i.test(params.open) ? params.open : undefined;
  return <OrdersView initial={initial} perms={claims.perms} openOrder={openOrder} query={q} tab={tab} page={page} perPage={perPage} />;
}
