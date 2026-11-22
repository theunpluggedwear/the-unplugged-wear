export const instant = false;
import { adminListAbandoned } from '@tuw/heart/modules/analytics';
import AbandonedLiveView from './_components/AbandonedLiveView';
import { session } from '@/server/session';

export default async function AbandonedPage() {
  const claims = await session.requireStaff('order.view', '/abandoned');
  const rows = await adminListAbandoned(claims.sub);
  return <AbandonedLiveView initial={rows} />;
}
