export const instant = false;
import { adminListTickets } from '@tuw/heart/modules/support';
import SupportLiveView from './_components/SupportLiveView';
import { session } from '@/server/session';

export default async function SupportPage() {
  const claims = await session.requireStaff('customer.view', '/support');
  const tickets = await adminListTickets(undefined, claims.sub);
  return <SupportLiveView initial={tickets} />;
}
