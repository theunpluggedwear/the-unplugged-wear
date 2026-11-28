export const instant = false;
import {
  adminGetDashboardInventory,
  adminGetDashboardKpis,
  adminGetDashboardProducts,
  adminGetDashboardRecent,
  adminGetDashboardSales,
} from '@tuw/heart/modules/analytics';
import DashboardLiveView from '../_components/DashboardLiveView';
import { session } from '@/server/session';
import { isSalesRange, rangeToParams } from '@/lib/dashboard';

function labelFor(from?: string, to?: string): string {
  if (!from) return 'Today';
  const format = (value: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(`${value}T00:00:00+05:30`));
  return to ? `${format(from)} - ${format(to)}` : format(from);
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; preset?: string }> }) {
  const claims = await session.requireStaff(undefined, '/dashboard');
  const params = await searchParams;
  const preset = isSalesRange(params.preset) ? params.preset : undefined;
  const range = preset
    ? rangeToParams(preset)
    : params.from ? { from: params.from, to: params.to } : rangeToParams('This week');
  const label = preset ?? (params.from ? labelFor(params.from, params.to) : 'This week');
  return (
    <DashboardLiveView
      kpis={adminGetDashboardKpis(claims.sub, range)}
      trend={adminGetDashboardSales(claims.sub, range)}
      products={adminGetDashboardProducts(claims.sub, range)}
      inventory={adminGetDashboardInventory(claims.sub)}
      orders={adminGetDashboardRecent(claims.sub, range)}
      userName={claims.name}
      initialLabel={label}
      rangeLabel={preset ?? (params.from ? 'Custom range' : 'This week')}
      storefrontOrigin={process.env.STOREFRONT_URL ?? ''}
    />
  );
}
