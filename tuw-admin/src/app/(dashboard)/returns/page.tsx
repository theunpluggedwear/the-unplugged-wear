export const instant = false;
import { adminListReturns } from '@tuw/heart/modules/returns';
import { session } from '@/server/session';
import ReturnsView from './_components/ReturnsView';

// Server Component: the first page of requests arrives with the HTML; tabs,
// search, paging and every decision then ask the server (server/return-actions.ts).
export default async function ReturnsPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const claims = await session.requireStaff('return.view', '/returns');
  const [initial, params] = await Promise.all([adminListReturns({ perPage: 10 }), searchParams]);
  const openRma = params.open && /^RMA-[A-Z0-9-]{3,30}$/i.test(params.open) ? params.open.toUpperCase() : undefined;
  return <ReturnsView initial={initial} perms={claims.perms} openRma={openRma} />;
}
