import { adminListShipments } from '@tuw/heart/modules/fulfillment';
import { session } from '@/server/session';
import ShipmentsView from './_components/ShipmentsView';

// Server Component: the newest parcels arrive with the HTML; filters, paging,
// manual dispatch and status moves ask the server (server/fulfillment-actions.ts).
export default async function ShipmentsPage() {
  const claims = await session.requireStaff('shipment.manage', '/shipments');
  const initial = await adminListShipments({ status: 'all', perPage: 15 });
  return <ShipmentsView initial={initial} perms={claims.perms} />;
}
