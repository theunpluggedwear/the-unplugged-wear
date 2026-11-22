export const instant = false;
import { adminGetReport } from '@tuw/heart/modules/analytics';
import ReportsLiveView from './_components/ReportsLiveView';
import { session } from '@/server/session';

export default async function ReportsPage() {
  const claims = await session.requireStaff('report.view', '/reports');
  const summary = await adminGetReport(claims.sub);
  return <ReportsLiveView summary={summary} />;
}
