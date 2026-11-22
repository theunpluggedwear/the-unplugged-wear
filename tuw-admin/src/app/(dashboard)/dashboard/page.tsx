export const instant = false;
import { adminGetDashboard } from '@tuw/heart/modules/analytics';
import DashboardLiveView from '../_components/DashboardLiveView';
import { session } from '@/server/session';

function labelFor(from?: string, to?: string): string {
  if (!from) return 'Today';
  const format = (value: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(`${value}T00:00:00+05:30`));
  return to ? `${format(from)} - ${format(to)}` : format(from);
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const claims = await session.requireStaff(undefined, '/dashboard');
  const params = await searchParams;
  const summary = await adminGetDashboard(claims.sub, { from: params.from, to: params.to });
  return <DashboardLiveView summary={summary} userName={claims.name} initialLabel={labelFor(params.from, params.to)} />;
}
