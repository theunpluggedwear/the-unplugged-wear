export const instant = false;
import { adminListTickets } from '@tuw/heart/modules/support';
import SupportLiveView from './_components/SupportLiveView';
import { session } from '@/server/session';

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ ticket?: string }> }) {
  const claims = await session.requireStaff('customer.view', '/support');
  const tickets = await adminListTickets(undefined, claims.sub);
  const { ticket } = await searchParams;
  return <SupportLiveView initial={tickets} selectedId={ticket ?? null} />;
}
