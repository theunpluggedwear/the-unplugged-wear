export const instant = false;
import { adminGetDashboard } from '@tuw/heart/modules/analytics';
import DashboardLiveView from '../_components/DashboardLiveView';
import { session } from '@/server/session';

export default async function DashboardPage() {
  const claims = await session.requireStaff(undefined, '/dashboard');
  const summary = await adminGetDashboard(claims.sub);
  return <DashboardLiveView summary={summary} userName={claims.name} />;
}
